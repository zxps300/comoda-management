<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Process;
use RuntimeException;

class CloudflareTunnelService
{
    public function __construct(private readonly PermanentQrService $permanentQr)
    {
    }

    public function status(): array
    {
        $pid = $this->savedPid();
        $publicUrl = $this->savedPublicUrl();
        $running = $pid !== null
            && $publicUrl !== null
            && (PHP_OS_FAMILY === 'Windows'
                ? $this->hasFreshSupervisorHeartbeat()
                : $this->isOwnedProcessRunning($pid));

        if ($running) {
            try {
                $healthUrl = $this->permanentQr->menuUrl() ?? rtrim($publicUrl, '/').'/up';
                $options = ['allow_redirects' => false];
                if ($caBundle = $this->permanentQr->caBundlePath()) {
                    $options['verify'] = $caBundle;
                }
                $health = Http::connectTimeout(2)->timeout(6)->withOptions($options)->get($healthUrl);
                $running = $health->status() >= 200 && $health->status() < 400;
            } catch (\Throwable) {
                $running = false;
            }
        }

        if (!$running) {
            $publicUrl = null;
        }

        return [
            'installed' => is_file($this->binaryPath()),
            'running' => $running,
            'public_url' => $publicUrl,
            'permanent_url' => $this->permanentQr->menuUrl(),
            'permanent_configured' => $this->permanentQr->baseUrl() !== null,
            'backend_port' => $this->backendPort(),
        ];
    }

    public function install(): array
    {
        if (is_file($this->binaryPath())) {
            return $this->status();
        }

        $toolsDirectory = dirname($this->binaryPath());
        if (!is_dir($toolsDirectory) && !mkdir($toolsDirectory, 0755, true) && !is_dir($toolsDirectory)) {
            throw new RuntimeException('Could not create the tools directory.');
        }

        $response = Http::timeout(120)->get(
            'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'
        );
        if (!$response->successful() || file_put_contents($this->binaryPath(), $response->body(), LOCK_EX) === false) {
            throw new RuntimeException('Could not download cloudflared. Check the internet connection and try again.');
        }

        return $this->status();
    }

    public function start(): array
    {
        if (!is_file($this->binaryPath())) {
            throw new RuntimeException('Cloudflare is not installed.');
        }

        $current = $this->status();
        if ($current['running'] && $current['public_url']) {
            return $this->publishAndReturn($current['public_url']);
        }

        $healthUrl = 'http://127.0.0.1:'.$this->backendPort().'/up';
        try {
            $health = Http::timeout(3)->get($healthUrl);
        } catch (\Throwable) {
            $health = null;
        }
        if (!$health || !$health->successful()) {
            throw new RuntimeException('The Comoda backend is not running on port '.$this->backendPort().'.');
        }

        $result = Process::timeout(55)->run([
            'powershell.exe',
            '-NoProfile',
            '-NonInteractive',
            '-ExecutionPolicy',
            'Bypass',
            '-File',
            $this->projectRoot().DIRECTORY_SEPARATOR.'scripts'.DIRECTORY_SEPARATOR.'start-comoda-tunnel.ps1',
            '-ProjectRoot',
            $this->projectRoot(),
            '-BackendPort',
            (string) $this->backendPort(),
        ]);

        if (!$result->successful()) {
            throw new RuntimeException(trim($result->errorOutput() ?: $result->output()) ?: 'Could not start the Cloudflare tunnel.');
        }

        $match = [];
        preg_match('/https:\/\/(?!api\.)[a-zA-Z0-9-]+\.trycloudflare\.com/', $result->output(), $match);
        $origin = $match[0] ?? $this->savedPublicUrl();
        if (!$origin) {
            throw new RuntimeException('Cloudflare started but did not return a public address.');
        }

        return $this->publishAndReturn($origin);
    }

