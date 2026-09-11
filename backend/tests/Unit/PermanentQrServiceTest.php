<?php

namespace Tests\Unit;

use App\Models\MenuItem;
use App\Services\PermanentQrService;
use Tests\TestCase;

class PermanentQrServiceTest extends TestCase
{
    public function test_table_links_are_stable_and_signed(): void
    {
        $service = app(PermanentQrService::class);

        $first = $service->tableSignature(7);
        $second = $service->tableSignature(7);

        $this->assertSame($first, $second);
        $this->assertMatchesRegularExpression('/^[A-Za-z0-9_-]{22}$/', $first);
        $this->assertTrue($service->hasValidTableSignature(7, $first));
        $this->assertFalse($service->hasValidTableSignature(8, $first));
    }

    public function test_only_trycloudflare_origins_can_be_published(): void
    {
        $service = app(PermanentQrService::class);

        $this->assertSame(
            'https://quiet-river.trycloudflare.com',
            $service->normalizeTunnelOrigin('https://quiet-river.trycloudflare.com'),
        );
        $this->assertNull($service->normalizeTunnelOrigin('http://quiet-river.trycloudflare.com'));
        $this->assertNull($service->normalizeTunnelOrigin('https://api.trycloudflare.com'));
        $this->assertNull($service->normalizeTunnelOrigin('https://example.com'));
        $this->assertNull($service->normalizeTunnelOrigin('https://quiet-river.trycloudflare.com/admin'));
    }

    public function test_local_uploaded_images_use_same_origin_paths(): void
    {
        $item = new MenuItem();
        $item->setRawAttributes(['image' => 'menu-items/example.jpg']);
        $this->assertSame('/storage/menu-items/example.jpg', $item->image);

        $item->setRawAttributes(['image' => 'http://127.0.0.1:8001/storage/menu-items/example.jpg']);
        $this->assertSame('/storage/menu-items/example.jpg', $item->image);

        $item->setRawAttributes(['image' => 'https://images.example.com/example.jpg']);
        $this->assertSame('https://images.example.com/example.jpg', $item->image);
    }
}
