<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fund_requests', function (Blueprint $table) {
            $table->id();
            $table->string('purchaser_name');
            $table->string('cashier_name')->nullable();
            $table->decimal('requested_amount', 10, 2);
            $table->decimal('released_amount', 10, 2)->nullable();
            $table->decimal('spent_amount', 10, 2)->nullable();
            $table->decimal('returned_change', 10, 2)->nullable();
            $table->enum('status', ['pending', 'released', 'liquidating', 'completed'])->default('pending');
            $table->json('items_list'); // The list of items to buy
            $table->string('receipt_path')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fund_requests');
    }
};
