<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RemovedOrderItem extends Model
{
    protected $fillable = [
        'order_id',
        'item_name',
        'price',
        'quantity',
        'cashier',
        'reason',
    ];

    protected function casts(): array
    {
        return [
            'price'    => 'decimal:2',
            'quantity' => 'integer',
        ];
    }
}
