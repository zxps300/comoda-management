<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Sale;
use Laravel\Sanctum\Sanctum;
use Illuminate\Foundation\Testing\RefreshDatabase;

class ReportPaidFilterTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::create([
            'full_name' => 'Admin User',
            'username'  => 'admin_test',
            'email'     => 'admin_test@example.com',
            'password'  => 'password123',
            'role'      => 'Admin',
            'is_active' => true,
        ]);
    }

    public function test_reports_all_strictly_includes_paid_orders_and_excludes_unpaid_or_cancelled(): void
    {
        Sanctum::actingAs($this->admin);

        // 1. Create 3 PAID orders with sales (March to August 2026 dates)
        $paidOrder1 = Order::create([
            'table_number'   => 1,
            'customer_name'  => 'Customer 1',
            'subtotal'       => 500,
            'discount'       => 0,
            'tax'            => 0,
            'total'          => 500,
            'status'         => 'Completed',
            'is_paid'        => true,
            'payment_method' => 'Cash',
        ]);
        OrderItem::create(['order_id' => $paidOrder1->id, 'name' => 'Burger', 'price' => 250, 'quantity' => 2]);
        Sale::create([
            'order_id'        => $paidOrder1->id,
            'total'           => 500,
            'amount_received' => 500,
            'change_amount'   => 0,
            'cashier'         => 'Cashier 1',
            'date'            => '2026-03-15',
            'time'            => '12:00 PM',
        ]);

        $paidOrder2 = Order::create([
            'table_number'   => 2,
            'customer_name'  => 'Customer 2',
            'subtotal'       => 300,
            'discount'       => 0,
            'tax'            => 0,
            'total'          => 300,
            'status'         => 'Completed',
            'is_paid'        => true,
            'payment_method' => 'Online Payment',
        ]);
        OrderItem::create(['order_id' => $paidOrder2->id, 'name' => 'Pasta', 'price' => 300, 'quantity' => 1]);
        Sale::create([
            'order_id'        => $paidOrder2->id,
            'total'           => 300,
            'amount_received' => 300,
            'change_amount'   => 0,
            'cashier'         => 'Cashier 2',
            'date'            => '2026-05-10',
            'time'            => '01:30 PM',
        ]);

        $paidOrder3 = Order::create([
            'table_number'   => 3,
            'customer_name'  => 'Customer 3',
            'subtotal'       => 200,
            'discount'       => 0,
            'tax'            => 0,
            'total'          => 200,
            'status'         => 'Completed',
            'is_paid'        => true,
            'payment_method' => 'Cash',
        ]);
        OrderItem::create(['order_id' => $paidOrder3->id, 'name' => 'Iced Tea', 'price' => 100, 'quantity' => 2]);
        Sale::create([
            'order_id'        => $paidOrder3->id,
            'total'           => 200,
            'amount_received' => 200,
            'change_amount'   => 0,
            'cashier'         => 'Cashier 1',
            'date'            => '2026-08-18',
            'time'            => '11:00 AM',
        ]);

        // 2. Create 2 UNPAID orders with sales (should be EXCLUDED)
        $unpaidOrder1 = Order::create([
            'table_number'   => 4,
            'customer_name'  => 'Table 4 (Self-Order)',
            'subtotal'       => 450,
            'discount'       => 0,
            'tax'            => 0,
            'total'          => 450,
            'status'         => 'Pending',
            'is_paid'        => false,
            'payment_method' => 'Cash',
        ]);
        OrderItem::create(['order_id' => $unpaidOrder1->id, 'name' => 'Pizza', 'price' => 450, 'quantity' => 1]);
        Sale::create([
            'order_id'        => $unpaidOrder1->id,
            'total'           => 450,
            'amount_received' => 0,
            'change_amount'   => 0,
            'cashier'         => 'Self-Order (QR)',
            'date'            => '2026-04-02',
            'time'            => '02:00 PM',
        ]);

        $unpaidOrder2 = Order::create([
            'table_number'   => 5,
            'customer_name'  => 'Customer 5',
            'subtotal'       => 150,
            'discount'       => 0,
            'tax'            => 0,
            'total'          => 150,
            'status'         => 'Preparing',
            'is_paid'        => false,
            'payment_method' => 'Cash',
        ]);
        OrderItem::create(['order_id' => $unpaidOrder2->id, 'name' => 'Fries', 'price' => 150, 'quantity' => 1]);
        Sale::create([
            'order_id'        => $unpaidOrder2->id,
            'total'           => 150,
            'amount_received' => 0,
            'change_amount'   => 0,
            'cashier'         => 'Cashier 1',
            'date'            => '2026-07-20',
            'time'            => '03:15 PM',
        ]);

        // 3. Create 1 CANCELLED order (should be EXCLUDED)
        $cancelledOrder = Order::create([
            'table_number'   => 6,
            'customer_name'  => 'Cancelled Cust',
            'subtotal'       => 600,
            'discount'       => 0,
            'tax'            => 0,
            'total'          => 600,
            'status'         => 'Cancelled',
            'is_paid'        => true,
            'payment_method' => 'Cash',
        ]);
        OrderItem::create(['order_id' => $cancelledOrder->id, 'name' => 'Steak', 'price' => 600, 'quantity' => 1]);
        Sale::create([
            'order_id'        => $cancelledOrder->id,
            'total'           => 600,
            'amount_received' => 600,
            'change_amount'   => 0,
            'cashier'         => 'Cashier 1',
            'date'            => '2026-06-12',
            'time'            => '06:00 PM',
        ]);

        // ── Query Safety Parity Check ──
        $expectedPaidCount = Order::where('is_paid', true)->where('status', '!=', 'Cancelled')->count();
        $this->assertEquals(3, $expectedPaidCount);

        // ── Test /api/reports/all endpoint ──
        $response = $this->getJson('/api/reports/all');
        $response->assertStatus(200);

        $json = $response->json();

        // 1. Verify Count Parity: COUNT(returned rows) === COUNT(orders where is_paid = true)
        $this->assertCount($expectedPaidCount, $json['transactions']);
        $this->assertEquals($expectedPaidCount, $json['transactionCount']);

        // 2. Verify Total Revenue Parity (500 + 300 + 200 = 1000)
        $this->assertEquals(1000.0, (float)$json['totalRevenue']);

        // 3. Verify row-by-row payment status auditability
        foreach ($json['transactions'] as $txn) {
            $this->assertArrayHasKey('isPaid', $txn);
            $this->assertTrue($txn['isPaid'], 'Every transaction in reports must have isPaid = true');
        }

        // 4. Verify unpaid and cancelled IDs are completely absent
        $returnedSaleIds = collect($json['transactions'])->pluck('id')->toArray();
        $unpaidSaleIds = Sale::whereIn('order_id', [$unpaidOrder1->id, $unpaidOrder2->id, $cancelledOrder->id])->pluck('id')->toArray();
        foreach ($unpaidSaleIds as $badId) {
            $this->assertNotContains($badId, $returnedSaleIds);
        }
    }
}
