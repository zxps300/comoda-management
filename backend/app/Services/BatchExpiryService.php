<?php

namespace App\Services;

use App\Models\InventoryItem;
use App\Models\StockBatch;
use App\Models\StockLog;
use Illuminate\Support\Facades\DB;

class BatchExpiryService
{
    /**
     * Move every due batch out of usable inventory exactly once.
     *
     * @return int[] affected inventory item IDs
     */
    public function quarantineDueBatches(?array $inventoryItemIds = null, string $performedBy = 'System'): array
    {
        return DB::transaction(function () use ($inventoryItemIds, $performedBy) {
            $query = StockBatch::query()
                ->whereNull('expired_at')
                ->whereNotNull('expires_at')
                ->whereDate('expires_at', '<', today())
                ->where('quantity_remaining', '>', 0);

            if ($inventoryItemIds !== null) {
                $query->whereIn('inventory_item_id', $inventoryItemIds);
            }

            $affected = [];
            foreach ($query->orderBy('inventory_item_id')->orderBy('id')->lockForUpdate()->get() as $batch) {
                $this->quarantineLockedBatch($batch, $performedBy, 'Expiration date reached');
                $affected[] = (int) $batch->inventory_item_id;
            }

            return array_values(array_unique($affected));
        });
    }

    public function quarantineBatch(StockBatch $batch, string $performedBy, string $reason = 'Marked expired'): InventoryItem
    {
        return DB::transaction(function () use ($batch, $performedBy, $reason) {
            $lockedBatch = StockBatch::whereKey($batch->id)->lockForUpdate()->firstOrFail();
            return $this->quarantineLockedBatch($lockedBatch, $performedBy, $reason);
        });
    }

    private function quarantineLockedBatch(StockBatch $batch, string $performedBy, string $reason): InventoryItem
    {
        $item = InventoryItem::whereKey($batch->inventory_item_id)->lockForUpdate()->firstOrFail();
        if ($batch->expired_at) return $item;

        $expiredQuantity = round((float) $batch->quantity_remaining, 4);
        $previousQty = round((float) $item->quantity, 4);
        $newQty = max(0, round($previousQty - $expiredQuantity, 4));

        $batch->update([
            'expired_at' => now(),
            'expired_by' => $performedBy,
        ]);
        $item->update(['quantity' => $newQty]);

        if ($expiredQuantity > 0) {
            StockLog::create([
                'inventory_item_id' => $item->id,
                'item_name' => $item->name,
                'type' => 'out',
                'quantity' => $expiredQuantity,
                'previous_qty' => $previousQty,
                'new_qty' => $newQty,
                'reason' => "Expired stock quarantined (Batch #{$batch->id}): {$reason}",
                'performed_by' => $performedBy,
            ]);
        }

        return $item->fresh();
    }
}
