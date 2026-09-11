<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->integer('table_number')->nullable()->change();
        });
    }

    public function down(): void
    {
        DB::table('orders')->whereNull('table_number')->update(['table_number' => 0]);
        Schema::table('orders', function (Blueprint $table) {
            $table->integer('table_number')->nullable(false)->change();
        });
    }
};
