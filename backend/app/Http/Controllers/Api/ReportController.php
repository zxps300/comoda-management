<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Sale;
use App\Models\InventoryItem;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function daily(Request $request)
    {
        $date = $request->get('date', now()->toDateString());
        $sales = Sale::with('order.items.menuItem')
            ->whereDate('date', $date)
            ->whereHas('order', fn($q) => $q->where('is_paid', true)->where('status', '!=', 'Cancelled'))
            ->get();
        $total = $sales->sum('total');
        $count = $sales->count();
        $itemsSold = 0;
        $topItems = [];
        foreach ($sales as $sale) {
            if (!$sale->order) continue;
            foreach ($sale->order->items as $item) {
                $itemsSold += $item->quantity;
                $key = $item->name;
                if (!isset($topItems[$key])) $topItems[$key] = ['name' => $key, 'qty' => 0, 'revenue' => 0];
                $topItems[$key]['qty'] += $item->quantity;
                $topItems[$key]['revenue'] += $item->price * $item->quantity;
            }
        }
        usort($topItems, fn($a, $b) => $b['qty'] - $a['qty']);
        return response()->json([
            'date' => $date,
            'totalRevenue' => (float) $total,
            'transactionCount' => $count,
            'avgPerTransaction' => $count > 0 ? round($total / $count, 2) : 0,
            'itemsSold' => $itemsSold,
            'topItems' => array_slice(array_values($topItems), 0, 10),
            'transactions' => $sales->map(fn($s) => [
                'id' => $s->id, 'time' => $s->time,
                'items' => $s->order ? $s->order->items->count() : 0,
                'total' => (float) $s->total, 'cashier' => $s->cashier,
                'isPaid' => $s->order ? (bool)$s->order->is_paid : true,
            ]),
        ]);
    }

    public function monthly(Request $request)
    {
        $month = $request->get('month', now()->format('Y-m'));
        [$year, $m] = explode('-', $month);
        $sales = Sale::with('order.items.menuItem')
            ->whereYear('date', $year)
            ->whereMonth('date', $m)
            ->whereHas('order', fn($q) => $q->where('is_paid', true)->where('status', '!=', 'Cancelled'))
            ->get();
        $total = $sales->sum('total');
        $byDay = [];
        foreach ($sales as $sale) {
            $d = \Carbon\Carbon::parse($sale->date)->format('Y-m-d');
            if (!isset($byDay[$d])) $byDay[$d] = ['date' => $d, 'count' => 0, 'total' => 0];
            $byDay[$d]['count']++;
            $byDay[$d]['total'] += (float) $sale->total;
        }
        $days = array_values($byDay);
        usort($days, fn($a, $b) => strcmp($a['date'], $b['date']));
        $products = [];
        $categories = [];
        foreach ($sales as $sale) {
            if (!$sale->order) continue;
            foreach ($sale->order->items as $item) {
                $unitPrice = round((float) $item->price, 2);
                $productIdentity = $item->menu_item_id ?: mb_strtolower($item->name);
                $productKey = $productIdentity.'|'.number_format($unitPrice, 2, '.', '');
                $category = $item->menuItem?->category ?: 'Uncategorized';
                $lineRevenue = $unitPrice * (int) $item->quantity;

                if (!isset($products[$productKey])) {
                    $products[$productKey] = [
                        'menuItemId' => $item->menu_item_id,
                        'name' => $item->name,
                        'category' => $category,
                        'unitPrice' => $unitPrice,
                        'qty' => 0,
                        'revenue' => 0,
                    ];
                }
                $products[$productKey]['qty'] += (int) $item->quantity;
                $products[$productKey]['revenue'] += $lineRevenue;

                if (!isset($categories[$category])) {
                    $categories[$category] = ['category' => $category, 'qty' => 0, 'revenue' => 0];
                }
                $categories[$category]['qty'] += (int) $item->quantity;
                $categories[$category]['revenue'] += $lineRevenue;
            }
        }
        $products = array_values($products);
        $categories = array_values($categories);
        usort($products, fn($a, $b) => $b['revenue'] <=> $a['revenue']);
        usort($categories, fn($a, $b) => $b['revenue'] <=> $a['revenue']);
        return response()->json([
            'month' => $month, 'totalRevenue' => (float) $total,
            'transactionCount' => $sales->count(),
            'activeDays' => count($days),
            'dailyAverage' => count($days) > 0 ? round($total / count($days), 2) : 0,
            'dailyBreakdown' => $days,
            'topItems' => array_slice($products, 0, 10),
            'products' => $products,
            'categories' => $categories,
        ]);
    }

    public function custom(Request $request)
    {
        $from = $request->get('from', now()->subDays(7)->toDateString());
        $to = $request->get('to', now()->toDateString());
        
        $sales = Sale::with('order.items')
            ->whereBetween('date', [$from, $to])
            ->whereHas('order', fn($q) => $q->where('is_paid', true)->where('status', '!=', 'Cancelled'))
            ->get();
        $total = $sales->sum('total');
        
        $byDay = [];
        foreach ($sales as $sale) {
            $d = \Carbon\Carbon::parse($sale->date)->format('Y-m-d');
            if (!isset($byDay[$d])) $byDay[$d] = ['date' => $d, 'count' => 0, 'total' => 0];
            $byDay[$d]['count']++;
            $byDay[$d]['total'] += (float) $sale->total;
        }
        $days = array_values($byDay);
        usort($days, fn($a, $b) => strcmp($a['date'], $b['date']));
        
        $topItems = [];
        foreach ($sales as $sale) {
            if (!$sale->order) continue;
            foreach ($sale->order->items as $item) {
                $key = $item->name;
                if (!isset($topItems[$key])) $topItems[$key] = ['name' => $key, 'qty' => 0, 'revenue' => 0];
                $topItems[$key]['qty'] += $item->quantity;
                $topItems[$key]['revenue'] += $item->price * $item->quantity;
            }
        }
        usort($topItems, fn($a, $b) => $b['qty'] - $a['qty']);
        
        return response()->json([
            'from' => $from,
            'to' => $to,
            'totalRevenue' => (float) $total,
            'transactionCount' => $sales->count(),
            'activeDays' => count($days),
            'dailyAverage' => count($days) > 0 ? round($total / count($days), 2) : 0,
            'dailyBreakdown' => $days,
            'topItems' => array_slice(array_values($topItems), 0, 10),
        ]);
    }

    public function all(Request $request)
    {
        $sales = Sale::with('order.items')
            ->whereHas('order', fn($q) => $q->where('is_paid', true)->where('status', '!=', 'Cancelled'))
            ->orderBy('date', 'asc')
            ->get();
        $total = $sales->sum('total');
        $count = $sales->count();

        $byDay = [];
        foreach ($sales as $sale) {
            $d = \Carbon\Carbon::parse($sale->date)->format('Y-m-d');
            if (!isset($byDay[$d])) $byDay[$d] = ['date' => $d, 'count' => 0, 'total' => 0];
            $byDay[$d]['count']++;
            $byDay[$d]['total'] += (float) $sale->total;
        }
        $days = array_values($byDay);

        $topItems = [];
        foreach ($sales as $sale) {
            if (!$sale->order) continue;
            foreach ($sale->order->items as $item) {
                $key = $item->name;
                if (!isset($topItems[$key])) $topItems[$key] = ['name' => $key, 'qty' => 0, 'revenue' => 0];
                $topItems[$key]['qty'] += $item->quantity;
                $topItems[$key]['revenue'] += $item->price * $item->quantity;
            }
        }
        usort($topItems, fn($a, $b) => $b['qty'] - $a['qty']);

        return response()->json([
            'totalRevenue'     => (float) $total,
            'transactionCount' => $count,
            'activeDays'       => count($days),
            'dailyAverage'     => count($days) > 0 ? round($total / count($days), 2) : 0,
            'avgPerTransaction'=> $count > 0 ? round($total / $count, 2) : 0,
            'dailyBreakdown'   => $days,
            'topItems'         => array_slice(array_values($topItems), 0, 10),
            'transactions'     => $sales->map(fn($s) => [
                'id'       => $s->id,
                'date'     => $s->date ? \Carbon\Carbon::parse($s->date)->format('Y-m-d') : null,
                'time'     => $s->time,
                'items'    => $s->order ? $s->order->items->count() : 0,
                'total'    => (float) $s->total,
                'cashier'  => $s->cashier,
                'isPaid'   => $s->order ? (bool)$s->order->is_paid : true,
            ]),
        ]);
    }

    public function inventory()
    {
        $items = InventoryItem::all();
        $lowStock = $items->filter(fn($i) => $i->quantity <= $i->min_stock);
        $outOfStock = $items->filter(fn($i) => $i->quantity === 0);
        $categories = [];
        foreach ($items as $item) {
            if (!isset($categories[$item->category])) $categories[$item->category] = ['count' => 0, 'low' => 0];
            $categories[$item->category]['count']++;
            if ($item->quantity <= $item->min_stock) $categories[$item->category]['low']++;
        }
        return response()->json([
            'totalItems' => $items->count(),
            'wellStocked' => $items->count() - $lowStock->count(),
            'lowStock' => $lowStock->count(),
            'outOfStock' => $outOfStock->count(),
            'categories' => collect($categories)->map(fn($d, $c) => [
                'category' => $c, 'count' => $d['count'], 'low' => $d['low'],
            ])->values(),
            'items' => $items->map(fn($i) => [
                'name' => $i->name, 'category' => $i->category,
                'quantity' => $i->quantity, 'min_stock' => $i->min_stock, 'unit' => $i->unit,
                'status' => $i->quantity === 0 ? 'Out' : ($i->quantity <= $i->min_stock ? 'Low' : 'OK'),
            ]),
        ]);
    }
}