    public function stop(): array
    {
        $result = Process::timeout(15)->run([
            'powershell.exe',
            '-NoProfile',
            '-NonInteractive',
            '-ExecutionPolicy',
            'Bypass',
            '-File',
            $this->projectRoot().DIRECTORY_SEPARATOR.'scripts'.DIRECTORY_SEPARATOR.'stop-comoda-tunnel.ps1',
            '-ProjectRoot',
            $this->projectRoot(),
        ]);

        if (!$result->successful()) {
            throw new RuntimeException(trim($result->errorOutput() ?: $result->output()) ?: 'Could not stop the Cloudflare tunnel.');
        }

        return $this->status();
    }

    public function localMenuUrl(): string
    {
        return 'http://127.0.0.1:'.$this->backendPort().'/menu.html';
    }

    private function publishAndReturn(string $origin): array
    {
        $published = false;
        $publishError = null;

        if ($this->permanentQr->baseUrl()) {
            try {
                $this->permanentQr->publishOrigin($origin);
                $published = true;
            } catch (\Throwable $error) {
                $publishError = $error->getMessage();
            }
        }

        return [
            ...$this->status(),
            'published' => $published,
            'publish_error' => $publishError,
        ];
    }

    private function savedPid(): ?int
    {
        $path = $this->runtimePath('cloudflared.pid');
        if (!is_file($path)) {
            return null;
        }

        $value = trim((string) file_get_contents($path));

        return ctype_digit($value) && (int) $value > 0 ? (int) $value : null;
    }

    private function savedPublicUrl(): ?string
    {
        $path = $this->runtimePath('cloudflare_url.txt');
        if (!is_file($path)) {
            return null;
        }

        return $this->permanentQr->normalizeTunnelOrigin(trim((string) file_get_contents($path)));
    }

    private function isOwnedProcessRunning(int $pid): bool
    {
        if (PHP_OS_FAMILY !== 'Windows') {
            return function_exists('posix_kill') && @posix_kill($pid, 0);
        }

        $result = Process::timeout(5)->run([
            'powershell.exe',
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            '$p = Get-CimInstance Win32_Process -Filter "ProcessId='.$pid.'" -ErrorAction SilentlyContinue; if ($p -and $p.Name -eq "cloudflared.exe") { $p.ExecutablePath }',
        ]);

        $path = trim($result->output());

        if ($result->successful()
            && $path !== ''
            && strcasecmp(str_replace('/', '\\', $path), str_replace('/', '\\', $this->binaryPath())) === 0
        ) {
            return true;
        }

        // Some hidden/non-interactive Windows processes cannot read
        // ExecutablePath through CIM even though the saved process is alive.
        // tasklist is a read-only fallback; destructive actions still perform
        // the stricter ownership check in the PowerShell stop script.
        $taskList = Process::timeout(5)->run([
            'C:\\Windows\\System32\\tasklist.exe',
            '/FI',
            'PID eq '.$pid,
            '/FO',
            'CSV',
            '/NH',
        ]);

        return $taskList->successful()
            && preg_match('/^"cloudflared\.exe","'.preg_quote((string) $pid, '/').'"/i', trim($taskList->output())) === 1;
    }

    private function hasFreshSupervisorHeartbeat(): bool
    {
        $path = $this->runtimePath('supervisor-heartbeat.txt');
        if (!is_file($path)) {
            return false;
        }

        $timestamp = strtotime(trim((string) file_get_contents($path)));

        return $timestamp !== false
            && $timestamp <= time() + 5
            && time() - $timestamp <= 20;
    }

    private function backendPort(): int
    {
        $port = (int) config('services.comoda_qr.backend_port', 8001);

        return $port >= 1 && $port <= 65535 ? $port : 8001;
    }

    private function runtimePath(string $filename): string
    {
        return $this->projectRoot().DIRECTORY_SEPARATOR.'runtime'.DIRECTORY_SEPARATOR.$filename;
    }

    private function binaryPath(): string
    {
        return $this->projectRoot().DIRECTORY_SEPARATOR.'tools'.DIRECTORY_SEPARATOR.'cloudflared.exe';
    }

    private function projectRoot(): string
    {
        return realpath(base_path('..')) ?: dirname(base_path());
    }
}
