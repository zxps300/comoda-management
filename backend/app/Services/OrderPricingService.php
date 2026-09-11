<?php

namespace App\Services;

use App\Models\MenuItem;
use Illuminate\Validation\ValidationException;

class OrderPricingService
{
    /**
     * Resolve menu names and prices from the database. Client-submitted prices
     * are deliberately ignored.
     *
     * @return array{items: array<int, array<string, mixed>>, subtotal: float}
     */
    public function price(array $lines, string $orderType): array
    {
        $menuIds = collect($lines)->pluck('menuItemId')->filter()->unique()->values();
        $menuItems = MenuItem::with('variants')
            ->whereIn('id', $menuIds)
            ->get()
            ->keyBy('id');

        $items = [];
        $subtotal = 0.0;

        foreach ($lines as $index => $line) {
            $menuItem = $menuItems->get((int) ($line['menuItemId'] ?? 0));
            if (!$menuItem || !$menuItem->available) {
                throw ValidationException::withMessages([
                    "items.$index.menuItemId" => 'This menu item is unavailable or no longer exists.',
                ]);
            }

            $variant = null;
            if (!empty($line['variantId'])) {
                $variant = $menuItem->variants->firstWhere('id', (int) $line['variantId']);
                if (!$variant) {
                    throw ValidationException::withMessages([
                        "items.$index.variantId" => 'The selected size does not belong to this menu item.',
                    ]);
                }
            }

            $quantity = (int) $line['quantity'];
            $basePrice = $variant?->price ?? $menuItem->price;
            $takeOutPrice = $variant?->take_out_price ?? $menuItem->take_out_price;
            $price = $orderType === 'Take Out' && $takeOutPrice !== null
                ? (float) $takeOutPrice
                : (float) $basePrice;
            $name = $menuItem->name . ($variant ? " ({$variant->label})" : '');

            $items[] = [
                'menu_item_id' => $menuItem->id,
                'name' => $name,
                'price' => round($price, 2),
                'quantity' => $quantity,
            ];
            $subtotal += $price * $quantity;
        }

        return [
            'items' => $items,
            'subtotal' => round($subtotal, 2),
        ];
    }
}
