<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('take_out_counters', function (Blueprint $table) {
            $table->date('order_date')->primary();
            $table->unsignedInteger('last_number')->default(0);
            $table->timestamps();
        });

        $existing = DB::table('orders')
            ->where('order_type', 'Take Out')
            ->whereNotNull('take_out_number')
            ->selectRaw('DATE(created_at) AS order_date, MAX(take_out_number) AS last_number')
            ->groupByRaw('DATE(created_at)')
            ->get();
        foreach ($existing as $counter) {
            DB::table('take_out_counters')->insert([
                'order_date' => $counter->order_date,
                'last_number' => $counter->last_number,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('take_out_counters');
    }
};
