<?php

namespace Tests\Feature;

use App\Models\InventoryItem;
use App\Models\MenuItem;
use App\Models\MenuItemRecipe;
use App\Models\StockBatch;
use App\Models\StockLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CashierOrderInventoryDeductionTest extends TestCase
{
    use RefreshDatabase;

    public function test_cashier_order_deducts_recipe_stock_once_and_cancellation_restores_it(): void
    {
        $cashier = User::create([
            'full_name' => 'Test Cashier',
            'username' => 'test_cashier',
            'email' => 'cashier@example.com',
            'password' => 'password123',
            'role' => 'Cashier',
            'is_active' => true,
        ]);
        Sanctum::actingAs($cashier);

        $ingredient = InventoryItem::create([
            'name' => 'Burger Patty',
            'category' => 'Meats',
            'unit' => 'pcs',
            'quantity' => 10,
            'min_stock' => 2,
        ]);
        $batch = StockBatch::create([
            'inventory_item_id' => $ingredient->id,
            'quantity_received' => 10,
            'quantity_remaining' => 10,
            'purchased_at' => now()->toDateString(),
            'purchased_by' => 'Test Purchaser',
        ]);
        $menuItem = MenuItem::create([
            'name' => 'Burger',
            'category' => 'Meals',
            'price' => 100,
            'available' => true,
        ]);
        MenuItemRecipe::create([
            'menu_item_id' => $menuItem->id,
            'inventory_item_id' => $ingredient->id,
            'quantity_needed' => 2,
        ]);

        $createResponse = $this->postJson('/api/orders', [
            'orderType' => 'Dine In',
            'tableNumber' => 1,
            'customerName' => 'Table 1',
            'items' => [[
                'menuItemId' => $menuItem->id,
                'name' => $menuItem->name,
                'price' => 100,
                'quantity' => 2,
            ]],
            'subtotal' => 200,
            'discount' => 0,
            'tax' => 0,
            'total' => 200,
            'isPaid' => false,
            'cashier' => $cashier->full_name,
        ])->assertCreated()
            ->assertJsonPath('stock_deductions.0', 'Burger Patty: 10 → 6 pcs');

        $orderId = $createResponse->json('id');
        $this->assertEquals(6.0, $ingredient->fresh()->quantity);
        $this->assertEquals(6.0, $batch->fresh()->quantity_remaining);
        $this->assertSame(1, StockLog::where('type', 'out')->where('reason', 'like', "Order #{$orderId}%")->count());

        $kitchen = User::create([
            'full_name' => 'Test Kitchen',
            'username' => 'test_kitchen',
            'email' => 'kitchen-order@example.com',
            'password' => 'password123',
            'role' => 'Kitchen Staff',
            'is_active' => true,
        ]);
        Sanctum::actingAs($kitchen);
        $this->putJson("/api/orders/{$orderId}", ['status' => 'Preparing'])->assertOk();
        $this->assertEquals(6.0, $ingredient->fresh()->quantity);
        $this->assertSame(1, StockLog::where('type', 'out')->where('reason', 'like', "Order #{$orderId}%")->count());

        Sanctum::actingAs($cashier);
        $this->putJson("/api/orders/{$orderId}", ['status' => 'Cancelled'])->assertOk();
        $this->assertEquals(10.0, $ingredient->fresh()->quantity);
        $this->assertEquals(10.0, $batch->fresh()->quantity_remaining);
        $this->assertSame(1, StockLog::where('type', 'in')->where('reason', 'like', "Order #{$orderId}%")->count());
    }
}
