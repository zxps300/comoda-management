<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\MenuItemController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\SaleController;
use App\Http\Controllers\Api\AttendanceController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ScheduleController;
use App\Http\Controllers\Api\SettingController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\FundRequestController;
use App\Http\Controllers\Api\RemovedItemController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\QrAccessController;

/*
|--------------------------------------------------------------------------
| PUBLIC ROUTES (NO AUTH)
|--------------------------------------------------------------------------
*/

// Auth (rate limited to 5 attempts per minute per IP to prevent brute-force attacks)
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:5,1');

// Digital Menu (PUBLIC — for QR code customer access, no auth required)
Route::get('/menu', function (\App\Services\ServingAvailabilityService $servings) {
    $items = \App\Models\MenuItem::with('recipes.inventoryItem')
        ->where('available', true)
        ->orderBy('category')
        ->orderBy('name')
        ->get()
        ->map(function ($item) use ($servings) {
            $availability = $servings->calculate($item);

            return [
                'id'          => $item->id,
                'name'        => $item->name,
                'category'    => $item->category,
                'price'       => (float) $item->price,
                'image'       => $item->thumbnail,
                'originalImage' => $item->image,
                'availableServings' => $availability['availableServings'],
                'maxQuantity' => $availability['availableServings'],
                'canServe' => $availability['canServe'],
                'available' => $availability['canServe'],
                'limitingIngredient' => $availability['limitingIngredient'],
            ];
        })
        ->filter(fn ($item) => $item['canServe'])
        ->values();

    $grouped = $items->groupBy('category');

    return response()->json([
        'restaurant' => config('app.name', 'Comoda Restaurant'),
        'items'      => $items,
        'categories' => $grouped,
        'updated_at' => now()->toISOString(),
    ]);
})->middleware('throttle:customer-menu');

// Table status check (PUBLIC — used by customer menu to check if table is occupied)
Route::get('/table-status/{table}', function (
    $table,
    \Illuminate\Http\Request $request,
    \App\Services\PermanentQrService $qr,
) {
    $table = (int) $table;
    if ($table < 1 || $table > 15) {
        return response()->json(['message' => 'Invalid table number. Tables are numbered 1–15 only.'], 422);
    }

    if (!$qr->hasValidTableSignature($table, $request->query('qr'))) {
        return response()->json(['message' => 'This table QR code is not valid. Please scan the printed QR code again.'], 403);
    }

    $activeOrder = \App\Models\Order::where('table_number', $table)
        ->whereNotIn('status', ['Cancelled', 'Completed'])
        ->first();

    return response()->json([
        'table'     => $table,
        'occupied'  => (bool) $activeOrder,
        'orderId'   => $activeOrder?->id,
        'status'    => $activeOrder?->status,
        'createdAt' => $activeOrder?->created_at?->toISOString(),
    ]);
})->middleware('throttle:customer-table-status');

