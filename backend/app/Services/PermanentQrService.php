<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

class PermanentQrService
{
    private const TABLE_SECRET_FILE = 'comoda-table-link.key';
    private const UPDATE_TOKEN_FILE = 'comoda-worker-update.key';
    private const BASE_URL_FILE = 'comoda-qr-base-url.txt';

    public function baseUrl(): ?string
    {
        $configured = trim((string) config('services.comoda_qr.base_url', ''));
        if ($configured !== '') {
            return $this->normalizeWorkersUrl($configured);
        }

        $path = $this->privatePath(self::BASE_URL_FILE);
        if (!is_file($path)) {
            return null;
        }

        return $this->normalizeWorkersUrl(trim((string) file_get_contents($path)));
    }

    public function setBaseUrl(string $url): string
    {
        $normalized = $this->normalizeWorkersUrl($url);
        if ($normalized === null) {
            throw new RuntimeException('The QR base URL must be an HTTPS workers.dev address.');
        }

        $this->atomicWrite($this->privatePath(self::BASE_URL_FILE), $normalized);

        return $normalized;
    }

    public function menuUrl(): ?string
    {
        $base = $this->baseUrl();

        return $base ? $base.'/menu' : null;
    }

    public function tableSignature(int $table): string
    {
        $this->assertTable($table);
        $raw = hash_hmac('sha256', "table:{$table}", $this->tableSecret(), true);

        return substr($this->base64Url($raw), 0, 22);
    }

    public function hasValidTableSignature(int $table, ?string $signature): bool
    {
        if ($table < 1 || $table > 15 || !is_string($signature) || strlen($signature) !== 22) {
            return false;
        }

        return hash_equals($this->tableSignature($table), $signature);
    }

    public function tableUrl(int $table, ?string $fallbackMenuUrl = null): ?string
    {
        $signature = $this->tableSignature($table);
        $base = $this->baseUrl();
        if ($base) {
            return "{$base}/t/{$table}/{$signature}";
        }

        if (!$fallbackMenuUrl) {
            return null;
        }

        $separator = str_contains($fallbackMenuUrl, '?') ? '&' : '?';

        return "{$fallbackMenuUrl}{$separator}table={$table}&qr={$signature}";
    }

    public function tableLinks(?string $fallbackMenuUrl = null): array
    {
        $links = [];
        for ($table = 1; $table <= 15; $table++) {
            $links[(string) $table] = $this->tableUrl($table, $fallbackMenuUrl);
        }

        return $links;
    }

    public function tableSecret(): string
    {
        return $this->readOrCreateSecret(self::TABLE_SECRET_FILE);
    }

    public function updateToken(): string
    {
        return $this->readOrCreateSecret(self::UPDATE_TOKEN_FILE);
    }

    public function publishOrigin(string $origin): array
    {
        $origin = $this->normalizeTunnelOrigin($origin);
        if ($origin === null) {
            throw new RuntimeException('The tunnel did not return a valid trycloudflare.com origin.');
        }

        $base = $this->baseUrl();
        if (!$base) {
            throw new RuntimeException('The permanent workers.dev QR address has not been configured yet.');
        }

        $request = Http::asJson()
            ->acceptJson()
            ->withToken($this->updateToken())
            ->timeout(20);

        if ($caBundle = $this->caBundlePath()) {
            $request = $request->withOptions(['verify' => $caBundle]);
        }

        $response = $request->put($base.'/_system/origin', ['origin' => $origin]);

        if (!$response->successful()) {
            $message = trim((string) $response->body());
            throw new RuntimeException('Could not publish the current tunnel to the permanent QR address'.($message ? ": {$message}" : '.'));
        }

        return (array) $response->json();
    }

    public function normalizeTunnelOrigin(string $url): ?string
    {
        $parts = parse_url(trim($url));
        if (!is_array($parts)) {
            return null;
        }

        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower((string) ($parts['host'] ?? ''));
        $path = (string) ($parts['path'] ?? '');

        if (
            $scheme !== 'https'
            || !preg_match('/^[a-z0-9-]+\.trycloudflare\.com$/', $host)
            || $host === 'api.trycloudflare.com'
            || isset($parts['user'])
            || isset($parts['pass'])
            || (isset($parts['port']) && (int) $parts['port'] !== 443)
            || ($path !== '' && $path !== '/')
            || isset($parts['query'])
            || isset($parts['fragment'])
        ) {
            return null;
        }

        return "https://{$host}";
    }

    private function normalizeWorkersUrl(string $url): ?string
    {
        $parts = parse_url(trim($url));
        if (!is_array($parts)) {
            return null;
        }

        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower((string) ($parts['host'] ?? ''));
        $path = (string) ($parts['path'] ?? '');

        if (
            $scheme !== 'https'
            || !preg_match('/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.workers\.dev$/', $host)
            || isset($parts['user'])
            || isset($parts['pass'])
            || isset($parts['port'])
            || ($path !== '' && $path !== '/')
            || isset($parts['query'])
            || isset($parts['fragment'])
        ) {
            return null;
        }

        return "https://{$host}";
    }

    private function assertTable(int $table): void
    {
        if ($table < 1 || $table > 15) {
            throw new RuntimeException('Table number must be between 1 and 15.');
        }
    }

    private function readOrCreateSecret(string $filename): string
    {
        $path = $this->privatePath($filename);
        if (is_file($path)) {
            $existing = trim((string) file_get_contents($path));
            if (strlen($existing) >= 32) {
                return $existing;
            }
        }

        $secret = $this->base64Url(random_bytes(32));
        $directory = dirname($path);
        if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
            throw new RuntimeException('Could not create private QR configuration storage.');
        }

        $handle = @fopen($path, 'x');
        if ($handle !== false) {
            fwrite($handle, $secret);
            fclose($handle);
            @chmod($path, 0600);

            return $secret;
        }

        $existing = trim((string) @file_get_contents($path));
        if (strlen($existing) < 32) {
            throw new RuntimeException('Could not save the private QR configuration.');
        }

        return $existing;
    }

    private function privatePath(string $filename): string
    {
        return storage_path('app/private/'.$filename);
    }

    public function caBundlePath(): ?string
    {
        $candidates = [
            config('services.comoda_qr.ca_bundle'),
            ini_get('curl.cainfo'),
            ini_get('openssl.cafile'),
        ];

        if (PHP_OS_FAMILY === 'Windows') {
            $candidates = array_merge($candidates, [
                'C:\\xampp\\apache\\bin\\curl-ca-bundle.crt',
                'C:\\xampp\\php\\extras\\ssl\\cacert.pem',
                'C:\\php\\extras\\ssl\\cacert.pem',
            ]);
        }

        foreach ($candidates as $candidate) {
            if (is_string($candidate) && trim($candidate) !== '' && is_file($candidate)) {
                return $candidate;
            }
        }

        return null;
    }

    private function atomicWrite(string $path, string $contents): void
    {
        $directory = dirname($path);
        if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
            throw new RuntimeException('Could not create private QR configuration storage.');
        }

        $temporary = $path.'.tmp';
        if (file_put_contents($temporary, $contents, LOCK_EX) === false || !rename($temporary, $path)) {
            @unlink($temporary);
            throw new RuntimeException('Could not save the permanent QR configuration.');
        }
        @chmod($path, 0600);
    }

    private function base64Url(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }
}
