<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FundRequest;
use App\Models\Expense;
use App\Models\StockBatch;
use App\Models\InventoryItem;
use App\Services\StockDeductionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;

class FundRequestController extends Controller
{
    public function index(Request $request)
    {
        $query = FundRequest::query()->orderBy('created_at', 'desc');
        
        if ($request->has('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        $requests = $query->get()->map(function ($req) {
            $data = $req->toArray();
            $data['receipt_url'] = $req->receipt_path ? asset('storage/' . $req->receipt_path) : null;
            return $data;
        });

        return response()->json($requests);
    }

    public function store(Request $request)
    {
        $request->validate([
            'purchaser_name' => 'required|string',
            'requested_amount' => 'required|numeric|min:0.01',
            'items_list' => 'required|array',
            'notes' => 'nullable|string',
        ]);

        $fundRequest = FundRequest::create([
            'purchaser_name' => $request->purchaser_name,
            'requested_amount' => $request->requested_amount,
            'items_list' => $request->items_list,
            'notes' => $request->notes,
            'status' => 'pending',
        ]);

        return response()->json($fundRequest, 201);
    }

    public function release(Request $request, $id)
    {
        $request->validate([
            'cashier_name' => 'required|string',
            'released_amount' => 'required|numeric|min:0.01',
        ]);

        $fundRequest = FundRequest::findOrFail($id);

        if ($fundRequest->status !== 'pending') {
            return response()->json(['message' => 'Request is not pending'], 400);
        }

        DB::beginTransaction();
        try {
            $fundRequest->update([
                'cashier_name' => $request->cashier_name,
                'released_amount' => $request->released_amount,
                'status' => 'released',
            ]);

            // Create Expense record (Cash Outflow)
            Expense::create([
                'date' => now()->toDateString(),
                'category' => 'Purchasing',
                'description' => "Fund Release for PR #{$fundRequest->id} to {$fundRequest->purchaser_name}",
                'amount' => $request->released_amount,
                'recorded_by' => $request->cashier_name,
                'fund_request_id' => $fundRequest->id
            ]);

            DB::commit();
            return response()->json($fundRequest);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to release funds: ' . $e->getMessage()], 500);
        }
    }

    public function liquidate(Request $request, $id)
    {
        // Decode purchased_items if it comes as a string (common with FormData/File upload)
        if ($request->has('purchased_items') && is_string($request->purchased_items)) {
            $decoded = json_decode($request->purchased_items, true);
            if (is_array($decoded)) {
                $request->merge(['purchased_items' => $decoded]);
            }
        }

        $request->validate([
            'spent_amount' => 'required|numeric|min:0',
            'purchased_items' => 'required|array', // Array of items with item_id, qty, cost, supplier
            'purchased_items.*.inventory_item_id' => 'required|exists:inventory_items,id',
            'purchased_items.*.qty' => 'required|numeric|min:0.01',
            'purchased_items.*.cost' => 'nullable|numeric|min:0',
            'purchased_items.*.supplier' => 'nullable|string|max:255',
            'receipt' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:5120',
        ]);

        $fundRequest = FundRequest::findOrFail($id);

        if ($fundRequest->status !== 'released') {
            return response()->json(['message' => 'Cannot liquidate a non-released request'], 400);
        }

        DB::beginTransaction();
        try {
            $affectedInventoryIds = [];
            $receiptPath = null;
            if ($request->hasFile('receipt')) {
                $receiptPath = $request->file('receipt')->store('receipts', 'public');
            }

            // Create Stock Batches for each item
            foreach ($request->purchased_items as $pItem) {
                $inventoryItem = InventoryItem::findOrFail($pItem['inventory_item_id']);
                $quantity = round((float) $pItem['qty'], 4);
                
                StockBatch::create([
                    'inventory_item_id' => $inventoryItem->id,
                    'quantity_received' => $quantity,
                    'quantity_remaining' => $quantity,
                    'purchased_at' => now()->toDateString(),
                    'purchased_by' => $fundRequest->purchaser_name,
                    'receipt_path' => $receiptPath,
                    'supplier_name' => $pItem['supplier'] ?? 'Unknown',
                    'purchase_cost' => $pItem['cost'] ?? 0,
                    'fund_request_id' => $fundRequest->id,
                ]);

                // Update total quantity in inventory
                $inventoryItem->increment('quantity', $quantity);
                $affectedInventoryIds[] = (int) $inventoryItem->id;
            }

            $returnedChange = max(0, $fundRequest->released_amount - $request->spent_amount);
            $overspent = $request->spent_amount > $fundRequest->released_amount;

            $fundRequest->update([
                'spent_amount' => $request->spent_amount,
                'returned_change' => $returnedChange,
                'receipt_path' => $receiptPath,
                'status' => $overspent ? 'manager_review' : 'liquidating', 
            ]);

            // A purchasing liquidation is also a stock-in operation. Refresh every
            // recipe that uses the purchased ingredients before committing so menu
            // items become available again as soon as their stock is sufficient.
            app(StockDeductionService::class)->refreshMenuAvailability(
                array_values(array_unique($affectedInventoryIds))
            );

            DB::commit();
            return response()->json($fundRequest);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Liquidation failed: ' . $e->getMessage()], 500);
        }
    }

    public function managerApprove(Request $request, $id)
    {
        $request->validate([
            'action' => 'required|in:approve,reject',
        ]);

        $fundRequest = FundRequest::findOrFail($id);

        if ($fundRequest->status !== 'manager_review') {
            return response()->json(['message' => 'Request is not under manager review'], 400);
        }

        $fundRequest->update([
            'manager_approval_status' => $request->action === 'approve' ? 'approved' : 'rejected',
            'status' => 'liquidating', // Move to cashier confirmation stage regardless of manager choice, or handle rejection
        ]);

        // If approved, we might need to adjust the expense to the higher spent amount immediately
        if ($request->action === 'approve') {
            $expense = Expense::where('fund_request_id', $fundRequest->id)->first();
            if ($expense) {
                $expense->update(['amount' => $fundRequest->spent_amount]);
            }
        }

        return response()->json($fundRequest);
    }

    public function complete(Request $request, $id)
    {
        $fundRequest = FundRequest::findOrFail($id);

        if ($fundRequest->status !== 'liquidating') {
            return response()->json(['message' => 'Request is not awaiting completion by cashier'], 400);
        }

        DB::beginTransaction();
        try {
            // The cashier acknowledges the receipt and any returned change.
            $fundRequest->update([
                'status' => 'completed',
            ]);

            // Finalize Expense: Original released_amount was recorded. 
            // We adjust it to the EXACT spent_amount. Unused funds effectively return to balance.
            $expense = Expense::where('fund_request_id', $fundRequest->id)->first();
            if ($expense) {
                $expense->update([
                    'amount' => $fundRequest->spent_amount,
                ]);
            }

            DB::commit();
            return response()->json($fundRequest);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Completion failed: ' . $e->getMessage()], 500);
        }
    }
}