// Customer Self-Order (PUBLIC — phone orders placed by customers via QR menu)
Route::post('/customer-order', function (
    \Illuminate\Http\Request $request,
    \App\Services\PermanentQrService $qr,
    \App\Services\ServingAvailabilityService $servings,
) {
    $request->validate([
        'tableNumber' => 'required|integer|min:1|max:15',
        'qrToken'     => 'required|string|size:22',
        'items'       => 'required|array|min:1',
        'items.*.menuItemId' => 'required|integer|exists:menu_items,id',
        'items.*.quantity'   => 'required|integer|min:1',
        'notes'       => 'nullable|string|max:500',
        'paymentMethod' => 'nullable|string|in:Cash,Online Payment',
    ], [
        'tableNumber.max' => 'Table limit reached (maximum 15 tables only).',
    ]);

    if (!$qr->hasValidTableSignature((int) $request->tableNumber, $request->qrToken)) {
        return response()->json(['message' => 'This table QR code is not valid. Please scan the printed QR code again.'], 403);
    }

    // A table remains occupied until kitchen/service completes or cancels it,
    // regardless of whether payment has already been collected.
    $existingOrder = \App\Models\Order::where('table_number', $request->tableNumber)
        ->whereNotIn('status', ['Cancelled', 'Completed'])
        ->first();

    if ($existingOrder) {
        return response()->json([
            'message' => 'Table ' . $request->tableNumber . ' is currently occupied. Please wait until the current order is completed or ask staff for assistance.',
            'occupiedBy' => [
                'orderId'   => $existingOrder->id,
                'status'    => $existingOrder->status,
                'createdAt' => $existingOrder->created_at?->toISOString(),
            ],
        ], 409);
    }

    // Fetch real prices from DB — never trust client-submitted prices
    $itemIds  = collect($request->items)->pluck('menuItemId');
    $dbItems  = \App\Models\MenuItem::with('recipes.inventoryItem')->whereIn('id', $itemIds)->where('available', true)->get()->keyBy('id');

    $orderItems = [];
    $subtotal   = 0;
    foreach ($request->items as $line) {
        $menuItem = $dbItems->get($line['menuItemId']);
        if (!$menuItem) continue; // skip unavailable items silently

        $reqQty = (int) $line['quantity'];

        // ── Validate stock limit ──
        $availableServings = $servings->calculate($menuItem)['availableServings'];
        if ($reqQty > $availableServings) {
            return response()->json(['message' => "Stock limit reached for {$menuItem->name}. Only {$availableServings} servings available."], 422);
        }

        $lineTotal   = (float) $menuItem->price * $reqQty;
        $subtotal   += $lineTotal;
        $orderItems[] = [
            'menu_item_id' => $menuItem->id,
            'name'         => $menuItem->name,
            'price'        => (float) $menuItem->price,
            'quantity'     => $reqQty,
        ];
    }

    if (empty($orderItems)) {
        return response()->json(['message' => 'No available items in your order.'], 422);
    }

    // Wrap occupancy, creation and combined-stock deduction in one transaction.
    try {
        [$order, $stockResult] = \Illuminate\Support\Facades\DB::transaction(function () use ($request, $orderItems, $subtotal) {
            $occupied = \App\Models\Order::where('table_number', $request->tableNumber)
                ->whereNotIn('status', ['Cancelled', 'Completed'])
                ->lockForUpdate()
                ->first();
            if ($occupied) {
                throw new \DomainException('Table ' . $request->tableNumber . ' is currently occupied. Please wait until the current order is completed.');
            }

            $orderDate = today()->toDateString();
            \Illuminate\Support\Facades\DB::table('daily_order_counters')->insertOrIgnore([
                'order_date' => $orderDate,
                'last_number' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $dailyCounter = \Illuminate\Support\Facades\DB::table('daily_order_counters')
                ->where('order_date', $orderDate)
                ->lockForUpdate()
                ->first();
            $dailyNumber = ((int) $dailyCounter->last_number) + 1;
            \Illuminate\Support\Facades\DB::table('daily_order_counters')->where('order_date', $orderDate)->update([
                'last_number' => $dailyNumber,
                'updated_at' => now(),
            ]);

            $order = \App\Models\Order::create([
            'table_number'  => $request->tableNumber,
            'customer_name' => 'Table ' . $request->tableNumber . ' (Self-Order)',
            'daily_number'  => $dailyNumber,
            'subtotal'      => $subtotal,
            'discount'      => 0,
            'tax'           => 0,
            'total'         => $subtotal,
            'status'        => 'Pending',
            'notes'         => $request->notes,
            'is_paid'       => false,
            'payment_method'=> $request->paymentMethod ?? 'Cash',
        ]);

            foreach ($orderItems as $item) {
                $order->items()->create($item);
            }

        // Record Transaction in Sale history immediately as PENDING
            \App\Models\Sale::create([
            'order_id'        => $order->id,
            'total'           => $order->total,
            'amount_received' => 0,
            'change_amount'   => 0,
            'cashier'         => 'Self-Order (QR)',
            'date'            => now()->toDateString(),
            'time'            => now()->format('h:i A'),
            ]);

        // Deduct recipe ingredients from inventory (same as POS cashier)
            $order->load('items');
            $stockResult = app(\App\Services\StockDeductionService::class)->deductForOrder($order, 'Self-Order (QR)');

            return [$order, $stockResult];
        }, 3);
    } catch (\DomainException $e) {
        $status = str_starts_with($e->getMessage(), 'Table ') ? 409 : 422;
        return response()->json(['message' => $e->getMessage()], $status);
    }

    return response()->json([
        'success'     => true,
        'orderId'     => $order->id,
        'tableNumber' => $order->table_number,
        'total'       => (float) $order->total,
        'status'      => $order->status,
        'items'       => $order->items->map(fn($i) => [
            'name' => $i->name, 'price' => (float)$i->price, 'quantity' => $i->quantity,
        ]),
        'createdAt'   => $order->created_at?->toISOString(),
        'message'     => 'Your order has been sent to the kitchen!',
        'stock_warnings'   => $stockResult['warnings'],
        'unavailable_items'=> $stockResult['unavailable_items'],
    ], 201);
})->middleware('throttle:customer-orders');

// Fallback login route (for unauthorized access)
Route::get('/login', function () {
    return response()->json(['message' => 'Unauthenticated.'], 401);
})->name('login');


/*
|--------------------------------------------------------------------------
| PROTECTED ROUTES (AUTH REQUIRED)
|--------------------------------------------------------------------------
*/

Route::middleware('auth:sanctum')->group(function () {

    // Auth
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/user', [AuthController::class, 'user']);

    // Dashboard (Protected — financial and order metrics)
    Route::get('/dashboard', [DashboardController::class, 'index']);

    // Notifications for every authenticated staff member
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/read', [NotificationController::class, 'markRead']);

    // QR menu addresses and connection status are visible only to signed-in staff.
    Route::get('/server-info', [QrAccessController::class, 'serverInfo']);
    Route::get('/qr/table-links', [QrAccessController::class, 'tableLinks']);
    Route::get('/cloudflare/status', [QrAccessController::class, 'status']);

    // ── ADMIN ONLY ROUTES ──────────────────────────────────────────────────
    Route::middleware('role:Admin')->group(function () {
        // User Management
        Route::get('/users/archived', [UserController::class, 'archived']);
        Route::post('/users/{id}/restore', [UserController::class, 'restore']);
        Route::delete('/users/{id}/force', [UserController::class, 'forceDelete']);
        Route::apiResource('users', UserController::class);

        Route::post('/notifications/announcements', [NotificationController::class, 'store']);

        // Schedules Management
        Route::apiResource('schedules', ScheduleController::class)->except(['show']);

        // Staff attendance (manual now, biometric/import ready)
        Route::get('/attendance/summary', [AttendanceController::class, 'summary']);
        Route::apiResource('attendance', AttendanceController::class)->except(['show']);

        // System Settings
        Route::get('/settings', [SettingController::class, 'index']);
        Route::post('/settings/bulk', [SettingController::class, 'bulkUpdate']);

        Route::post('/cloudflare/install', [QrAccessController::class, 'install']);

        // Reports (Financial and Operational)
        Route::get('/reports/daily', [ReportController::class, 'daily']);
        Route::get('/reports/monthly', [ReportController::class, 'monthly']);
        Route::get('/reports/custom', [ReportController::class, 'custom']);
        Route::get('/reports/inventory', [ReportController::class, 'inventory']);
        Route::get('/reports/all', [ReportController::class, 'all']);

        // Destructive Sales Actions
        Route::delete('/sales/delete-all', [SaleController::class, 'destroyAll']);
        Route::delete('/sales/{sale}', [SaleController::class, 'destroy']);
    });

    // ── FINANCIAL / CASH DRAWER RESTRICTED (Admin & Cashier) ───────────────
    Route::middleware('role:Admin,Cashier')->group(function () {
        Route::post('/fund-requests/{id}/release', [FundRequestController::class, 'release']);
        Route::post('/fund-requests/{id}/complete', [FundRequestController::class, 'complete']);
        Route::post('/cloudflare/start', [QrAccessController::class, 'start']);
        Route::post('/cloudflare/stop', [QrAccessController::class, 'stop']);
    });

    // ── STAFF OPERATIONAL ROUTES (Authenticated staff) ────────────────────
    // Menu Items
    Route::apiResource('menu-items', MenuItemController::class);
    Route::get('/menu-price-history', [MenuItemController::class, 'priceHistoryIndex']);
    Route::get('/menu-items/{menuItem}/price-history', [MenuItemController::class, 'priceHistory']);
    Route::get('/menu-items/{menuItem}/recipe', [MenuItemController::class, 'getRecipe']);
    Route::put('/menu-items/{menuItem}/recipe', [MenuItemController::class, 'updateRecipe']);

    // Inventory
    Route::get('/inventory/logs', [InventoryController::class, 'logs']);
    Route::get('/inventory/{inventory}/batches', [InventoryController::class, 'batches']);
    Route::get('/inventory', [InventoryController::class, 'index']);
    Route::get('/inventory/{inventory}', [InventoryController::class, 'show']);
    Route::middleware('role:Admin,Purchaser')->group(function () {
        Route::post('/inventory', [InventoryController::class, 'store']);
        Route::match(['put', 'patch'], '/inventory/{inventory}', [InventoryController::class, 'update']);
        Route::post('/inventory/batches/{id}/expire', [InventoryController::class, 'expireBatch']);
    });
    Route::middleware('role:Admin')->group(function () {
        Route::delete('/inventory/{inventory}', [InventoryController::class, 'destroy']);
        Route::delete('/inventory/batches/{id}', [InventoryController::class, 'destroyBatch']);
        Route::post('/inventory/batches/{id}/dispose', [InventoryController::class, 'disposeBatch']);
    });
    Route::middleware('role:Admin,Purchaser,Kitchen Staff,Pastry')->group(function () {
        Route::post('/inventory/stock', [InventoryController::class, 'stockAdjust']);
    });

    // Orders: viewing is operational; creation, kitchen progression and serving
    // have separate role boundaries. Orders are cancelled, never hard-deleted.
    Route::middleware('role:Admin,Cashier,Kitchen Staff,Bar,Pastry,Waiter')->group(function () {
        Route::get('/orders/kitchen-stats', [OrderController::class, 'kitchenStats']);
        Route::get('/orders', [OrderController::class, 'index']);
        Route::get('/orders/{order}', [OrderController::class, 'show']);
    });
    Route::middleware('role:Admin,Cashier,Bar')->group(function () {
        Route::post('/orders', [OrderController::class, 'store']);
    });
    Route::middleware('role:Admin,Cashier,Kitchen Staff,Bar,Pastry,Waiter')->group(function () {
        Route::match(['put', 'patch'], '/orders/{order}', [OrderController::class, 'update']);
    });

    // Sales are financial records. Only Admin and Cashier may view or settle them.
    Route::middleware('role:Admin,Cashier')->group(function () {
        Route::get('/sales', [SaleController::class, 'index']);
        Route::post('/sales', [SaleController::class, 'store']);
        Route::get('/sales/{sale}', [SaleController::class, 'show']);
    });

    // Removed / Cancelled Items Log
    Route::get('/removed-items', [RemovedItemController::class, 'index']);
    Route::post('/removed-items', [RemovedItemController::class, 'store']);

    // Expenses
    Route::apiResource('expenses', ExpenseController::class)->only(['index', 'store', 'update', 'destroy']);

    // Fund Requests
    Route::get('/fund-requests', [FundRequestController::class, 'index']);
    Route::post('/fund-requests', [FundRequestController::class, 'store']);
    Route::post('/fund-requests/{id}/liquidate', [FundRequestController::class, 'liquidate']);
    Route::post('/fund-requests/{id}/manager-approve', [FundRequestController::class, 'managerApprove']);
});


/*
|--------------------------------------------------------------------------
| FALLBACK (PREVENT CONFUSING 404)
|--------------------------------------------------------------------------
*/

Route::fallback(function () {
    return response()->json([
        'message' => 'API route not found'
    ], 404);
});
