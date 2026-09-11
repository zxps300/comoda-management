<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Sale;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SaleController extends Controller
{
    public function index(Request $request)
    {
        // A GET request must never create or alter financial records.
        $query = Sale::with('order.items')
            ->whereHas('order', fn ($q) => $q->where('is_paid', true));
        if ($request->has('date')) {
            $query->whereDate('date', $request->date);
        }
        $sales = $query->orderBy('created_at', 'desc')->get();
        return response()->json($sales->map(fn($s) => $this->formatSale($s)));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'orderId' => 'required|exists:orders,id',
            'amountReceived' => 'required|numeric|min:0',
            'paymentMethod' => 'nullable|in:Cash,Online Payment',
        ]);

        $method = $validated['paymentMethod'] ?? 'Cash';
        $amountReceived = round((float) $validated['amountReceived'], 2);
        $cashier = $request->user()?->full_name ?? $request->user()?->username ?? 'Cashier';

        $result = DB::transaction(function () use ($validated, $method, $amountReceived, $cashier) {
            $order = Order::with('items')->whereKey($validated['orderId'])->lockForUpdate()->firstOrFail();
            if ($order->status === 'Cancelled') {
                return ['error' => 'A cancelled order cannot be paid.'];
            }

            $total = round((float) $order->total, 2);
            if ($method === 'Cash') {
                $cashErr = self::validateCashBanknote($amountReceived, $total);
                if ($cashErr) return ['error' => $cashErr];
            } elseif ($amountReceived < $total) {
                return ['error' => 'Amount received cannot be less than the order total.'];
            }

            $change = round($amountReceived - $total, 2);
            $now = now();
            $sale = Sale::updateOrCreate(
                ['order_id' => $order->id],
                [
                    'total' => $total,
                    'amount_received' => $amountReceived,
                    'change_amount' => $change,
                    'cashier' => $cashier,
                    'date' => $now->toDateString(),
                    'time' => $now->format('h:i A'),
                ],
            );

            // Payment and kitchen fulfilment are separate lifecycles.
            $order->update([
                'is_paid' => true,
                'payment_method' => $method,
                'amount_received' => $amountReceived,
                'change_amount' => $change,
            ]);

            return ['sale' => $sale];
        });

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], 422);
        }

        $sale = $result['sale'];

        $sale->load('order.items');
        return response()->json($this->formatSale($sale), 200);
    }

    public function show(Sale $sale)
    {
        $sale->load('order.items');
        return response()->json($this->formatSale($sale));
    }

    public function destroy(Sale $sale)
    {
        $sale->delete();
        return response()->json(['message' => 'Transaction record deleted successfully.']);
    }

    public function destroyAll()
    {
        Sale::query()->delete();
        return response()->json(['message' => 'All transaction records deleted successfully.']);
    }

    // ── Shared formatter ──────────────────────────────────────────────────────
    private function formatSale(Sale $s): array
    {
        $order = $s->order;
        $items = $order
            ? $order->items->map(fn($i) => [
                'name'     => $i->name,
                'price'    => (float) $i->price,
                'quantity' => $i->quantity,
                'subtotal' => round((float) $i->price * $i->quantity, 2),
            ])
            : [];

        $totalQty = $items->sum('quantity');
        $isPaid = $order ? (bool)$order->is_paid : true;
        $paymentStatus = $isPaid ? 'PAID' : 'PENDING';

        return [
            'id'             => $s->id,
            'transactionId'  => $s->transaction_id ?? ('TXN-' . str_pad($s->id, 5, '0', STR_PAD_LEFT)),
            'transaction_id' => $s->transaction_id ?? ('TXN-' . str_pad($s->id, 5, '0', STR_PAD_LEFT)),
            'orderId'        => $s->order_id,
            'items'          => $items,
            'itemCount'      => $items->count(),
            'totalQty'       => $totalQty,
            'subtotal'       => $order ? (float) $order->subtotal : (float) $s->total,
            'discount'       => $order ? (float) $order->discount : 0,
            'tax'            => $order ? (float) $order->tax      : 0,
            'total'          => (float) $s->total,
            'amountReceived' => (float) $s->amount_received,
            'amount_received'=> (float) $s->amount_received,
            'change'         => (float) $s->change_amount,
            'change_amount'  => (float) $s->change_amount,
            'cashier'        => $s->cashier,
            'paymentMethod'  => $order?->payment_method ?? 'Cash',
            'paymentStatus'  => $paymentStatus,
            'payment_status' => $paymentStatus,
            'isPaid'         => $isPaid,
            'is_paid'        => $isPaid,
            'status'         => $order?->status ?? 'Completed',
            'orderType'      => $order?->order_type ?? 'Dine In',
            'tableNumber'    => $order?->table_number,
            'date'           => $s->date ? \Carbon\Carbon::parse($s->date)->format('Y-m-d') : null,
            'time'           => $s->time,
            'createdAt'      => $s->created_at?->toISOString(),
        ];
    }

    public static function canFormBanknoteAmount(int $target, array $denoms): bool
    {
        if ($target === 0) return true;
        if (empty($denoms) || $target < 0) return false;
        $dp = array_fill(0, $target + 1, false);
        $dp[0] = true;
        foreach ($denoms as $d) {
            for ($i = $d; $i <= $target; $i++) {
                if ($dp[$i - $d]) {
                    $dp[$i] = true;
                }
            }
        }
        return $dp[$target];
    }

    public static function validateCashBanknote(float $amountReceived, float $billTotal): ?string
    {
        $amount = round($amountReceived, 2);
        $total  = round($billTotal, 2);

        if ($amount < $total) {
            return "Insufficient payment. Amount must be at least ₱" . number_format($total, 2);
        }

        // Exact payment allowed (including centavos)
        if (abs($amount - $total) < 0.001) {
            return null;
        }

        // Banknotes are whole peso amounts (centavos are allowed only for exact payments)
        if ((float)(int)$amount !== $amount) {
            return "Invalid cash amount. Please enter a valid Philippine peso banknote denomination (₱20, ₱50, ₱100, ₱200, ₱500, or ₱1,000).";
        }

        $validBanknotes = [20, 50, 100, 200, 500, 1000];
        $intAmount = (int)$amount;
        $change = $amount - $total;

        // Single valid banknote denomination is always allowed if >= billTotal
        if (in_array($intAmount, $validBanknotes, true)) {
            return null;
        }

        // For multiple banknotes: only banknotes strictly greater than the change amount are non-redundant
        $allowedNotes = array_values(array_filter($validBanknotes, fn($b) => $b > $change));
        $isAllowed = self::canFormBanknoteAmount($intAmount, $allowedNotes);

        if (!$isAllowed) {
            return "Invalid cash amount. Please enter a valid Philippine peso banknote denomination (₱20, ₱50, ₱100, ₱200, ₱500, or ₱1,000).";
        }

        return null;
    }
}
