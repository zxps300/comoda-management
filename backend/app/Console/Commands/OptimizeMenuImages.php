<?php

namespace App\Console\Commands;

use App\Models\MenuItem;
use App\Services\MenuImageService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class OptimizeMenuImages extends Command
{
    protected $signature = 'comoda:optimize-menu-images {--force : Rebuild thumbnails that already exist}';

    protected $description = 'Create lightweight WebP thumbnails for locally stored menu photos';

    public function handle(MenuImageService $images): int
    {
        $created = 0;
        $skipped = 0;

        MenuItem::whereNotNull('image')->orderBy('id')->each(function (MenuItem $item) use ($images, &$created, &$skipped) {
            $originalPath = (string) $item->getRawOriginal('image');
            if (!$originalPath || filter_var($originalPath, FILTER_VALIDATE_URL)) {
                $skipped++;
                return;
            }

            $thumbnailPath = MenuImageService::thumbnailPathFor($originalPath);
            if (!$this->option('force') && Storage::disk('public')->exists($thumbnailPath)) {
                $skipped++;
                return;
            }

            if ($images->createThumbnail($originalPath)) {
                $created++;
            } else {
                $skipped++;
                $this->warn("Could not optimize image for {$item->name}.");
            }
        });

        $this->info("Menu image optimization complete: {$created} created, {$skipped} skipped.");

        return self::SUCCESS;
    }
}
