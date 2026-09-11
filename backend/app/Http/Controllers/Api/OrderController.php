<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Sale;
use App\Services\OrderPricingService;
use App\Services\StockDeductionService;
use DomainException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OrderController extends Controller
{
    public function index(Request $request)
    {
        $query = Order::with('items');
        if ($request->has('status')) {
            $query->whereIn('status', explode(',', $request->status));
        }
        if ($request->boolean('only_paid')) {
            $query->where('is_paid', true);
        }
        $orders = $query->orderBy('created_at', 'desc')->get();
        return response()->json($orders->map(fn($o) => [
            'id'            => $o->id,
            'tableNumber'   => $o->table_number,
            'customerName'  => $o->customer_name,
            'orderType'     => $o->order_type ?? 'Dine In',
            'takeOutNumber' => $o->take_out_number,
            'dailyNumber'   => $o->daily_number,
            'items' => $o->items->map(fn($i) => [
                'menuItemId' => $i->menu_item_id, 'name' => $i->name,
                'price' => (float) $i->price, 'quantity' => $i->quantity,
            ]),
            'subtotal'      => (float) $o->subtotal,
            'discount'      => (float) $o->discount,
            'tax'           => (float) $o->tax,
            'total'         => (float) $o->total,
            'status'        => $o->status,
            'notes'         => $o->notes,
            'isPaid'        => (bool) $o->is_paid,
            'paymentMethod' => $o->payment_method,
            'createdAt'     => $o->created_at?->toISOString(),
        ]));
    }

    public function store(Request $request)
    {
        $orderType = $request->input('orderType', 'Dine In');

        $rules = [
            'items' => 'required|array|min:1',
            'items.*.menuItemId' => 'required|integer|exists:menu_items,id',
            'items.*.variantId' => 'nullable|integer|exists:menu_item_variants,id',
            'items.*.quantity' => 'required|integer|min:1|max:999',
            'discount' => 'nullable|numeric|min:0',
            'isPaid' => 'boolean',
            'paymentMethod' => 'nullable|in:Cash,Online Payment',
            'amountReceived' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string|max:500',
            'orderType' => 'required|in:Dine In,Take Out',
        ];

        if ($orderType === 'Dine In') {
            $rules['tableNumber'] = 'required|integer|min:1|max:15';
        }

        $request->validate($rules, [
            'tableNumber.max' => 'Table limit reached (maximum 15 tables only).',
        ]);

        $user = $request->user();
        $isPaid = $request->boolean('isPaid');
        if ($isPaid && !in_array($user?->role, ['Admin', 'Cashier'], true)) {
            return response()->json(['message' => 'Only an Admin or Cashier can accept payment.'], 403);
        }

        $priced = app(OrderPricingService::class)->price($request->items, $orderType);
        $subtotal = $priced['subtotal'];
        $discount = round((float) ($request->discount ?? 0), 2);
        if ($discount > $subtotal) {
            return response()->json(['message' => 'Discount cannot exceed the subtotal.'], 422);
        }
        $tax = 0.0;
        $total = round(max(0, $subtotal - $discount) + $tax, 2);
        $paymentMethod = $isPaid ? ($request->paymentMethod ?? 'Cash') : null;
        $amountReceived = $isPaid ? round((float) ($request->amountReceived ?? 0), 2) : 0.0;

        if ($isPaid && $paymentMethod === 'Cash') {
            $cashErr = SaleController::validateCashBanknote($amountReceived, $total);
            if ($cashErr) {
                return response()->json(['message' => $cashErr], 422);
            }
        }
        if ($isPaid && $amountReceived < $total) {
            return response()->json(['message' => 'Amount received cannot be less than the order total.'], 422);
        }
        $changeAmount = $isPaid ? round($amountReceived - $total, 2) : 0.0;

        $cashierName = $user?->full_name
            ?? $user?->username
            ?? 'Cashier';

        try {
            [$order, $stockResult] = DB::transaction(function () use (
                $request, $orderType, $priced, $subtotal, $discount, $tax, $total,
                $isPaid, $paymentMethod, $amountReceived, $changeAmount, $cashierName
            ) {
                $takeOutNumber = null;
                if ($orderType === 'Dine In') {
                    $existingOrder = Order::where('table_number', $request->tableNumber)
                        ->whereNotIn('status', ['Cancelled', 'Completed'])
                        ->lockForUpdate()
                        ->first();
                    if ($existingOrder) {
                        throw new DomainException('Table ' . $request->tableNumber . ' is currently occupied (Order #' . $existingOrder->id . '). Complete or cancel it first.');
                    }
                } else {
                    $orderDate = today()->toDateString();
                    DB::table('take_out_counters')->insertOrIgnore([
                        'order_date' => $orderDate,
                        'last_number' => 0,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                    $counter = DB::table('take_out_counters')
                        ->where('order_date', $orderDate)
                        ->lockForUpdate()
                        ->first();
                    $takeOutNumber = ((int) $counter->last_number) + 1;
                    DB::table('take_out_counters')->where('order_date', $orderDate)->update([
                        'last_number' => $takeOutNumber,
                        'updated_at' => now(),
                    ]);
                }

                $orderDate = today()->toDateString();
                DB::table('daily_order_counters')->insertOrIgnore([
                    'order_date' => $orderDate,
                    'last_number' => 0,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $dailyCounter = DB::table('daily_order_counters')
                    ->where('order_date', $orderDate)
                    ->lockForUpdate()
                    ->first();
                $dailyNumber = ((int) $dailyCounter->last_number) + 1;
                DB::table('daily_order_counters')->where('order_date', $orderDate)->update([
                    'last_number' => $dailyNumber,
                    'updated_at' => now(),
                ]);

                $order = Order::create([
                    'table_number' => $orderType === 'Dine In' ? $request->tableNumber : null,
                    'customer_name' => $orderType === 'Dine In' ? 'Table ' . $request->tableNumber : 'Take Out #' . $takeOutNumber,
                    'order_type' => $orderType,
                    'take_out_number' => $takeOutNumber,
                    'daily_number' => $dailyNumber,
                    'subtotal' => $subtotal,
                    'discount' => $discount,
                    'tax' => $tax,
                    'total' => $total,
                    'status' => 'Pending',
                    'notes' => $request->notes,
                    'is_paid' => $isPaid,
                    'payment_method' => $paymentMethod,
                    'amount_received' => $amountReceived,
                    'change_amount' => $changeAmount,
                ]);

                foreach ($priced['items'] as $item) $order->items()->create($item);

                if ($isPaid) {
                    Sale::create([
                        'order_id' => $order->id,
                        'total' => $total,
                        'amount_received' => $amountReceived,
                        'change_amount' => $changeAmount,
                        'cashier' => $cashierName,
                        'date' => now()->toDateString(),
                        'time' => now()->format('h:i A'),
                    ]);
                }

                $stockResult = app(StockDeductionService::class)->deductForOrder($order, $cashierName);
                return [$order, $stockResult];
            }, 3);
        } catch (DomainException $e) {
            $status = str_starts_with($e->getMessage(), 'Table ') ? 409 : 422;
            return response()->json(['message' => $e->getMessage()], $status);
        }

        return response()->json([
            'id'            => $order->id,
            'tableNumber'   => $order->table_number,
            'orderType'     => $order->order_type,
            'takeOutNumber' => $order->take_out_number,
            'total'         => (float) $order->total,
            'status'        => $order->status,
            'isPaid'        => (bool) $order->is_paid,
            'createdAt'     => $order->created_at?->toISOString(),
            'stock_deductions' => $stockResult['deductions'],
            'stock_warnings'   => $stockResult['warnings'],
            'unavailable_items'=> $stockResult['unavailable_items'],
        ], 201);
    }

    public function show(Order $order)
    {
        $order->load('items');
        return response()->json([
            'id'            => $order->id,
            'tableNumber'   => $order->table_number,
            'customerName'  => $order->customer_name,
            'orderType'     => $order->order_type ?? 'Dine In',
            'takeOutNumber' => $order->take_out_number,
            'items' => $order->items->map(fn($i) => [
                'menuItemId' => $i->menu_item_id, 'name' => $i->name,
                'price' => (float) $i->price, 'quantity' => $i->quantity,
            ]),
            'subtotal'      => (float) $order->subtotal,
            'discount'      => (float) $order->discount,
            'tax'           => (float) $order->tax,
            'total'         => (float) $order->total,
            'status'        => $order->status,
            'notes'         => $order->notes,
            'isPaid'        => (bool) $order->is_paid,
            'paymentMethod' => $order->payment_method,
            'createdAt'     => $order->created_at?->toISOString(),
        ]);
    }

    public function update(Request $request, Order $order)
    {
        $validated = $request->validate([
            'status' => 'required|in:Pending,Preparing,Ready,Completed,Cancelled',
        ]);
        $newStatus = $validated['status'];
        $role = $request->user()?->role;

        $allowedTargets = match ($role) {
            'Admin' => ['Preparing', 'Ready', 'Completed', 'Cancelled'],
            'Cashier' => ['Cancelled'],
            'Kitchen Staff', 'Bar', 'Pastry' => ['Preparing', 'Ready'],
            'Waiter' => ['Completed'],
            default => [],
        };
        if (!in_array($newStatus, $allowedTargets, true)) {
            return response()->json(['message' => 'You are not allowed to perform this order action.'], 403);
        }

        $result = ['deductions' => [], 'warnings' => [], 'unavailable_items' => []];
        try {
            DB::transaction(function () use ($order, $newStatus, $request, &$result) {
                $lockedOrder = Order::whereKey($order->id)->lockForUpdate()->firstOrFail();
                $oldStatus = $lockedOrder->status;
                if ($oldStatus === $newStatus) return;

                $transitions = [
                    'Pending' => ['Preparing', 'Cancelled'],
                    'Preparing' => ['Ready', 'Cancelled'],
                    'Ready' => ['Completed', 'Cancelled'],
                    'Completed' => [],
                    'Cancelled' => [],
                ];
                if (!in_array($newStatus, $transitions[$oldStatus] ?? [], true)) {
                    throw new DomainException("Order cannot move from {$oldStatus} to {$newStatus}.");
                }

                $service = app(StockDeductionService::class);
                $performer = $request->user()?->full_name ?? $request->user()?->username ?? 'Staff';

                if ($newStatus === 'Preparing') {
                    $hasAllocations = \App\Models\OrderStockDeduction::where('order_id', $lockedOrder->id)->exists();
                    $hasLegacyDeduction = \App\Models\StockLog::where('reason', 'like', "Order #{$lockedOrder->id}%")
                        ->where('type', 'out')->exists();
                    if (!$hasAllocations && !$hasLegacyDeduction) {
                        $result = $service->deductForOrder($lockedOrder, $performer);
                    }
                }

                if ($newStatus === 'Cancelled') {
                    $hasAllocations = \App\Models\OrderStockDeduction::where('order_id', $lockedOrder->id)
                        ->whereNull('restored_at')->exists();
                    $hasLegacyDeduction = \App\Models\StockLog::where('reason', 'like', "Order #{$lockedOrder->id}%")
                        ->where('type', 'out')->exists();
                    $alreadyRestored = \App\Models\StockLog::where('reason', 'like', "Order #{$lockedOrder->id}%")
                        ->where('type', 'in')->exists();
                    if ($hasAllocations || ($hasLegacyDeduction && !$alreadyRestored)) {
                        $service->restoreForOrder($lockedOrder, $performer);
                    }
                }

                $lockedOrder->update(['status' => $newStatus]);
            });
        } catch (DomainException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $order->refresh();

        return response()->json([
            'id'     => $order->id,
            'status' => $order->status,
            'isPaid' => (bool) $order->is_paid,
            'message'=> 'Order updated',
            'stock_deductions' => $result['deductions'],
            'stock_warnings' => $result['warnings'],
            'unavailable_items' => $result['unavailable_items'],
        ]);
    }

    public function kitchenStats(Request $request)
    {
        $tz  = 'Asia/Manila';
        $now = \Carbon\Carbon::now($tz);

        $todayCount = \App\Models\Order::where('status', 'Completed')
            ->whereBetween('updated_at', [$now->copy()->startOfDay(), $now->copy()->endOfDay()])
            ->count();

        $monthCount = \App\Models\Order::where('status', 'Completed')
            ->whereBetween('updated_at', [$now->copy()->startOfMonth(), $now->copy()->endOfMonth()])
            ->count();

        $from = $request->query('from');
        $to   = $request->query('to');

        $queryFrom = $from ? \Carbon\Carbon::parse($from, $tz)->startOfDay() : $now->copy()->startOfDay();
        $queryTo   = $to ? \Carbon\Carbon::parse($to, $tz)->endOfDay() : $now->copy()->endOfDay();

        $q = \App\Models\Order::with('items')->where('status', 'Completed')
            ->whereBetween('updated_at', [$queryFrom, $queryTo]);
            
        $rangeCount = $q->count();
        $rangeOrders = $q->orderBy('updated_at', 'desc')->get()->map(fn($o) => [
            'id' => $o->id,
            'tableNumber' => $o->table_number,
            'customerName' => $o->customer_name,
            'items' => $o->items->map(fn($i) => [
                'menuItemId' => $i->menu_item_id, 'name' => $i->name,
                'price' => (float) $i->price, 'quantity' => $i->quantity,
            ]),
            'subtotal' => (float) $o->subtotal,
            'discount' => (float) $o->discount,
            'tax' => (float) $o->tax,
            'total' => (float) $o->total,
            'status' => $o->status,
            'notes' => $o->notes,
            'isPaid' => (bool) $o->is_paid,
            'createdAt' => $o->created_at?->toISOString(),
        ]);

        return response()->json([
            'today'        => $todayCount,
            'month'        => $monthCount,
            'month_label'  => $now->format('F Y'),
            'range'        => $rangeCount,
            'range_from'   => $from,
            'range_to'     => $to,
            'range_orders' => $rangeOrders,
        ]);
    }
}
