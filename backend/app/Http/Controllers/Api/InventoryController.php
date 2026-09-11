<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\StockBatch;
use App\Models\StockLog;
use App\Services\BatchExpiryService;
use App\Services\StockDeductionService;
use Illuminate\Http\Request;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class InventoryController extends Controller
{
    public function index()
    {
        $this->synchronizeExpiredBatches();
        $items = InventoryItem::all()->map(function ($item) {
            return $this->appendStockData($item);
        });
        return response()->json($items);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'      => 'required|string',
            'category'  => 'required|string',
            'unit'      => 'required|string',
            'quantity'  => 'numeric|min:0',
            'min_stock' => 'numeric|min:0',
            'expires_at' => 'nullable|date|after_or_equal:today',
        ]);

        $quantity = round((float) ($validated['quantity'] ?? 0), 4);
        $performedBy = $request->user()?->full_name
            ?? $request->user()?->username
            ?? 'System';

        $item = DB::transaction(function () use ($validated, $quantity, $performedBy) {
            $item = InventoryItem::create($validated);

            if ($quantity > 0) {
                StockBatch::create([
                    'inventory_item_id'  => $item->id,
                    'quantity_received'  => $quantity,
                    'quantity_remaining' => $quantity,
                    'purchased_at'       => Carbon::today()->toDateString(),
                    'expires_at'         => $validated['expires_at'] ?? null,
                    'purchased_by'       => $performedBy,
                ]);

                StockLog::create([
                    'inventory_item_id' => $item->id,
                    'item_name'         => $item->name,
                    'type'              => 'in',
                    'quantity'          => $quantity,
                    'previous_qty'      => 0,
                    'new_qty'           => $quantity,
                    'reason'            => 'Initial stock recorded automatically when the item was created',
                    'performed_by'      => $performedBy,
                ]);
            }

            return $item;
        });

        return response()->json($this->appendStockData($item), 201);
    }

    public function show(InventoryItem $inventory)
    {
        $this->synchronizeExpiredBatches([$inventory->id]);
        return response()->json($this->appendStockData($inventory->fresh()));
    }

    public function update(Request $request, InventoryItem $inventory)
    {
        $validated = $request->validate([
            'name'      => 'sometimes|required|string',
            'category'  => 'sometimes|required|string',
            'unit'      => 'sometimes|required|string',
            'min_stock' => 'sometimes|required|numeric|min:0',
        ]);

        // Quantity changes must go through Stock In/Out so every movement
        // receives an automatic audit timestamp.
        $inventory->update($validated);
        return response()->json($this->appendStockData($inventory->fresh()));
    }

    public function destroy(InventoryItem $inventory)
    {
        $inventory->delete();
        return response()->json(['message' => 'Item deleted']);
    }

    public function stockAdjust(Request $request)
    {
        $user = $request->user();
        $allowedRoles = ['Admin', 'Purchaser', 'Kitchen Staff', 'Pastry'];

        if (!$user || !in_array($user->role, $allowedRoles, true)) {
            return response()->json(['message' => 'You are not allowed to update inventory stock.'], 403);
        }

        if (in_array($user->role, ['Kitchen Staff', 'Pastry'], true) && $request->input('type') !== 'out') {
            return response()->json(['message' => 'Kitchen staff can only record ingredients used.'], 403);
        }

        $request->validate([
            'item_id'      => 'required|exists:inventory_items,id',
            'type'         => 'required|in:in,out',
            'quantity'     => 'required|numeric|min:0.01',
            'reason'       => 'nullable|string',
            'performed_by' => 'nullable|string',
            'receipt'      => 'nullable|image|mimes:jpeg,png,jpg,gif|max:5120',
            'expires_at'   => 'nullable|date|after_or_equal:today',
        ]);

        $qty = round((float) $request->quantity, 4);
        $performedBy = $user->full_name ?? $user->username ?? 'System';
        $reason = $request->reason ?: ($request->type === 'out' ? 'Ingredient used by kitchen' : 'Stock added');

        $this->synchronizeExpiredBatches([(int) $request->item_id]);

        $receiptPath = null;
        if ($request->hasFile('receipt')) {
            $receiptPath = $request->file('receipt')->store('receipts', 'public');
        }

        try {
            [$item, $log, $previousQty, $newQty] = DB::transaction(function () use (
                $request, $qty, $performedBy, $reason, $receiptPath
            ) {
                $item = InventoryItem::whereKey($request->item_id)->lockForUpdate()->firstOrFail();
                $previousQty = round((float) $item->quantity, 4);

                if ($request->type === 'in') {
                    $newQty = round($previousQty + $qty, 4);
                    $item->update(['quantity' => $newQty]);
                    StockBatch::create([
                        'inventory_item_id' => $item->id,
                        'quantity_received' => $qty,
                        'quantity_remaining' => $qty,
                        'purchased_at' => Carbon::today()->toDateString(),
                        'expires_at' => $request->expires_at,
                        'purchased_by' => $performedBy,
                        'receipt_path' => $receiptPath,
                    ]);
                    $log = StockLog::create([
                        'inventory_item_id' => $item->id,
                        'item_name' => $item->name,
                        'type' => 'in',
                        'quantity' => $qty,
                        'previous_qty' => $previousQty,
                        'new_qty' => $newQty,
                        'reason' => $reason,
                        'performed_by' => $performedBy,
                        'receipt_path' => $receiptPath,
                    ]);
                } else {
                    $result = app(\App\Services\StockDeductionService::class)->deduct(
                        $item->id,
                        $qty,
                        $reason,
                        $performedBy,
                    );
                    if (!$result['success']) throw new \DomainException($result['message']);
                    $newQty = $result['new_qty'];
                    $log = StockLog::where('inventory_item_id', $item->id)->latest('id')->firstOrFail();
                    if ($receiptPath) $log->update(['receipt_path' => $receiptPath]);
                }

                return [$item->fresh(), $log, $previousQty, $newQty];
            });
        } catch (\DomainException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        // ── Refresh menu item availability after any stock change ──
        $service = new \App\Services\StockDeductionService();
        $service->refreshMenuAvailability([$item->id]);

        return response()->json([
            'item'    => $this->appendStockData($item->fresh()),
            'log'     => $log,
            'message' => "Stock {$request->type} successful. {$item->name}: {$previousQty} → {$newQty} {$item->unit}",
        ]);
    }

    /**
     * GET /api/inventory/{id}/batches
     * Returns FIFO batches for a specific item (oldest first)
     */
    public function batches(InventoryItem $inventory)
    {
        $this->synchronizeExpiredBatches([$inventory->id]);
        $categoryAlertDays = [
            'Meats'         => 3,
            'Vegetables&Fruits' => 5,
            'Drinks&Wine'   => 30,
            'For Baking'    => 14,
            'Grains'        => 30,
            'Condiments'    => 60,
        ];
        $alertDays = $categoryAlertDays[$inventory->category] ?? 7;

        $activeBatches = StockBatch::where('inventory_item_id', $inventory->id)
            ->active()
            ->where('quantity_remaining', '>', 0)
            ->orderBy('purchased_at', 'asc')
            ->orderBy('created_at', 'asc')
            ->orderBy('id', 'asc')
            ->get()
            ->map(fn ($batch) => $this->formatBatch($batch, $alertDays));

        $expiredBatches = StockBatch::where('inventory_item_id', $inventory->id)
            ->expired()
            ->where('quantity_remaining', '>', 0)
            ->orderByDesc('expired_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn ($batch) => $this->formatBatch($batch, $alertDays));

        return response()->json([
            'active' => $activeBatches,
            'expired' => $expiredBatches,
        ]);
    }

    public function logs()
    {
        $logs = StockLog::orderBy('created_at', 'desc')->get();
        return response()->json($logs->map(function ($log) {
            $data = $log->toArray();
            $data['receipt_url'] = $log->receipt_path
                ? asset('storage/' . $log->receipt_path)
                : null;
            return $data;
        }));
    }

    // ── Helper: attach stock timestamps and expiration summary ─────────────
    private function appendStockData(InventoryItem $item): array
    {
        $data = $item->toArray();
        $lastMovement = StockLog::where('inventory_item_id', $item->id)
            ->latest('created_at')
            ->latest('id')
            ->first();
        $data['last_stock_movement_at'] = $lastMovement?->created_at?->toIso8601String()
            ?? $item->updated_at?->toIso8601String();
        $data['last_stock_movement_type'] = $lastMovement?->type;
        $data['last_stock_movement_quantity'] = $lastMovement ? (float) $lastMovement->quantity : null;

        $nextExpiration = StockBatch::where('inventory_item_id', $item->id)
            ->active()
            ->where('quantity_remaining', '>', 0)
            ->whereNotNull('expires_at')
            ->orderBy('expires_at')
            ->orderBy('id', 'asc')
            ->first();
        $data['next_expiration_date'] = $nextExpiration?->expires_at?->toDateString();
        $data['next_expiration_days'] = $nextExpiration?->expires_at
            ? max(0, today()->diffInDays($nextExpiration->expires_at, false))
            : null;

        $expiredQuery = StockBatch::where('inventory_item_id', $item->id)
            ->expired()
            ->where('quantity_remaining', '>', 0);
        $data['expired_stock_entry_count'] = (clone $expiredQuery)->count();
        $data['expired_stock_quantity'] = round((float) $expiredQuery->sum('quantity_remaining'), 4);

        return $data;
    }

    public function expireBatch(Request $request, int $id)
    {
        $validated = $request->validate([
            'reason' => 'nullable|string|max:255',
        ]);
        $user = $request->user();
        $performedBy = $user?->full_name ?? $user?->username ?? 'System';
        $batch = StockBatch::findOrFail($id);
        $item = app(BatchExpiryService::class)->quarantineBatch(
            $batch,
            $performedBy,
            $validated['reason'] ?? 'Marked expired during stock inspection',
        );
        app(StockDeductionService::class)->refreshMenuAvailability([$item->id]);

        return response()->json([
            'message' => 'Batch moved to Expired Stock.',
            'item' => $this->appendStockData($item),
        ]);
    }

    public function disposeBatch(Request $request, int $id)
    {
        $validated = $request->validate([
            'reason' => 'required|string|max:255',
        ]);
        $batch = StockBatch::findOrFail($id);
        if (!$batch->expired_at && $batch->is_expired) {
            $user = $request->user();
            $performedBy = $user?->full_name ?? $user?->username ?? 'System';
            $item = app(BatchExpiryService::class)->quarantineBatch($batch, $performedBy, 'Expiration date reached');
            app(StockDeductionService::class)->refreshMenuAvailability([$item->id]);
            $batch->refresh();
        }
        if (!$batch->is_expired) {
            return response()->json(['message' => 'Only expired stock can be recorded as disposed.'], 422);
        }
        if ($batch->disposed_at) {
            return response()->json(['message' => 'This expired batch was already disposed.'], 422);
        }

        $user = $request->user();
        $performedBy = $user?->full_name ?? $user?->username ?? 'System';
        $batch->update([
            'disposed_at' => now(),
            'disposed_by' => $performedBy,
            'disposal_reason' => $validated['reason'],
        ]);

        return response()->json([
            'message' => 'Expired stock disposal recorded. The audit history was preserved.',
            'batch' => $this->formatBatch($batch->fresh(), 0),
        ]);
    }

    public function destroyBatch($id)
    {
        $batch = StockBatch::findOrFail($id);
        if ($batch->is_expired) {
            return response()->json([
                'message' => 'Expired batches are preserved for audit. Record their disposal instead of deleting them.',
            ], 409);
        }
        $item = InventoryItem::findOrFail($batch->inventory_item_id);

        if ($batch->quantity_remaining > 0) {
            $item->decrement('quantity', $batch->quantity_remaining);

            StockLog::create([
                'inventory_item_id' => $item->id,
                'item_name'         => $item->name,
                'type'              => 'out',
                'quantity'          => $batch->quantity_remaining,
                'previous_qty'      => $item->quantity + $batch->quantity_remaining,
                'new_qty'           => $item->quantity,
                'reason'            => 'Batch Deleted: ' . $batch->id,
                'performed_by'      => auth()->user() ? auth()->user()->name : 'System',
            ]);
        }

        $batch->delete();

        return response()->json([
            'message' => 'Batch deleted successfully',
            'item' => $this->appendStockData($item->fresh())
        ]);
    }

    private function synchronizeExpiredBatches(?array $inventoryItemIds = null): void
    {
        $affected = app(BatchExpiryService::class)->quarantineDueBatches($inventoryItemIds);
        if ($affected !== []) {
            app(StockDeductionService::class)->refreshMenuAvailability($affected);
        }
    }

    private function formatBatch(StockBatch $batch, int $alertDays): array
    {
        return [
            'id' => $batch->id,
            'quantity_received' => (float) $batch->quantity_received,
            'quantity_remaining' => (float) $batch->quantity_remaining,
            'purchased_at' => $batch->purchased_at->toDateString(),
            'received_at' => $batch->created_at?->toIso8601String(),
            'purchased_by' => $batch->purchased_by,
            'days_old' => $batch->days_old,
            'alert_days' => $alertDays,
            'days_until_alert' => max(0, $alertDays - $batch->days_old),
            'fifo_alert' => $alertDays > 0 && $batch->days_old >= $alertDays,
            'expires_at' => $batch->expires_at?->toDateString(),
            'expired_at' => $batch->expired_at?->toIso8601String(),
            'expired_by' => $batch->expired_by,
            'is_expired' => $batch->is_expired,
            'disposed_at' => $batch->disposed_at?->toIso8601String(),
            'disposed_by' => $batch->disposed_by,
            'disposal_reason' => $batch->disposal_reason,
            'receipt_url' => $batch->receipt_path ? asset('storage/' . $batch->receipt_path) : null,
        ];
    }
}
