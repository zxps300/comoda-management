<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MenuPriceHistory extends Model
{
    protected $fillable = [
        'menu_item_id',
        'menu_item_name',
        'price_type',
        'variant_label',
        'old_price',
        'new_price',
        'changed_by_user_id',
        'changed_by_name',
        'reason',
    ];

    protected function casts(): array
    {
        return [
            'old_price' => 'decimal:2',
            'new_price' => 'decimal:2',
        ];
    }

    public function menuItem(): BelongsTo
    {
        return $this->belongsTo(MenuItem::class);
    }

    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by_user_id')->withTrashed();
    }
}
