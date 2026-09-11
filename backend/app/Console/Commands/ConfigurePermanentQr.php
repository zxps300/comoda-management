<?php

namespace App\Console\Commands;

use App\Services\PermanentQrService;
use Illuminate\Console\Command;
use Throwable;

class ConfigurePermanentQr extends Command
{
    protected $signature = 'comoda:qr:configure
        {--base-url= : Save the deployed workers.dev base URL}
        {--show-table-secret : Print the table-link signing secret}
        {--show-update-token : Print the Worker update token}';

    protected $description = 'Configure the permanent Comoda QR router';

    public function handle(PermanentQrService $qr): int
    {
        try {
            if ($url = $this->option('base-url')) {
                $saved = $qr->setBaseUrl((string) $url);
                $this->info("Permanent QR address saved: {$saved}");
            }

            if ($this->option('show-table-secret')) {
                $this->output->write($qr->tableSecret());
            }

            if ($this->option('show-update-token')) {
                $this->output->write($qr->updateToken());
            }

            if (!$url && !$this->option('show-table-secret') && !$this->option('show-update-token')) {
                $current = $qr->baseUrl();
                $this->line($current ? "Permanent QR address: {$current}" : 'Permanent QR address is not configured.');
            }

            return self::SUCCESS;
        } catch (Throwable $error) {
            $this->error($error->getMessage());

            return self::FAILURE;
        }
    }
}
