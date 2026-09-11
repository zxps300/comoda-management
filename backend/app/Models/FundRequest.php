<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FundRequest extends Model
{
    protected $fillable = [
        'purchaser_name',
        'cashier_name',
        'requested_amount',
        'released_amount',
        'spent_amount',
        'returned_change',
        'status',
        'items_list',
        'receipt_path',
        'notes',
        'manager_approval_status'
    ];

    protected $casts = [
        'requested_amount' => 'decimal:2',
        'released_amount' => 'decimal:2',
        'spent_amount' => 'decimal:2',
        'returned_change' => 'decimal:2',
        'items_list' => 'array',
    ];

    public function expenses()
    {
        return $this->hasMany(Expense::class);
    }

    public function stockBatches()
    {
        return $this->hasMany(StockBatch::class);
    }
}
