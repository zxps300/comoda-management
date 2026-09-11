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
        Schema::table('stock_batches', function (Blueprint $table) {
            $table->string('supplier_name')->nullable();
            $table->decimal('purchase_cost', 10, 2)->default(0);
            $table->foreignId('fund_request_id')->nullable()->constrained('fund_requests')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('stock_batches', function (Blueprint $table) {
            $table->dropForeign(['fund_request_id']);
            $table->dropColumn(['supplier_name', 'purchase_cost', 'fund_request_id']);
        });
    }
};
