<?php

namespace Tests\Feature;

use App\Services\PermanentQrService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class QrCustomerAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_table_status_rejects_a_guessed_link(): void
    {
        $this->getJson('/api/table-status/1?qr=AAAAAAAAAAAAAAAAAAAAAA')
            ->assertForbidden()
            ->assertJsonFragment(['message' => 'This table QR code is not valid. Please scan the printed QR code again.']);
    }

    public function test_table_status_accepts_the_signed_table_link(): void
    {
        $signature = app(PermanentQrService::class)->tableSignature(1);

        $this->getJson('/api/table-status/1?qr='.urlencode($signature))
            ->assertOk()
            ->assertJsonPath('table', 1);
    }

    public function test_customer_order_requires_a_qr_token(): void
    {
        $this->postJson('/api/customer-order', [
            'tableNumber' => 1,
            'items' => [['menuItemId' => 1, 'quantity' => 1]],
        ])->assertUnprocessable()->assertJsonValidationErrors('qrToken');
    }
}
