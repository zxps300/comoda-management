<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Sale extends Model
{
    protected $fillable = [
        'transaction_id',
        'order_id',
        'total',
        'amount_received',
        'change_amount',
        'cashier',
        'date',
        'time',
    ];

    protected function casts(): array
    {
        return [
            'date'            => 'date',
            'total'           => 'decimal:2',
            'amount_received' => 'decimal:2',
            'change_amount'   => 'decimal:2',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Sale $sale) {
            if (empty($sale->transaction_id)) {
                $sale->transaction_id = 'TXN-' . date('Ymd') . '-' . strtoupper(substr(uniqid(), -6));
            }
        });
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
