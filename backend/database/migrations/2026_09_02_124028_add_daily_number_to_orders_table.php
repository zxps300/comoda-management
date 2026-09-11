<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->unsignedInteger('daily_number')->nullable()->after('id');
        });

        Schema::create('daily_order_counters', function (Blueprint $table) {
            $table->date('order_date')->primary();
            $table->unsignedInteger('last_number')->default(0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('daily_order_counters');
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('daily_number');
        });
    }
};
