<?php

namespace App\Services;

use App\Models\InventoryItem;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStockDeduction;
use App\Models\StockBatch;
use App\Models\StockLog;
use DomainException;

class StockDeductionService
{
    private const EPSILON = 0.00005;

    /** @return array{success: bool, previous_qty: float, new_qty: float, message: string} */
    public function deduct(
        int $inventoryItemId,
        float $quantity,
        string $reason,
        string $performedBy,
        ?Order $order = null,
        ?OrderItem $orderItem = null,
    ): array {
        $quantity = round($quantity, 4);
        app(BatchExpiryService::class)->quarantineDueBatches([$inventoryItemId]);
        $item = InventoryItem::whereKey($inventoryItemId)->lockForUpdate()->firstOrFail();
        $previousQty = round((float) $item->quantity, 4);

        $batches = StockBatch::where('inventory_item_id', $item->id)
            ->active()
            ->where('quantity_remaining', '>', 0)
            ->orderBy('purchased_at')
            ->orderBy('created_at')
            ->orderBy('id')
            ->lockForUpdate()
            ->get();
        $batchAvailable = round((float) $batches->sum('quantity_remaining'), 4);
        $available = min($previousQty, $batchAvailable);

        if ($quantity <= self::EPSILON || $quantity - $available > self::EPSILON) {
            return [
                'success' => false,
                'previous_qty' => $previousQty,
                'new_qty' => $previousQty,
                'message' => sprintf(
                    '%s: insufficient stock. Needed %s %s, available %s %s.',
                    $item->name,
                    $this->formatQty($quantity),
                    $item->unit,
                    $this->formatQty($available),
                    $item->unit,
                ),
            ];
        }

        $remaining = $quantity;
        foreach ($batches as $batch) {
            if ($remaining <= self::EPSILON) break;

            $batchRemaining = (float) $batch->quantity_remaining;
            $taken = round(min($batchRemaining, $remaining), 4);
            if ($taken <= self::EPSILON) continue;

            $batch->update([
                'quantity_remaining' => max(0, round($batchRemaining - $taken, 4)),
            ]);

            if ($order) {
                OrderStockDeduction::create([
                    'order_id' => $order->id,
                    'order_item_id' => $orderItem?->id,
                    'inventory_item_id' => $item->id,
                    'stock_batch_id' => $batch->id,
                    'quantity' => $taken,
                ]);
            }

            $remaining = round($remaining - $taken, 4);
        }

        if ($remaining > self::EPSILON) {
            throw new DomainException("FIFO batches for {$item->name} are incomplete. No stock was deducted.");
        }

        $newQty = max(0, round($previousQty - $quantity, 4));
        $item->update(['quantity' => $newQty]);
        StockLog::create([
            'inventory_item_id' => $item->id,
            'item_name' => $item->name,
            'type' => 'out',
            'quantity' => $quantity,
            'previous_qty' => $previousQty,
            'new_qty' => $newQty,
            'reason' => $reason,
            'performed_by' => $performedBy,
        ]);

        return [
            'success' => true,
            'previous_qty' => $previousQty,
            'new_qty' => $newQty,
            'message' => sprintf('%s: %s → %s %s', $item->name, $this->formatQty($previousQty), $this->formatQty($newQty), $item->unit),
        ];
    }

