<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$request = Illuminate\Http\Request::create('/api/orders/kitchen-stats?from=2026-01-04&to=2026-05-04', 'GET');
$controller = $app->make(\App\Http\Controllers\Api\OrderController::class);
echo $controller->kitchenStats($request)->getContent();
