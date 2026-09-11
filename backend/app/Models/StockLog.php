<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockLog extends Model
{
    protected $fillable = ['inventory_item_id', 'item_name', 'type', 'quantity', 'previous_qty', 'new_qty', 'reason', 'performed_by', 'receipt_path'];

    protected function casts(): array
    {
        return [
            'quantity' => 'float',
            'previous_qty' => 'float',
            'new_qty' => 'float',
        ];
    }

    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class);
    }
}