    /**
     * Aggregate every recipe requirement before changing stock so dishes that
     * share an ingredient cannot collectively exceed what is available.
     *
     * @return array{deductions: array, warnings: array, unavailable_items: array}
     */
    public function deductForOrder(Order $order, string $performedBy): array
    {
        $order->load('items.menuItem.recipes.inventoryItem');

        if (OrderStockDeduction::where('order_id', $order->id)->exists()) {
            return ['deductions' => [], 'warnings' => [], 'unavailable_items' => []];
        }

        $requirements = [];
        foreach ($order->items as $orderItem) {
            foreach ($orderItem->menuItem?->recipes ?? [] as $recipe) {
                $inventoryId = (int) $recipe->inventory_item_id;
                $requirements[$inventoryId] = round(
                    ($requirements[$inventoryId] ?? 0) + ((float) $recipe->quantity_needed * $orderItem->quantity),
                    4,
                );
            }
        }

        foreach ($requirements as $inventoryId => $needed) {
            app(BatchExpiryService::class)->quarantineDueBatches([$inventoryId]);
            $item = InventoryItem::whereKey($inventoryId)->lockForUpdate()->firstOrFail();
            $batchAvailable = (float) StockBatch::where('inventory_item_id', $inventoryId)
                ->active()
                ->where('quantity_remaining', '>', 0)
                ->lockForUpdate()
                ->sum('quantity_remaining');
            $available = min((float) $item->quantity, $batchAvailable);
            if ($needed - $available > self::EPSILON) {
                throw new DomainException(sprintf(
                    'Not enough %s. The order needs %s %s, but only %s %s is available.',
                    $item->name,
                    $this->formatQty($needed),
                    $item->unit,
                    $this->formatQty($available),
                    $item->unit,
                ));
            }
        }

        $deductions = [];
        $affectedInventoryIds = [];
        foreach ($order->items as $orderItem) {
            foreach ($orderItem->menuItem?->recipes ?? [] as $recipe) {
                $result = $this->deduct(
                    (int) $recipe->inventory_item_id,
                    round((float) $recipe->quantity_needed * $orderItem->quantity, 4),
                    "Order #{$order->id} - {$orderItem->name} ×{$orderItem->quantity}",
                    $performedBy,
                    $order,
                    $orderItem,
                );
                if (!$result['success']) throw new DomainException($result['message']);

                $deductions[] = $result['message'];
                $affectedInventoryIds[] = (int) $recipe->inventory_item_id;
            }
        }

        return [
            'deductions' => $deductions,
            'warnings' => [],
            'unavailable_items' => $this->refreshMenuAvailability(array_values(array_unique($affectedInventoryIds))),
        ];
    }

    public function refreshMenuAvailability(array $inventoryItemIds = []): array
    {
        $query = MenuItem::whereHas('recipes');
        if ($inventoryItemIds !== []) {
            $query->whereHas('recipes', fn ($q) => $q->whereIn('inventory_item_id', $inventoryItemIds));
        }

        $unavailableItems = [];
        foreach ($query->with('recipes.inventoryItem')->get() as $menuItem) {
            $canMake = $menuItem->recipes->every(fn ($recipe) =>
                $recipe->inventoryItem
                && (float) $recipe->inventoryItem->quantity + self::EPSILON >= (float) $recipe->quantity_needed
            );
            if ((bool) $menuItem->available !== $canMake) {
                $menuItem->update(['available' => $canMake]);
                if (!$canMake) $unavailableItems[] = $menuItem->name;
            }
        }
        return $unavailableItems;
    }

