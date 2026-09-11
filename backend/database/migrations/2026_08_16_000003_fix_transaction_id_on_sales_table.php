<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            if (Schema::hasColumn('sales', 'transaction_id')) {
                $table->string('transaction_id')->nullable()->default(null)->change();
            } else {
                $table->string('transaction_id')->nullable()->after('id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            if (Schema::hasColumn('sales', 'transaction_id')) {
                $table->string('transaction_id')->nullable()->change();
            }
        });
    }
};
