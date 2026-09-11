<?php

namespace App\Services;

use App\Models\MenuItem;

class ServingAvailabilityService
{
    /**
     * Calculate the number of complete servings that can be prepared right now.
     * The ingredient with the fewest possible servings is the limiting ingredient.
     */
    public function calculate(MenuItem $menuItem): array
    {
        $menuItem->loadMissing('recipes.inventoryItem');

        if (!$menuItem->available) {
            return [
                'availableServings' => 0,
                'canServe' => false,
                'hasRecipe' => $menuItem->recipes->isNotEmpty(),
                'limitingIngredient' => null,
            ];
        }

        if ($menuItem->recipes->isEmpty()) {
            return [
                'availableServings' => 0,
                'canServe' => false,
                'hasRecipe' => false,
                'limitingIngredient' => null,
            ];
        }

        $availableServings = null;
        $limitingIngredient = null;

        foreach ($menuItem->recipes as $recipe) {
            $needed = (float) $recipe->quantity_needed;
            $stock = max(0, (float) ($recipe->inventoryItem?->quantity ?? 0));
            $possibleServings = $needed > 0 ? (int) floor($stock / $needed) : 0;

            if ($availableServings === null || $possibleServings < $availableServings) {
                $availableServings = $possibleServings;
                $limitingIngredient = $recipe->inventoryItem?->name;
            }
        }

        $availableServings ??= 0;

        return [
            'availableServings' => $availableServings,
            'canServe' => $availableServings > 0,
            'hasRecipe' => true,
            'limitingIngredient' => $limitingIngredient,
        ];
    }
}
