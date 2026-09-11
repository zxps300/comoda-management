<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Builder;

class StockBatch extends Model
{
    protected $fillable = [
        'inventory_item_id',
        'quantity_received',
        'quantity_remaining',
        'purchased_at',
        'expires_at',
        'expired_at',
        'expired_by',
        'disposed_at',
        'disposed_by',
        'disposal_reason',
        'purchased_by',
        'receipt_path',
        'supplier_name',
        'purchase_cost',
        'fund_request_id',
    ];

    public function fundRequest(): BelongsTo
    {
        return $this->belongsTo(FundRequest::class);
    }

    protected $casts = [
        'purchased_at' => 'date',
        'expires_at' => 'date',
        'expired_at' => 'datetime',
        'disposed_at' => 'datetime',
        'quantity_received' => 'float',
        'quantity_remaining' => 'float',
    ];

    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query
            ->whereNull('expired_at')
            ->where(fn (Builder $q) => $q
                ->whereNull('expires_at')
                ->orWhereDate('expires_at', '>=', today()));
    }

    public function scopeExpired(Builder $query): Builder
    {
        return $query->where(fn (Builder $q) => $q
            ->whereNotNull('expired_at')
            ->orWhere(fn (Builder $due) => $due
                ->whereNotNull('expires_at')
                ->whereDate('expires_at', '<', today())));
    }

    public function getIsExpiredAttribute(): bool
    {
        return $this->expired_at !== null
            || ($this->expires_at !== null && $this->expires_at->isBefore(today()));
    }

    // How many days old this batch is
    public function getDaysOldAttribute(): int
    {
        return (int) $this->purchased_at->diffInDays(now());
    }
}