    /** @return array{restorations: array} */
    public function restoreForOrder(Order $order, string $performedBy): array
    {
        $allocations = OrderStockDeduction::where('order_id', $order->id)
            ->whereNull('restored_at')
            ->orderBy('id')
            ->lockForUpdate()
            ->get();
        if ($allocations->isEmpty()) return $this->restoreLegacyOrder($order, $performedBy);

        $restorations = [];
        $affectedIds = [];
        foreach ($allocations->groupBy('inventory_item_id') as $inventoryId => $itemAllocations) {
            $item = InventoryItem::whereKey($inventoryId)->lockForUpdate()->firstOrFail();
            $previousQty = round((float) $item->quantity, 4);
            $total = 0.0;
            $usableTotal = 0.0;
            $expiredTotal = 0.0;

            foreach ($itemAllocations as $allocation) {
                $quantity = round((float) $allocation->quantity, 4);
                $batch = $allocation->stock_batch_id
                    ? StockBatch::whereKey($allocation->stock_batch_id)->lockForUpdate()->first()
                    : null;
                if ($batch) {
                    $batch->update(['quantity_remaining' => round((float) $batch->quantity_remaining + $quantity, 4)]);
                    if ($batch->is_expired) $expiredTotal = round($expiredTotal + $quantity, 4);
                    else $usableTotal = round($usableTotal + $quantity, 4);
                } else {
                    StockBatch::create([
                        'inventory_item_id' => $item->id,
                        'quantity_received' => $quantity,
                        'quantity_remaining' => $quantity,
                        'purchased_at' => now()->toDateString(),
                        'purchased_by' => "Order #{$order->id} cancellation recovery",
                    ]);
                    $usableTotal = round($usableTotal + $quantity, 4);
                }
                $allocation->update(['restored_at' => now()]);
                $total = round($total + $quantity, 4);
            }

            $newQty = round($previousQty + $usableTotal, 4);
            $item->update(['quantity' => $newQty]);
            if ($usableTotal > self::EPSILON) {
                StockLog::create([
                    'inventory_item_id' => $item->id,
                    'item_name' => $item->name,
                    'type' => 'in',
                    'quantity' => $usableTotal,
                    'previous_qty' => $previousQty,
                    'new_qty' => $newQty,
                    'reason' => "Order #{$order->id} - Cancelled (exact FIFO restoration)",
                    'performed_by' => $performedBy,
                ]);
            }
            if ($expiredTotal > self::EPSILON) {
                StockLog::create([
                    'inventory_item_id' => $item->id,
                    'item_name' => $item->name,
                    'type' => 'in',
                    'quantity' => $expiredTotal,
                    'previous_qty' => $newQty,
                    'new_qty' => $newQty,
                    'reason' => "Order #{$order->id} - Cancelled quantity returned to Expired Stock quarantine",
                    'performed_by' => $performedBy,
                ]);
            }
            $restorations[] = sprintf('%s: %s → %s %s', $item->name, $this->formatQty($previousQty), $this->formatQty($newQty), $item->unit);
            $affectedIds[] = (int) $inventoryId;
        }

        $this->refreshMenuAvailability($affectedIds);
        return ['restorations' => $restorations];
    }

    private function restoreLegacyOrder(Order $order, string $performedBy): array
    {
        $order->load('items.menuItem.recipes.inventoryItem');
        $restorations = [];
        $affectedIds = [];
        foreach ($order->items as $orderItem) {
            foreach ($orderItem->menuItem?->recipes ?? [] as $recipe) {
                $item = InventoryItem::whereKey($recipe->inventory_item_id)->lockForUpdate()->first();
                if (!$item) continue;

                $quantity = round((float) $recipe->quantity_needed * $orderItem->quantity, 4);
                $previousQty = (float) $item->quantity;
                $newQty = round($previousQty + $quantity, 4);
                $item->update(['quantity' => $newQty]);
                StockBatch::create([
                    'inventory_item_id' => $item->id,
                    'quantity_received' => $quantity,
                    'quantity_remaining' => $quantity,
                    'purchased_at' => now()->toDateString(),
                    'purchased_by' => "Legacy order #{$order->id} cancellation",
                ]);
                StockLog::create([
                    'inventory_item_id' => $item->id,
                    'item_name' => $item->name,
                    'type' => 'in',
                    'quantity' => $quantity,
                    'previous_qty' => $previousQty,
                    'new_qty' => $newQty,
                    'reason' => "Order #{$order->id} - Cancelled (legacy restoration)",
                    'performed_by' => $performedBy,
                ]);
                $restorations[] = sprintf('%s: %s → %s %s', $item->name, $this->formatQty($previousQty), $this->formatQty($newQty), $item->unit);
                $affectedIds[] = $item->id;
            }
        }
        $this->refreshMenuAvailability(array_values(array_unique($affectedIds)));
        return ['restorations' => $restorations];
    }

    private function formatQty(float $quantity): string
    {
        return rtrim(rtrim(number_format($quantity, 4, '.', ''), '0'), '.');
    }
}
