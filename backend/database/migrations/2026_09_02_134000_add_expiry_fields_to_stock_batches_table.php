<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stock_batches', function (Blueprint $table) {
            $table->date('expires_at')->nullable()->after('purchased_at')->index();
            $table->timestamp('expired_at')->nullable()->after('expires_at')->index();
            $table->string('expired_by')->nullable()->after('expired_at');
            $table->timestamp('disposed_at')->nullable()->after('expired_by');
            $table->string('disposed_by')->nullable()->after('disposed_at');
            $table->string('disposal_reason')->nullable()->after('disposed_by');
        });
    }

    public function down(): void
    {
        Schema::table('stock_batches', function (Blueprint $table) {
            $table->dropIndex(['expires_at']);
            $table->dropIndex(['expired_at']);
            $table->dropColumn([
                'expires_at',
                'expired_at',
                'expired_by',
                'disposed_at',
                'disposed_by',
                'disposal_reason',
            ]);
        });
    }
};
