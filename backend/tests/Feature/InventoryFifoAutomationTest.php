<?php

namespace Tests\Feature;

use App\Models\InventoryItem;
use App\Models\StockBatch;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class InventoryFifoAutomationTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function actingAsAdmin(): User
    {
        $admin = User::create([
            'full_name' => 'FIFO Admin',
            'username' => 'fifo_admin',
            'email' => 'fifo-admin@example.com',
            'password' => 'password123',
            'role' => 'Admin',
            'is_active' => true,
        ]);

        Sanctum::actingAs($admin);
        return $admin;
    }

    public function test_initial_quantity_creates_a_timestamped_stock_entry_and_log(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-01 09:15:00', 'Asia/Manila'));
        $admin = $this->actingAsAdmin();

        $response = $this->postJson('/api/inventory', [
            'name' => 'Fresh Beef',
            'category' => 'Meats',
            'unit' => 'kg',
            'quantity' => 12,
            'min_stock' => 3,
        ])->assertCreated();

        $item = InventoryItem::where('name', 'Fresh Beef')->firstOrFail();
        $batch = StockBatch::where('inventory_item_id', $item->id)->firstOrFail();

        $this->assertSame('2026-09-01', $batch->purchased_at->toDateString());
        $this->assertSame($admin->full_name, $batch->purchased_by);
        $this->assertEquals(12.0, $batch->quantity_received);
        $this->assertEquals(12.0, $batch->quantity_remaining);

        $response
            ->assertJsonPath('last_stock_movement_type', 'in')
            ->assertJsonPath('last_stock_movement_quantity', 12)
            ->assertJsonPath('expired_stock_entry_count', 0);

        $this->assertDatabaseHas('stock_logs', [
            'inventory_item_id' => $item->id,
            'type' => 'in',
            'quantity' => 12,
            'previous_qty' => 0,
            'new_qty' => 12,
            'performed_by' => $admin->full_name,
        ]);
    }

    public function test_stock_out_uses_same_day_stock_entries_by_exact_timestamp(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-01 08:00:00', 'Asia/Manila'));
        $admin = $this->actingAsAdmin();

        $this->postJson('/api/inventory', [
            'name' => 'Chicken',
            'category' => 'Meats',
            'unit' => 'kg',
            'quantity' => 10,
            'min_stock' => 2,
        ])->assertCreated();

        $item = InventoryItem::where('name', 'Chicken')->firstOrFail();
        $firstBatch = StockBatch::where('inventory_item_id', $item->id)->firstOrFail();

        Carbon::setTestNow(Carbon::parse('2026-09-01 10:30:00', 'Asia/Manila'));
        $this->post('/api/inventory/stock', [
            'item_id' => $item->id,
            'type' => 'in',
            'quantity' => 5,
            'performed_by' => $admin->full_name,
        ])->assertOk();

        $secondBatch = StockBatch::where('inventory_item_id', $item->id)
            ->where('id', '!=', $firstBatch->id)
            ->firstOrFail();

        Carbon::setTestNow(Carbon::parse('2026-09-01 11:00:00', 'Asia/Manila'));
        $this->post('/api/inventory/stock', [
            'item_id' => $item->id,
            'type' => 'out',
            'quantity' => 12,
            'performed_by' => $admin->full_name,
        ])->assertOk();

        $this->assertEquals(0.0, $firstBatch->fresh()->quantity_remaining);
        $this->assertEquals(3.0, $secondBatch->fresh()->quantity_remaining);
        $this->assertEquals(3.0, $item->fresh()->quantity);
    }

    public function test_direct_item_edit_cannot_bypass_timestamped_quantity_tracking(): void
    {
        $this->actingAsAdmin();
        $item = InventoryItem::create([
            'name' => 'Rice',
            'category' => 'Grains',
            'unit' => 'kg',
            'quantity' => 20,
            'min_stock' => 5,
        ]);

        $this->putJson("/api/inventory/{$item->id}", [
            'name' => 'Premium Rice',
            'category' => 'Grains',
            'unit' => 'kg',
            'quantity' => 999,
            'min_stock' => 6,
        ])->assertOk();

        $item->refresh();
        $this->assertSame('Premium Rice', $item->name);
        $this->assertEquals(20.0, $item->quantity);
        $this->assertEquals(6.0, $item->min_stock);
    }

    public function test_expired_stock_is_quarantined_and_separated_from_available_stock(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-02 10:00:00', 'Asia/Manila'));
        $this->actingAsAdmin();

        $item = InventoryItem::create([
            'name' => 'Milk',
            'category' => 'Drinks&Wine',
            'unit' => 'liters',
            'quantity' => 15,
            'min_stock' => 2,
        ]);
        $expired = StockBatch::create([
            'inventory_item_id' => $item->id,
            'quantity_received' => 10,
            'quantity_remaining' => 10,
            'purchased_at' => '2026-08-30',
            'expires_at' => '2026-09-01',
            'purchased_by' => 'Purchaser',
        ]);
        $active = StockBatch::create([
            'inventory_item_id' => $item->id,
            'quantity_received' => 5,
            'quantity_remaining' => 5,
            'purchased_at' => '2026-09-01',
            'expires_at' => '2026-09-05',
            'purchased_by' => 'Purchaser',
        ]);

        $this->getJson('/api/inventory')->assertOk()
            ->assertJsonPath('0.quantity', 5)
            ->assertJsonPath('0.next_expiration_date', '2026-09-05')
            ->assertJsonPath('0.expired_stock_entry_count', 1)
            ->assertJsonPath('0.expired_stock_quantity', 10);

        $this->assertEquals(5.0, $item->fresh()->quantity);
        $this->assertNotNull($expired->fresh()->expired_at);
        $this->assertDatabaseHas('stock_logs', [
            'inventory_item_id' => $item->id,
            'type' => 'out',
            'quantity' => 10,
        ]);

        $this->getJson("/api/inventory/{$item->id}/batches")->assertOk()
            ->assertJsonCount(1, 'active')
            ->assertJsonCount(1, 'expired')
            ->assertJsonPath('active.0.id', $active->id)
            ->assertJsonPath('expired.0.id', $expired->id)
            ->assertJsonPath('expired.0.is_expired', true);
    }

    public function test_admin_can_expire_and_dispose_stock_without_deleting_its_history(): void
    {
        $admin = $this->actingAsAdmin();
        $item = InventoryItem::create([
            'name' => 'Spoiled Beef',
            'category' => 'Meats',
            'unit' => 'kg',
            'quantity' => 4,
            'min_stock' => 1,
        ]);
        $batch = StockBatch::create([
            'inventory_item_id' => $item->id,
            'quantity_received' => 4,
            'quantity_remaining' => 4,
            'purchased_at' => now()->toDateString(),
            'purchased_by' => 'Purchaser',
        ]);

        $this->postJson("/api/inventory/batches/{$batch->id}/expire", [
            'reason' => 'Failed quality inspection',
        ])->assertOk()->assertJsonPath('item.quantity', 0);

        $this->assertEquals(0.0, $item->fresh()->quantity);
        $this->assertDatabaseHas('stock_batches', [
            'id' => $batch->id,
            'expired_by' => $admin->full_name,
            'quantity_remaining' => 4,
        ]);

        $this->postJson("/api/inventory/batches/{$batch->id}/dispose", [
            'reason' => 'Discarded safely',
        ])->assertOk();

        $this->assertDatabaseHas('stock_batches', [
            'id' => $batch->id,
            'disposed_by' => $admin->full_name,
            'disposal_reason' => 'Discarded safely',
        ]);
        $this->deleteJson("/api/inventory/batches/{$batch->id}")->assertStatus(409);
    }
}
