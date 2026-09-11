<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Sale;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SalePaymentKitchenStatusTest extends TestCase
{
    use RefreshDatabase;

    public function test_paying_a_pending_order_does_not_complete_the_kitchen_order(): void
    {
        $user = User::create([
            'full_name' => 'Cashier User',
            'username' => 'cashier_test',
            'email' => 'cashier_test@example.com',
            'password' => 'password123',
            'role' => 'Cashier',
            'is_active' => true,
        ]);
        Sanctum::actingAs($user);

        $order = Order::create([
            'table_number' => 1,
            'customer_name' => 'Table 1',
            'subtotal' => 500,
            'discount' => 0,
            'tax' => 0,
            'total' => 500,
            'status' => 'Pending',
            'is_paid' => false,
        ]);

        Sale::create([
            'order_id' => $order->id,
            'total' => 500,
            'amount_received' => 0,
            'change_amount' => 0,
            'cashier' => 'Cashier User',
            'date' => now()->toDateString(),
            'time' => now()->format('h:i A'),
        ]);

        $this->postJson('/api/sales', [
            'orderId' => $order->id,
            'total' => 500,
            'amountReceived' => 500,
            'change' => 0,
            'cashier' => 'Cashier User',
            'paymentMethod' => 'Cash',
        ])->assertOk()
            ->assertJsonPath('is_paid', true)
            ->assertJsonPath('status', 'Pending');

        $order->refresh();
        $this->assertTrue((bool) $order->is_paid);
        $this->assertSame('Pending', $order->status);
    }

    public function test_paying_an_order_already_being_prepared_preserves_its_status(): void
    {
        $user = User::create([
            'full_name' => 'Cashier User',
            'username' => 'cashier_test',
            'email' => 'cashier_test@example.com',
            'password' => 'password123',
            'role' => 'Cashier',
            'is_active' => true,
        ]);
        Sanctum::actingAs($user);

        $order = Order::create([
            'table_number' => 2,
            'customer_name' => 'Table 2',
            'subtotal' => 250,
            'discount' => 0,
            'tax' => 0,
            'total' => 250,
            'status' => 'Preparing',
            'is_paid' => false,
        ]);

        $this->postJson('/api/sales', [
            'orderId' => $order->id,
            'total' => 250,
            'amountReceived' => 500,
            'change' => 250,
            'cashier' => 'Cashier User',
            'paymentMethod' => 'Cash',
        ])->assertOk()
            ->assertJsonPath('is_paid', true)
            ->assertJsonPath('status', 'Preparing');

        $this->assertSame('Preparing', $order->fresh()->status);
    }
}
