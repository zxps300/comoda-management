<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MenuItemRecipe extends Model
{
    protected $fillable = ['menu_item_id', 'inventory_item_id', 'quantity_needed'];

    protected $casts = [
        // Recipes are stored to three decimal places (for example 0.003 kg
        // of salt). A two-decimal cast turned those valid amounts into 0.00
        // and incorrectly made every affected menu item unavailable.
        'quantity_needed' => 'decimal:3',
    ];

    public function menuItem(): BelongsTo
    {
        return $this->belongsTo(MenuItem::class);
    }

    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class);
    }
}
