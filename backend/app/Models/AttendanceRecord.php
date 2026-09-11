<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AttendanceRecord extends Model
{
    protected $fillable = ['user_id', 'work_date', 'time_in', 'time_out', 'source', 'notes', 'recorded_by'];

    protected function casts(): array
    {
        return ['work_date' => 'date', 'time_in' => 'datetime', 'time_out' => 'datetime'];
    }

    public function user() { return $this->belongsTo(User::class); }
}
