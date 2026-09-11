<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderStockDeduction extends Model
{
    protected $fillable = [
        'order_id',
        'order_item_id',
        'inventory_item_id',
        'stock_batch_id',
        'quantity',
        'restored_at',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'float',
            'restored_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class);
    }

    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class);
    }

    public function stockBatch(): BelongsTo
    {
        return $this->belongsTo(StockBatch::class);
    }
}
