<?php

namespace App\Console\Commands;

use App\Services\PermanentQrService;
use Illuminate\Console\Command;
use Throwable;

class PublishPermanentQrOrigin extends Command
{
    protected $signature = 'comoda:qr:publish {origin : Current trycloudflare.com origin}';

    protected $description = 'Publish the current Quick Tunnel origin to the permanent QR router';

    public function handle(PermanentQrService $qr): int
    {
        try {
            $result = $qr->publishOrigin((string) $this->argument('origin'));
            $updatedAt = $result['updatedAt'] ?? now()->toISOString();
            $this->info("Permanent QR target updated at {$updatedAt}.");

            return self::SUCCESS;
        } catch (Throwable $error) {
            $this->error($error->getMessage());

            return self::FAILURE;
        }
    }
}
