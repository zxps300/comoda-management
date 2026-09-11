<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('menu_items', function (Blueprint $table) {
            // Covers the public menu query: available items ordered by category and name.
            $table->index(
                ['available', 'category', 'name'],
                'menu_items_available_category_name_index'
            );

            // Keeps best-seller availability lookups inexpensive as the menu grows.
            $table->index(
                ['is_best_seller', 'available'],
                'menu_items_best_seller_available_index'
            );
        });
    }

    public function down(): void
    {
        Schema::table('menu_items', function (Blueprint $table) {
            $table->dropIndex('menu_items_available_category_name_index');
            $table->dropIndex('menu_items_best_seller_available_index');
        });
    }
};
