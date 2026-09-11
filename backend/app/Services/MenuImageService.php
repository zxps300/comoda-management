<?php

namespace App\Services;

use Illuminate\Support\Facades\Storage;

class MenuImageService
{
    private const MAX_EDGE = 720;
    private const WEBP_QUALITY = 78;

    public static function thumbnailPathFor(string $imagePath): string
    {
        $relativePath = ltrim(preg_replace('#^/?storage/#', '', $imagePath), '/');
        $filename = pathinfo($relativePath, PATHINFO_FILENAME).'.webp';

        return 'menu-items/thumbnails/'.$filename;
    }

    public function createThumbnail(?string $imagePath): ?string
    {
        if (!$imagePath || filter_var($imagePath, FILTER_VALIDATE_URL) || !function_exists('imagewebp')) {
            return null;
        }

        $relativePath = ltrim(preg_replace('#^/?storage/#', '', $imagePath), '/');
        $disk = Storage::disk('public');

        if (!$disk->exists($relativePath)) {
            return null;
        }

        $contents = $disk->get($relativePath);
        $source = @imagecreatefromstring($contents);
        if (!$source) {
            return null;
        }

        $sourceWidth = imagesx($source);
        $sourceHeight = imagesy($source);
        $scale = min(1, self::MAX_EDGE / max($sourceWidth, $sourceHeight));
        $targetWidth = max(1, (int) round($sourceWidth * $scale));
        $targetHeight = max(1, (int) round($sourceHeight * $scale));
        $thumbnail = imagecreatetruecolor($targetWidth, $targetHeight);

        imagealphablending($thumbnail, false);
        imagesavealpha($thumbnail, true);
        $transparent = imagecolorallocatealpha($thumbnail, 0, 0, 0, 127);
        imagefilledrectangle($thumbnail, 0, 0, $targetWidth, $targetHeight, $transparent);
        imagecopyresampled(
            $thumbnail,
            $source,
            0,
            0,
            0,
            0,
            $targetWidth,
            $targetHeight,
            $sourceWidth,
            $sourceHeight,
        );

        $thumbnailPath = self::thumbnailPathFor($relativePath);
        $disk->makeDirectory(dirname($thumbnailPath));
        $written = imagewebp($thumbnail, $disk->path($thumbnailPath), self::WEBP_QUALITY);

        imagedestroy($thumbnail);
        imagedestroy($source);

        return $written ? $thumbnailPath : null;
    }
}
