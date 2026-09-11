<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_stock_deductions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_item_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('inventory_item_id')->constrained()->restrictOnDelete();
            $table->foreignId('stock_batch_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('quantity', 12, 4);
            $table->timestamp('restored_at')->nullable();
            $table->timestamps();

            $table->index(['order_id', 'restored_at']);
            $table->index(['inventory_item_id', 'stock_batch_id']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->index(['table_number', 'status'], 'orders_table_status_index');
            $table->index(['order_type', 'created_at'], 'orders_type_created_index');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex('orders_table_status_index');
            $table->dropIndex('orders_type_created_index');
        });
        Schema::dropIfExists('order_stock_deductions');
    }
};
