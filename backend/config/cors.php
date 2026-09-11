<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => explode(',', env('CORS_ALLOWED_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173,http://localhost:3000,http://127.0.0.1:3000,http://localhost:8000,http://127.0.0.1:8000')),

    'allowed_origins_patterns' => [
        '#^https?://(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$#', // Local private LAN IP ranges for mobile tablets & QR menu
        '#^https://[a-zA-Z0-9-]+\.trycloudflare\.com$#', // Cloudflare tunnel URLs if active
        '#^https://[a-zA-Z0-9-]+\.asse\.devtunnels\.ms$#', // VS Code Dev Tunnels
    ],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,
];
