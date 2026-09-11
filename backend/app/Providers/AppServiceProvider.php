<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('customer-menu', fn (Request $request) =>
            Limit::perMinute(120)->by('customer-menu:'.$request->ip())
        );

        RateLimiter::for('customer-table-status', fn (Request $request) => [
            Limit::perMinute(60)->by('table-status-ip:'.$request->ip()),
            Limit::perMinute(30)->by('table-status-table:'.$request->route('table')),
        ]);

        RateLimiter::for('customer-orders', fn (Request $request) => [
            Limit::perMinute(8)->by('customer-order-ip:'.$request->ip()),
            Limit::perMinute(3)->by('customer-order-table:'.(int) $request->input('tableNumber')),
        ]);
    }
}
