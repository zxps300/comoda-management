<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_items', function (Blueprint $table) {
            $table->decimal('quantity', 12, 4)->default(0)->change();
            $table->decimal('min_stock', 12, 4)->default(0)->change();
        });

        Schema::table('stock_batches', function (Blueprint $table) {
            $table->decimal('quantity_received', 12, 4)->change();
            $table->decimal('quantity_remaining', 12, 4)->change();
        });

        Schema::table('stock_logs', function (Blueprint $table) {
            $table->decimal('quantity', 12, 4)->change();
            $table->decimal('previous_qty', 12, 4)->change();
            $table->decimal('new_qty', 12, 4)->change();
        });

        // Existing installations may have stock that predates FIFO batches.
        // Preserve that stock as an opening batch. If batches already exist,
        // their remaining quantities are the exact source of truth.
        DB::table('inventory_items')->orderBy('id')->each(function ($item) {
            $batchTotal = (float) DB::table('stock_batches')
                ->where('inventory_item_id', $item->id)
                ->sum('quantity_remaining');
            $itemTotal = (float) $item->quantity;

            if ($batchTotal <= 0.00005 && $itemTotal > 0.00005) {
                DB::table('stock_batches')->insert([
                    'inventory_item_id' => $item->id,
                    'quantity_received' => $itemTotal,
                    'quantity_remaining' => $itemTotal,
                    'purchased_at' => $item->created_at
                        ? substr((string) $item->created_at, 0, 10)
                        : now()->toDateString(),
                    'purchased_by' => 'Opening balance migration',
                    'created_at' => $item->created_at ?? now(),
                    'updated_at' => now(),
                ]);
                $batchTotal = $itemTotal;
            }

            if (abs($itemTotal - $batchTotal) > 0.00005) {
                DB::table('inventory_items')->where('id', $item->id)->update([
                    'quantity' => round($batchTotal, 4),
                    'updated_at' => now(),
                ]);
            }
        });
    }

    public function down(): void
    {
        Schema::table('stock_logs', function (Blueprint $table) {
            $table->integer('quantity')->change();
            $table->integer('previous_qty')->change();
            $table->integer('new_qty')->change();
        });

        Schema::table('stock_batches', function (Blueprint $table) {
            $table->decimal('quantity_received', 10, 2)->change();
            $table->decimal('quantity_remaining', 10, 2)->change();
        });

        Schema::table('inventory_items', function (Blueprint $table) {
            $table->integer('quantity')->default(0)->change();
            $table->integer('min_stock')->default(0)->change();
        });
    }
};
