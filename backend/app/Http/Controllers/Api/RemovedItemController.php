<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RemovedOrderItem;
use Illuminate\Http\Request;

class RemovedItemController extends Controller
{
    /**
     * GET /api/removed-items
     * List all removed order items, newest first.
     */
    public function index()
    {
        $items = RemovedOrderItem::orderBy('created_at', 'desc')->get();

        return response()->json($items->map(fn($i) => [
            'id'        => $i->id,
            'orderId'   => $i->order_id,
            'itemName'  => $i->item_name,
            'price'     => (float) $i->price,
            'quantity'  => $i->quantity,
            'cashier'   => $i->cashier,
            'reason'    => $i->reason,
            'removedAt' => $i->created_at?->toISOString(),
        ]));
    }

    /**
     * POST /api/removed-items
     * Log a removed/cancelled item.
     */
    public function store(Request $request)
    {
        $request->validate([
            'itemName'  => 'required|string|max:255',
            'price'     => 'required|numeric|min:0',
            'quantity'  => 'required|integer|min:1',
            'cashier'   => 'nullable|string|max:255',
            'orderId'   => 'nullable|integer',
            'reason'    => 'nullable|string|max:500',
        ]);

        $item = RemovedOrderItem::create([
            'order_id'  => $request->orderId,
            'item_name' => $request->itemName,
            'price'     => $request->price,
            'quantity'  => $request->quantity,
            'cashier'   => $request->cashier,
            'reason'    => $request->reason,
        ]);

        return response()->json([
            'id'        => $item->id,
            'orderId'   => $item->order_id,
            'itemName'  => $item->item_name,
            'price'     => (float) $item->price,
            'quantity'  => $item->quantity,
            'cashier'   => $item->cashier,
            'reason'    => $item->reason,
            'removedAt' => $item->created_at?->toISOString(),
        ], 201);
    }
}
