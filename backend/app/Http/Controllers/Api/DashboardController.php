<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Sale;
use App\Models\Order;
use App\Models\InventoryItem;
use App\Models\MenuItem;
use App\Models\FundRequest;
use Illuminate\Support\Facades\Schema;

class DashboardController extends Controller
{
    public function index()
    {
        try {
            $today = now()->toDateString();
            $now   = now();

            // If core tables don't exist yet (migrations not run), return empty data
            if (!Schema::hasTable('sales') || !Schema::hasTable('orders')) {
                return response()->json($this->emptyData());
            }

            $todaySales   = Sale::with('order.items')
                ->whereDate('date', $today)
                ->whereHas('order', fn($q) => $q->where('is_paid', true)->where('status', '!=', 'Cancelled'))
                ->get();
            $todayRevenue = (float) $todaySales->sum('total');
            $activeOrders = Order::with('items')->whereIn('status', ['Pending', 'Preparing'])->get();
            $lowStockItems  = InventoryItem::whereColumn('quantity', '<=', 'min_stock')->get();
            $totalMenuItems = MenuItem::where('available', true)->count();

            $todayExpenses = 0;
            if (Schema::hasTable('fund_requests')) {
                $todayExpenses = FundRequest::where('status', 'completed')
                    ->whereDate('updated_at', $today)
                    ->sum('spent_amount');
            }
            if (Schema::hasTable('expenses')) {
                $todayExpenses += \App\Models\Expense::whereDate('date', $today)->sum('amount');
            }

            $weeklyData = [];
            $dayNames   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            $weekStart = $now->copy()->startOfWeek(\Carbon\Carbon::SUNDAY);
            for ($i = 0; $i < 7; $i++) {
                $d        = $weekStart->copy()->addDays($i);
                $daySales = Sale::whereDate('date', $d->toDateString())
                    ->whereHas('order', fn($q) => $q->where('is_paid', true)->where('status', '!=', 'Cancelled'))
                    ->get();
                $weeklyData[] = [
                    'day'   => $dayNames[$d->dayOfWeek],
                    'date'  => $d->toDateString(),
                    'total' => (float) $daySales->sum('total'),
                    'count' => $daySales->count(),
                ];
            }

            $thisMonthSales = Sale::with('order.items')
                ->whereYear('date', $now->year)
                ->whereMonth('date', $now->month)
                ->whereHas('order', fn($q) => $q->where('is_paid', true)->where('status', '!=', 'Cancelled'))
                ->get();
            $lastMonthDate  = $now->copy()->subMonth();
            $lastMonthSales = Sale::whereYear('date', $lastMonthDate->year)
                ->whereMonth('date', $lastMonthDate->month)
                ->whereHas('order', fn($q) => $q->where('is_paid', true)->where('status', '!=', 'Cancelled'))
                ->get();
            $thisMonthTotal = (float) $thisMonthSales->sum('total');
            $lastMonthTotal = (float) $lastMonthSales->sum('total');
            $monthGrowth    = $lastMonthTotal > 0
                ? round(($thisMonthTotal - $lastMonthTotal) / $lastMonthTotal * 100, 1)
                : null;

            $thisMonthExpenses = 0;
            if (Schema::hasTable('fund_requests')) {
                $thisMonthExpenses = FundRequest::where('status', 'completed')
                    ->whereYear('updated_at', $now->year)
                    ->whereMonth('updated_at', $now->month)
                    ->sum('spent_amount');
            }
            if (Schema::hasTable('expenses')) {
                $thisMonthExpenses += \App\Models\Expense::whereYear('date', $now->year)
                    ->whereMonth('date', $now->month)
                    ->sum('amount');
            }

            $todayNetIncome     = (float) ($todayRevenue - $todayExpenses);
            $thisMonthNetIncome = (float) ($thisMonthTotal - $thisMonthExpenses);

            $topItems = [];
            foreach ($thisMonthSales as $sale) {
                $sale->load('order.items');
                if (!$sale->order) continue;
                foreach ($sale->order->items as $item) {
                    $key = $item->name;
                    if (!isset($topItems[$key])) $topItems[$key] = ['name' => $key, 'qty' => 0, 'revenue' => 0];
                    $topItems[$key]['qty']     += $item->quantity;
                    $topItems[$key]['revenue'] += $item->price * $item->quantity;
                }
            }
            usort($topItems, fn($a, $b) => $b['qty'] - $a['qty']);

            return response()->json([
                'todayRevenue'          => $todayRevenue,
                'todayExpenses'         => (float) $todayExpenses,
                'todayNetIncome'        => $todayNetIncome,
                'activeOrders'          => $activeOrders->count(),
                'lowStockCount'         => $lowStockItems->count(),
                'totalMenuItems'        => $totalMenuItems,
                'weeklyData'            => $weeklyData,
                'weeklyTotal'           => array_sum(array_column($weeklyData, 'total')),
                'weeklyTransactions'    => array_sum(array_column($weeklyData, 'count')),
                'thisMonthTotal'        => $thisMonthTotal,
                'thisMonthExpenses'     => (float) $thisMonthExpenses,
                'thisMonthNetIncome'    => $thisMonthNetIncome,
                'thisMonthTransactions' => $thisMonthSales->count(),
                'lastMonthTotal'        => $lastMonthTotal,
                'lastMonthTransactions' => $lastMonthSales->count(),
                'monthGrowth'           => $monthGrowth,
                'topItems'              => array_slice(array_values($topItems), 0, 5),
                'lowStockItems'         => $lowStockItems->map(fn($i) => [
                    'name'     => $i->name,
                    'category' => $i->category,
                    'quantity' => $i->quantity,
                    'unit'     => $i->unit,
                    'minStock' => $i->min_stock,
                ]),
                'todaySales' => $todaySales->map(fn($s) => [
                    'id'    => $s->id,
                    'items' => $s->order ? $s->order->items->count() : 0,
                    'total' => (float) $s->total,
                    'time'  => $s->time,
                ]),
                'activeKitchenOrders' => $activeOrders->map(fn($o) => [
                    'id'          => $o->id,
                    'tableNumber' => $o->table_number,
                    'status'      => $o->status,
                    'isPaid'      => (bool) $o->is_paid,
                    'items'       => $o->items->map(fn($i) => ['name' => $i->name, 'quantity' => $i->quantity]),
                    'createdAt'   => $o->created_at?->toISOString(),
                ]),
                'activeOrdersList' => $activeOrders->map(fn($o) => [
                    'id'           => $o->id,
                    'customerName' => $o->customer_name,
                    'tableNumber'  => $o->table_number,
                    'items'        => $o->items->map(fn($i) => ['name' => $i->name, 'quantity' => $i->quantity]),
                    'total'        => (float) $o->total,
                    'status'       => $o->status,
                    'isPaid'       => (bool) $o->is_paid,
                    'createdAt'    => $o->created_at?->toISOString(),
                ]),
            ]);

        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Dashboard Error: ' . $e->getMessage(), ['exception' => $e]);
            return response()->json([
                'message' => 'An error occurred while loading dashboard data: ' . $e->getMessage()
            ], 500);
        }
    }

    private function emptyData(): array
    {
        return [
            'todayRevenue'          => 0,
            'activeOrders'          => 0,
            'lowStockCount'         => 0,
            'totalMenuItems'        => 0,
            'weeklyData'            => [],
            'weeklyTotal'           => 0,
            'weeklyTransactions'    => 0,
            'todayExpenses'         => 0,
            'thisMonthTotal'        => 0,
            'thisMonthExpenses'     => 0,
            'thisMonthTransactions' => 0,
            'lastMonthTotal'        => 0,
            'lastMonthTransactions' => 0,
            'monthGrowth'           => null,
            'topItems'              => [],
            'lowStockItems'         => [],
            'todaySales'            => [],
            'activeKitchenOrders'   => [],
            'activeOrdersList'      => [],
        ];
    }
}
