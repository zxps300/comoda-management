<?php

namespace Tests\Feature;

use App\Models\InventoryItem;
use App\Models\FundRequest;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Sale;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ServingReportsAndPriceHistoryTest extends TestCase
{
    use RefreshDatabase;

    private function actingAsAdmin(): User
    {
        $admin = User::create([
            'full_name' => 'Maria Santos',
            'username' => 'maria_admin',
            'email' => 'maria@example.com',
            'password' => 'password123',
            'role' => 'Admin',
            'is_active' => true,
        ]);
        Sanctum::actingAs($admin);

        return $admin;
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_dashboard_week_runs_from_sunday_through_saturday(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-03 10:00:00', 'Asia/Manila'));
        $this->actingAsAdmin();

        $response = $this->getJson('/api/dashboard')->assertOk();

        $this->assertSame(
            ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            collect($response->json('weeklyData'))->pluck('day')->all(),
        );
        $this->assertSame('2026-08-30', $response->json('weeklyData.0.date'));
        $this->assertSame('2026-09-05', $response->json('weeklyData.6.date'));
    }

    public function test_available_servings_are_recipe_based_and_increase_after_restock(): void
    {
        $this->actingAsAdmin();
        $chicken = InventoryItem::create([
            'name' => 'Chicken', 'category' => 'Meats', 'unit' => 'kg', 'quantity' => 1, 'min_stock' => 0,
        ]);
        $menuItem = MenuItem::create([
            'name' => 'Grilled Chicken', 'category' => 'Main Course', 'price' => 210, 'available' => true,
        ]);
        $menuItem->recipes()->create(['inventory_item_id' => $chicken->id, 'quantity_needed' => .25]);

        $this->getJson('/api/menu')->assertOk()
            ->assertJsonPath('items.0.availableServings', 4)
            ->assertJsonPath('items.0.maxQuantity', 4);

        $this->postJson('/api/inventory/stock', [
            'item_id' => $chicken->id,
            'type' => 'in',
            'quantity' => 1,
            'performed_by' => 'Maria Santos',
        ])->assertOk();

        $this->getJson('/api/menu')->assertOk()
            ->assertJsonPath('items.0.availableServings', 8);
        $this->getJson('/api/menu-items')->assertOk()
            ->assertJsonPath('0.availableServings', 8);
    }

    public function test_small_recipe_quantities_keep_their_precision_when_calculating_servings(): void
    {
        $this->actingAsAdmin();
        $salt = InventoryItem::create([
            'name' => 'Salt', 'category' => 'Condiments', 'unit' => 'kg', 'quantity' => 10, 'min_stock' => 1,
        ]);
        $menuItem = MenuItem::create([
            'name' => 'Adobo', 'category' => 'Main Course', 'price' => 195, 'available' => true,
        ]);
        $menuItem->recipes()->create(['inventory_item_id' => $salt->id, 'quantity_needed' => .003]);

        $this->getJson('/api/menu-items')->assertOk()
            ->assertJsonPath('0.available', true)
            ->assertJsonPath('0.availableServings', 3333);
    }

    public function test_purchasing_liquidation_restock_restores_menu_availability(): void
    {
        $this->actingAsAdmin();
        $chicken = InventoryItem::create([
            'name' => 'Chicken', 'category' => 'Meats', 'unit' => 'kg', 'quantity' => 0, 'min_stock' => 1,
        ]);
        $menuItem = MenuItem::create([
            'name' => 'Grilled Chicken', 'category' => 'Main Course', 'price' => 210, 'available' => false,
        ]);
        $menuItem->recipes()->create(['inventory_item_id' => $chicken->id, 'quantity_needed' => .25]);
        $fundRequest = FundRequest::create([
            'purchaser_name' => 'Maria Santos',
            'cashier_name' => 'Admin User',
            'requested_amount' => 500,
            'released_amount' => 500,
            'status' => 'released',
            'items_list' => ['Chicken'],
        ]);

        $this->postJson("/api/fund-requests/{$fundRequest->id}/liquidate", [
            'spent_amount' => 500,
            'purchased_items' => [[
                'inventory_item_id' => $chicken->id,
                'qty' => 2,
                'cost' => 500,
                'supplier' => 'Fresh Foods Supplier',
            ]],
        ])->assertOk();

        $this->assertEquals(2.0, (float) $chicken->fresh()->quantity);
        $this->assertTrue((bool) $menuItem->fresh()->available);
        $this->getJson('/api/menu-items')->assertOk()
            ->assertJsonPath('0.available', true)
            ->assertJsonPath('0.availableServings', 8);
    }

    public function test_monthly_report_groups_paid_sales_by_product_and_category(): void
    {
        $this->actingAsAdmin();
        $chicken = MenuItem::create(['name' => 'Grilled Chicken', 'category' => 'Main Course', 'price' => 200, 'available' => true]);
        $tea = MenuItem::create(['name' => 'Iced Tea', 'category' => 'Beverages', 'price' => 50, 'available' => true]);
        $order = Order::create([
            'table_number' => 1, 'subtotal' => 500, 'discount' => 0, 'tax' => 0, 'total' => 500,
            'status' => 'Completed', 'is_paid' => true, 'payment_method' => 'Cash',
        ]);
        OrderItem::create(['order_id' => $order->id, 'menu_item_id' => $chicken->id, 'name' => $chicken->name, 'price' => 200, 'quantity' => 2]);
        OrderItem::create(['order_id' => $order->id, 'menu_item_id' => $tea->id, 'name' => $tea->name, 'price' => 50, 'quantity' => 2]);
        Sale::create([
            'order_id' => $order->id, 'total' => 500, 'amount_received' => 500, 'change_amount' => 0,
            'cashier' => 'Maria Santos', 'date' => '2026-09-02', 'time' => '12:00 PM',
        ]);

        $response = $this->getJson('/api/reports/monthly?month=2026-09')->assertOk();
        $response->assertJsonFragment(['name' => 'Grilled Chicken', 'category' => 'Main Course', 'qty' => 2, 'revenue' => 400]);
        $response->assertJsonFragment(['category' => 'Beverages', 'qty' => 2, 'revenue' => 100]);
    }

    public function test_monthly_report_splits_the_same_product_by_selling_price(): void
    {
        $this->actingAsAdmin();
        $adobo = MenuItem::create(['name' => 'Adobo (Pork)', 'category' => 'Main Course', 'price' => 195, 'available' => true]);

        foreach ([
            ['date' => '2026-09-01', 'price' => 150, 'quantity' => 5],
            ['date' => '2026-09-02', 'price' => 195, 'quantity' => 84],
        ] as $index => $line) {
            $total = $line['price'] * $line['quantity'];
            $order = Order::create([
                'table_number' => $index + 1, 'subtotal' => $total, 'discount' => 0, 'tax' => 0, 'total' => $total,
                'status' => 'Completed', 'is_paid' => true, 'payment_method' => 'Cash',
            ]);
            OrderItem::create([
                'order_id' => $order->id, 'menu_item_id' => $adobo->id, 'name' => $adobo->name,
                'price' => $line['price'], 'quantity' => $line['quantity'],
            ]);
            Sale::create([
                'order_id' => $order->id, 'total' => $total, 'amount_received' => $total, 'change_amount' => 0,
                'cashier' => 'Maria Santos', 'date' => $line['date'], 'time' => '12:00 PM',
            ]);
        }

        $products = $this->getJson('/api/reports/monthly?month=2026-09')->assertOk()->json('products');

        $this->assertCount(2, $products);
        $this->assertSame(
            [
                ['price' => 150.0, 'qty' => 5, 'revenue' => 750.0],
                ['price' => 195.0, 'qty' => 84, 'revenue' => 16380.0],
            ],
            collect($products)->sortBy('unitPrice')->map(fn($row) => [
                'price' => (float) $row['unitPrice'],
                'qty' => $row['qty'],
                'revenue' => (float) $row['revenue'],
            ])->values()->all(),
        );
    }

    public function test_menu_price_change_records_old_new_staff_and_timestamp(): void
    {
        $admin = $this->actingAsAdmin();
        $menuItem = MenuItem::create([
            'name' => 'Pasta', 'category' => 'Main Course', 'price' => 180, 'available' => true,
        ]);

        $this->putJson("/api/menu-items/{$menuItem->id}", [
            'price' => 195,
            'price_change_reason' => 'Supplier cost increase',
        ])->assertOk();

        $this->assertDatabaseHas('menu_price_histories', [
            'menu_item_id' => $menuItem->id,
            'old_price' => 180,
            'new_price' => 195,
            'changed_by_user_id' => $admin->id,
            'changed_by_name' => 'Maria Santos',
            'reason' => 'Supplier cost increase',
        ]);

        $this->getJson("/api/menu-items/{$menuItem->id}/price-history")->assertOk()
            ->assertJsonPath('0.oldPrice', 180)
            ->assertJsonPath('0.newPrice', 195)
            ->assertJsonPath('0.staffMember', 'Maria Santos')
            ->assertJsonPath('0.reason', 'Supplier cost increase')
            ->assertJsonStructure(['0' => ['changedAt']]);

        $this->getJson('/api/menu-price-history')->assertOk()
            ->assertJsonPath('0.productName', 'Pasta')
            ->assertJsonPath('0.oldPrice', 180)
            ->assertJsonPath('0.newPrice', 195)
            ->assertJsonPath('0.reason', 'Supplier cost increase');
    }
}
