<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Order extends Model
{
    protected $fillable = [
        'table_number', 'customer_name', 'subtotal', 'discount', 'tax', 'total', 'status', 'notes',
        'is_paid', 'payment_method', 'amount_received', 'change_amount',
        'order_type', 'take_out_number', 'daily_number'
    ];

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function sale(): HasOne
    {
        return $this->hasOne(Sale::class);
    }

    public function stockDeductions(): HasMany
    {
        return $this->hasMany(OrderStockDeduction::class);
    }
}
