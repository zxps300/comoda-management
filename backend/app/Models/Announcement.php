<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Announcement extends Model
{
    protected $fillable = ['created_by', 'title', 'message', 'severity', 'expires_at', 'is_active'];
    protected function casts(): array { return ['expires_at'=>'datetime', 'is_active'=>'boolean']; }
    public function creator() { return $this->belongsTo(User::class, 'created_by'); }
}
