<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('menu_price_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('menu_item_id')->nullable()->constrained()->nullOnDelete();
            $table->string('menu_item_name');
            $table->string('price_type', 30);
            $table->string('variant_label')->nullable();
            $table->decimal('old_price', 12, 2)->nullable();
            $table->decimal('new_price', 12, 2)->nullable();
            $table->foreignId('changed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('changed_by_name');
            $table->timestamps();

            $table->index(['menu_item_id', 'created_at']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('menu_price_histories');
    }
};
