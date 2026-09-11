<?php

namespace Tests\Feature;

use App\Models\InventoryItem;
use App\Models\MenuItem;
use App\Models\MenuItemRecipe;
use App\Models\Order;
use App\Models\OrderStockDeduction;
use App\Models\Sale;
use App\Models\StockBatch;
use App\Models\User;
use App\Services\PermanentQrService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OrderIntegrityTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role, string $suffix): User
    {
        return User::create([
            'full_name' => "$role Tester",
            'username' => strtolower(str_replace(' ', '_', $role))."_$suffix",
            'email' => "$suffix@example.com",
            'password' => 'password123',
            'role' => $role,
            'is_active' => true,
        ]);
    }

    private function menuItem(string $name, float $price): MenuItem
    {
        return MenuItem::create([
            'name' => $name,
            'category' => 'Meals',
            'price' => $price,
            'available' => true,
        ]);
    }

    public function test_cashier_order_uses_database_prices_and_server_calculated_totals(): void
    {
        $cashier = $this->user('Cashier', 'secure-price');
        Sanctum::actingAs($cashier);
        $menuItem = $this->menuItem('Secure Meal', 100);

        $response = $this->postJson('/api/orders', [
            'orderType' => 'Dine In',
            'tableNumber' => 1,
            'items' => [[
                'menuItemId' => $menuItem->id,
                'name' => 'Tampered Name',
                'price' => 1,
                'quantity' => 2,
            ]],
            'subtotal' => 1,
            'discount' => 0,
            'tax' => 999,
            'total' => 1,
            'isPaid' => true,
            'paymentMethod' => 'Cash',
            'amountReceived' => 200,
            'changeAmount' => 199,
            'cashier' => 'Fake Cashier',
        ])->assertCreated()->assertJsonPath('total', 200);

        $order = Order::with('items', 'sale')->findOrFail($response->json('id'));
        $this->assertEquals(200, $order->subtotal);
        $this->assertEquals(200, $order->total);
        $this->assertEquals(100, $order->items->first()->price);
        $this->assertSame('Secure Meal', $order->items->first()->name);
        $this->assertEquals(200, $order->sale->total);
        $this->assertEquals(0, $order->sale->change_amount);
        $this->assertSame($cashier->full_name, $order->sale->cashier);
    }

    public function test_paid_active_order_still_occupies_the_table(): void
    {
        $cashier = $this->user('Cashier', 'occupied');
        Sanctum::actingAs($cashier);
        $menuItem = $this->menuItem('Rice Bowl', 80);
        $existing = Order::create([
            'table_number' => 4,
            'customer_name' => 'Table 4',
            'subtotal' => 80,
            'discount' => 0,
            'tax' => 0,
            'total' => 80,
            'status' => 'Ready',
            'is_paid' => true,
        ]);

        $this->postJson('/api/orders', [
            'orderType' => 'Dine In',
            'tableNumber' => 4,
            'items' => [['menuItemId' => $menuItem->id, 'quantity' => 1]],
            'discount' => 0,
            'isPaid' => false,
        ])->assertConflict();

        $signature = app(PermanentQrService::class)->tableSignature(4);
        $this->getJson('/api/table-status/4?qr='.urlencode($signature))
            ->assertOk()
            ->assertJsonPath('occupied', true)
            ->assertJsonPath('orderId', $existing->id);
    }

    public function test_shared_ingredient_is_validated_for_the_whole_order_and_rolls_back(): void
    {
        $cashier = $this->user('Cashier', 'shared-stock');
        Sanctum::actingAs($cashier);
        $ingredient = InventoryItem::create([
            'name' => 'Shared Sauce', 'category' => 'Condiments', 'unit' => 'L',
            'quantity' => 5, 'min_stock' => 1,
        ]);
        $batch = StockBatch::create([
            'inventory_item_id' => $ingredient->id,
            'quantity_received' => 5,
            'quantity_remaining' => 5,
            'purchased_at' => now()->toDateString(),
            'purchased_by' => 'Purchaser',
        ]);
        $first = $this->menuItem('Dish A', 100);
        $second = $this->menuItem('Dish B', 120);
        foreach ([$first, $second] as $item) {
            MenuItemRecipe::create([
                'menu_item_id' => $item->id,
                'inventory_item_id' => $ingredient->id,
                'quantity_needed' => 3,
            ]);
        }

        $this->postJson('/api/orders', [
            'orderType' => 'Dine In',
            'tableNumber' => 2,
            'items' => [
                ['menuItemId' => $first->id, 'quantity' => 1],
                ['menuItemId' => $second->id, 'quantity' => 1],
            ],
            'discount' => 0,
            'isPaid' => false,
        ])->assertUnprocessable()->assertJsonFragment(['message' => 'Not enough Shared Sauce. The order needs 6 L, but only 5 L is available.']);

        $this->assertDatabaseCount('orders', 0);
        $this->assertEquals(5, $ingredient->fresh()->quantity);
        $this->assertEquals(5, $batch->fresh()->quantity_remaining);
    }

    public function test_cancellation_restores_original_fifo_batches_even_if_recipe_changes(): void
    {
        $cashier = $this->user('Cashier', 'exact-restore');
        Sanctum::actingAs($cashier);
        $ingredient = InventoryItem::create([
            'name' => 'Precise Ingredient', 'category' => 'Meats', 'unit' => 'kg',
            'quantity' => 10, 'min_stock' => 1,
        ]);
        $oldBatch = StockBatch::create([
            'inventory_item_id' => $ingredient->id,
            'quantity_received' => 3,
            'quantity_remaining' => 3,
            'purchased_at' => now()->subDay()->toDateString(),
            'purchased_by' => 'Purchaser',
        ]);
        $newBatch = StockBatch::create([
            'inventory_item_id' => $ingredient->id,
            'quantity_received' => 7,
            'quantity_remaining' => 7,
            'purchased_at' => now()->toDateString(),
            'purchased_by' => 'Purchaser',
        ]);
        $menuItem = $this->menuItem('Precise Dish', 150);
        $recipe = MenuItemRecipe::create([
            'menu_item_id' => $menuItem->id,
            'inventory_item_id' => $ingredient->id,
            'quantity_needed' => 2.5,
        ]);

        $response = $this->postJson('/api/orders', [
            'orderType' => 'Dine In',
            'tableNumber' => 3,
            'items' => [['menuItemId' => $menuItem->id, 'quantity' => 2]],
            'discount' => 0,
            'isPaid' => false,
        ])->assertCreated();
        $orderId = $response->json('id');
        $this->assertEquals(0, $oldBatch->fresh()->quantity_remaining);
        $this->assertEquals(5, $newBatch->fresh()->quantity_remaining);

        $recipe->update(['quantity_needed' => 9]);
        $this->putJson("/api/orders/$orderId", ['status' => 'Cancelled'])->assertOk();

        $this->assertEquals(10, $ingredient->fresh()->quantity);
        $this->assertEquals(3, $oldBatch->fresh()->quantity_remaining);
        $this->assertEquals(7, $newBatch->fresh()->quantity_remaining);
        $this->assertSame(0, OrderStockDeduction::where('order_id', $orderId)->whereNull('restored_at')->count());
    }

    public function test_payment_uses_the_locked_order_total_and_authenticated_cashier(): void
    {
        $cashier = $this->user('Cashier', 'secure-payment');
        Sanctum::actingAs($cashier);
        $order = Order::create([
            'table_number' => 5,
            'customer_name' => 'Table 5',
            'subtotal' => 500,
            'discount' => 0,
            'tax' => 0,
            'total' => 500,
            'status' => 'Pending',
            'is_paid' => false,
        ]);

        $this->postJson('/api/sales', [
            'orderId' => $order->id,
            'total' => 20,
            'amountReceived' => 20,
            'change' => 0,
            'cashier' => 'Fake Cashier',
            'paymentMethod' => 'Cash',
        ])->assertUnprocessable();
        $this->assertFalse((bool) $order->fresh()->is_paid);

        $this->postJson('/api/sales', [
            'orderId' => $order->id,
            'total' => 1,
            'amountReceived' => 500,
            'change' => 499,
            'cashier' => 'Fake Cashier',
            'paymentMethod' => 'Cash',
        ])->assertOk()->assertJsonPath('total', 500)->assertJsonPath('change', 0);

        $sale = Sale::where('order_id', $order->id)->firstOrFail();
        $this->assertEquals(500, $sale->total);
        $this->assertSame($cashier->full_name, $sale->cashier);
    }

    public function test_financial_and_order_workflow_permissions_are_enforced(): void
    {
        $kitchen = $this->user('Kitchen Staff', 'permissions-kitchen');
        $purchaser = $this->user('Purchaser', 'permissions-purchaser');
        $order = Order::create([
            'table_number' => 6, 'customer_name' => 'Table 6', 'subtotal' => 50,
            'discount' => 0, 'tax' => 0, 'total' => 50, 'status' => 'Pending', 'is_paid' => false,
        ]);

        Sanctum::actingAs($kitchen);
        $this->postJson('/api/sales', [
            'orderId' => $order->id, 'amountReceived' => 50, 'paymentMethod' => 'Cash',
        ])->assertForbidden();
        $this->putJson("/api/orders/{$order->id}", ['status' => 'Ready'])->assertUnprocessable();

        Sanctum::actingAs($purchaser);
        $this->getJson('/api/orders')->assertForbidden();
    }

    public function test_reading_sales_does_not_create_missing_records(): void
    {
        $admin = $this->user('Admin', 'read-only-sales');
        Sanctum::actingAs($admin);
        Order::create([
            'table_number' => 7, 'customer_name' => 'Table 7', 'subtotal' => 75,
            'discount' => 0, 'tax' => 0, 'total' => 75, 'status' => 'Pending', 'is_paid' => false,
        ]);

        $this->getJson('/api/sales')->assertOk()->assertExactJson([]);
        $this->assertDatabaseCount('sales', 0);
    }

    public function test_take_out_numbers_advance_from_an_atomic_daily_counter(): void
    {
        $cashier = $this->user('Cashier', 'takeout-counter');
        Sanctum::actingAs($cashier);
        $menuItem = $this->menuItem('Take Out Meal', 90);
        $payload = [
            'orderType' => 'Take Out',
            'items' => [['menuItemId' => $menuItem->id, 'quantity' => 1]],
            'discount' => 0,
            'isPaid' => false,
        ];

        $this->postJson('/api/orders', $payload)->assertCreated()->assertJsonPath('takeOutNumber', 1);
        $this->postJson('/api/orders', $payload)->assertCreated()->assertJsonPath('takeOutNumber', 2);

        $this->assertDatabaseHas('take_out_counters', [
            'order_date' => today()->toDateString(),
            'last_number' => 2,
        ]);
    }
}
