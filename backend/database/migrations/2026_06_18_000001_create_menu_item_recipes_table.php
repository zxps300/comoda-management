<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('menu_item_recipes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('menu_item_id')->constrained()->onDelete('cascade');
            $table->foreignId('inventory_item_id')->constrained()->onDelete('cascade');
            $table->decimal('quantity_needed', 10, 2);
            $table->timestamps();

            $table->unique(['menu_item_id', 'inventory_item_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('menu_item_recipes');
    }
};
