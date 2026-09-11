<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;
use App\Services\MenuImageService;

class MenuItem extends Model
{
    protected $fillable = [
        'name', 'description', 'category', 'price', 'take_out_price',
        'available', 'is_best_seller', 'image',
    ];

    protected function casts(): array
    {
        return [
            'price'         => 'decimal:2',
            'take_out_price'=> 'decimal:2',
            'available'     => 'boolean',
            'is_best_seller'=> 'boolean',
        ];
    }

    public function variants(): HasMany
    {
        return $this->hasMany(MenuItemVariant::class)->orderBy('sort_order');
    }

    public function recipes(): HasMany
    {
        return $this->hasMany(MenuItemRecipe::class);
    }

    public function priceHistory(): HasMany
    {
        return $this->hasMany(MenuPriceHistory::class)->latest();
    }

    public function getImageAttribute($value)
    {
        if (!$value) {
            return null;
        }

        if (filter_var($value, FILTER_VALIDATE_URL)) {
            $parts = parse_url($value);
            $host = strtolower((string) ($parts['host'] ?? ''));
            $isLocalAddress = $host === 'localhost'
                || $host === '127.0.0.1'
                || str_starts_with($host, '192.168.')
                || str_starts_with($host, '10.')
                || preg_match('/^172\.(1[6-9]|2\d|3[01])\./', $host)
                || str_ends_with($host, '.trycloudflare.com');

            if (!$isLocalAddress) {
                return $value;
            }

            $path = (string) ($parts['path'] ?? '');
            $query = isset($parts['query']) ? '?'.$parts['query'] : '';

            return $path.$query;
        }

        if (str_starts_with($value, '/')) {
            return $value;
        }

        return '/storage/'.ltrim($value, '/');
    }

    public function getThumbnailAttribute(): ?string
    {
        $originalPath = (string) $this->getRawOriginal('image');
        if (!$originalPath) {
            return null;
        }

        if (filter_var($originalPath, FILTER_VALIDATE_URL)) {
            return $this->image;
        }

        $thumbnailPath = MenuImageService::thumbnailPathFor($originalPath);
        if (Storage::disk('public')->exists($thumbnailPath)) {
            return '/storage/'.$thumbnailPath;
        }

        return $this->image;
    }
}
