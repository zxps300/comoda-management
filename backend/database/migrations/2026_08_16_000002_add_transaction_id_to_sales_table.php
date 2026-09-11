<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            // Add unique constraint on order_id to prevent duplicate sale records for same order
            // Check if constraint doesn't already exist before adding
            $table->unique('order_id', 'sales_order_id_unique');
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropUnique('sales_order_id_unique');
        });
    }
};
