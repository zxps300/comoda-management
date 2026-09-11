<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InventoryItem extends Model
{
    protected $fillable = ['name', 'category', 'unit', 'quantity', 'min_stock'];

    protected function casts(): array
    {
        return [
            'quantity' => 'float',
            'min_stock' => 'float',
        ];
    }

    public function stockLogs(): HasMany
    {
        return $this->hasMany(StockLog::class);
    }

    public function stockBatches(): HasMany
    {
        return $this->hasMany(StockBatch::class)
            ->active()
            ->orderBy('purchased_at', 'asc')
            ->orderBy('created_at', 'asc')
            ->orderBy('id', 'asc');
    }

    public function expiredStockBatches(): HasMany
    {
        return $this->hasMany(StockBatch::class)
            ->expired()
            ->orderByDesc('expired_at')
            ->orderByDesc('id');
    }

    public function recipes(): HasMany
    {
        return $this->hasMany(MenuItemRecipe::class);
    }
}
