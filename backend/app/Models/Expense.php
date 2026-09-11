<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Expense extends Model
{
    protected $fillable = [
        'date',
        'category',
        'description',
        'amount',
        'recorded_by',
        'fund_request_id',
    ];

    public function fundRequest()
    {
        return $this->belongsTo(FundRequest::class);
    }
}
