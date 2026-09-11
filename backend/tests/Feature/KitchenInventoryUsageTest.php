<?php

namespace Tests\Feature;

use App\Models\InventoryItem;
use App\Models\StockBatch;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class KitchenInventoryUsageTest extends TestCase
{
    use RefreshDatabase;

    public function test_kitchen_staff_can_record_used_stock_but_cannot_manage_inventory_items(): void
    {
        $kitchenStaff = User::create([
            'full_name' => 'Kitchen Tester',
            'username' => 'kitchen_tester',
            'email' => 'kitchen@example.com',
            'password' => 'password123',
            'role' => 'Kitchen Staff',
            'is_active' => true,
        ]);
        Sanctum::actingAs($kitchenStaff);

        $item = InventoryItem::create([
            'name' => 'Chicken',
            'category' => 'Meats',
            'unit' => 'kg',
            'quantity' => 10,
            'min_stock' => 2,
        ]);
        $batch = StockBatch::create([
            'inventory_item_id' => $item->id,
            'quantity_received' => 10,
            'quantity_remaining' => 10,
            'purchased_at' => now()->toDateString(),
            'purchased_by' => 'Purchaser',
        ]);

        $this->getJson('/api/inventory')->assertOk();

        $this->postJson('/api/inventory/stock', [
            'item_id' => $item->id,
            'type' => 'out',
            'quantity' => 3,
            'reason' => 'Kitchen preparation',
        ])->assertOk();

        $this->assertEquals(7.0, $item->fresh()->quantity);
        $this->assertEquals(7.0, $batch->fresh()->quantity_remaining);
        $this->assertDatabaseHas('stock_logs', [
            'inventory_item_id' => $item->id,
            'type' => 'out',
            'quantity' => 3,
            'performed_by' => $kitchenStaff->full_name,
        ]);

        $this->postJson('/api/inventory/stock', [
            'item_id' => $item->id,
            'type' => 'in',
            'quantity' => 1,
        ])->assertForbidden();

        $this->postJson('/api/inventory', [
            'name' => 'Unauthorized Item',
            'category' => 'Others',
            'unit' => 'pcs',
            'quantity' => 1,
            'min_stock' => 1,
        ])->assertForbidden();

        $this->putJson("/api/inventory/{$item->id}", [
            'name' => 'Changed Name',
        ])->assertForbidden();

        $this->deleteJson("/api/inventory/{$item->id}")->assertForbidden();
    }
}
