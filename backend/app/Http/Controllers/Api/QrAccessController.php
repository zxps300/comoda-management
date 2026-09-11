<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CloudflareTunnelService;
use App\Services\PermanentQrService;
use Illuminate\Http\JsonResponse;
use RuntimeException;
use Throwable;

class QrAccessController extends Controller
{
    public function __construct(
        private readonly CloudflareTunnelService $tunnel,
        private readonly PermanentQrService $permanentQr,
    ) {
    }

    public function serverInfo(): JsonResponse
    {
        $status = $this->tunnel->status();
        $permanentMenu = $this->permanentQr->menuUrl();
        $temporaryMenu = $status['public_url'] ? rtrim($status['public_url'], '/').'/menu.html' : null;
        $menuUrl = $permanentMenu ?? $temporaryMenu ?? $this->tunnel->localMenuUrl();
        $mode = $permanentMenu ? 'permanent' : ($temporaryMenu ? 'public' : 'local');

        return response()->json([
            'menu_url' => $menuUrl,
            'qr_base_url' => $this->permanentQr->baseUrl(),
            'mode' => $mode,
            'tunnel' => 'cloudflare',
            'tunnel_status' => $status['running'] ? 'running' : 'stopped',
            'public_origin' => $status['public_url'],
            'port' => $status['backend_port'],
        ]);
    }

    public function tableLinks(): JsonResponse
    {
        $status = $this->tunnel->status();
        $fallbackMenu = $status['public_url']
            ? rtrim($status['public_url'], '/').'/menu.html'
            : $this->tunnel->localMenuUrl();

        return response()->json([
            'general_url' => $this->permanentQr->menuUrl() ?? $fallbackMenu,
            'table_links' => $this->permanentQr->tableLinks($fallbackMenu),
            'permanent' => $this->permanentQr->baseUrl() !== null,
        ]);
    }

    public function status(): JsonResponse
    {
        return response()->json($this->tunnel->status());
    }

    public function install(): JsonResponse
    {
        return $this->run(fn () => $this->tunnel->install(), 'Cloudflare installed successfully.');
    }

    public function start(): JsonResponse
    {
        return $this->run(fn () => $this->tunnel->start(), 'Internet access started.');
    }

    public function stop(): JsonResponse
    {
        return $this->run(fn () => $this->tunnel->stop(), 'Internet access stopped.');
    }

    private function run(callable $operation, string $message): JsonResponse
    {
        try {
            return response()->json([
                'success' => true,
                'message' => $message,
                ...$operation(),
            ]);
        } catch (RuntimeException $error) {
            return response()->json(['success' => false, 'message' => $error->getMessage()], 422);
        } catch (Throwable $error) {
            report($error);

            return response()->json(['success' => false, 'message' => 'The internet connection could not be changed.'], 500);
        }
    }
}
