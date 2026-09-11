<?php

namespace Database\Seeders;

use App\Models\InventoryItem;
use App\Models\MenuItem;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class CompleteMenuRecipesSeeder extends Seeder
{
    public function run(): void
    {
        $catalog = [
            'EGG'=>['Others','pcs',50,15], 'BREAD'=>['For Baking','pcs',40,10], 'TOMATOES'=>['Vegetables&Fruits','kg',12,3],
            'MANGO'=>['Vegetables&Fruits','kg',20,5], 'PEAS'=>['Vegetables&Fruits','kg',10,3], 'BEANS'=>['Grains','kg',15,4],
            'SAUSAGES'=>['Meats','pcs',60,12], 'RICE'=>['Grains','kg',50,12], 'GARLIC'=>['Vegetables&Fruits','kg',8,2],
            'ONION'=>['Vegetables&Fruits','kg',10,3], 'CARROTS'=>['Vegetables&Fruits','kg',10,3], 'CABBAGE'=>['Vegetables&Fruits','kg',10,3],
            'LETTUCE'=>['Vegetables&Fruits','kg',8,2], 'CUCUMBER'=>['Vegetables&Fruits','kg',10,3], 'AVOCADO'=>['Vegetables&Fruits','kg',12,3],
            'LEMON'=>['Vegetables&Fruits','kg',10,3], 'LIME'=>['Vegetables&Fruits','kg',8,2], 'WATERMELON'=>['Vegetables&Fruits','kg',20,5],
            'STRAWBERRY'=>['Vegetables&Fruits','kg',10,3], 'POTATOES'=>['Vegetables&Fruits','kg',20,5], 'HERBS'=>['Vegetables&Fruits','kg',5,1],
            'PORK'=>['Meats','kg',25,6], 'CHICKEN'=>['Meats','kg',25,6], 'BEEF'=>['Meats','kg',20,5], 'BACON'=>['Meats','kg',12,3],
            'SHRIMP'=>['Meats','kg',18,4], 'SQUID'=>['Meats','kg',15,4], 'OCTOPUS'=>['Meats','kg',15,4], 'SALMON'=>['Meats','kg',15,4],
            'SEAFOOD MIX'=>['Meats','kg',18,4], 'NOODLES'=>['Grains','kg',25,6], 'PASTA'=>['Grains','kg',25,6],
            'PIZZA DOUGH'=>['For Baking','pcs',40,10], 'FLOUR'=>['For Baking','kg',25,6], 'PANCAKE MIX'=>['For Baking','kg',20,5],
            'CREAM CHEESE'=>['For Baking','kg',12,3], 'CHOCOLATE'=>['For Baking','kg',12,3], 'BAKING POWDER'=>['For Baking','kg',5,1],
            'BUTTER'=>['For Baking','kg',12,3], 'CREAM'=>['For Baking','L',15,4], 'MILK'=>['Drinks&Wine','L',25,6],
            'CONDENSED MILK'=>['For Baking','L',15,4], 'COCONUT MILK'=>['Condiments','L',15,4], 'GELATIN'=>['For Baking','kg',5,1],
            'CHEESE'=>['For Baking','kg',18,4], 'TOMATO SAUCE'=>['Condiments','L',20,5], 'SOY SAUCE'=>['Condiments','L',15,4],
            'VINEGAR'=>['Condiments','L',15,4], 'COOKING OIL'=>['Condiments','L',25,6], 'PEANUT SAUCE'=>['Condiments','L',12,3],
            'TAMARIND'=>['Condiments','kg',8,2], 'SALT'=>['Condiments','kg',10,3], 'PEPPER'=>['Condiments','kg',5,1], 'SUGAR'=>['Condiments','kg',20,5],
            'TEA SYRUP'=>['Drinks&Wine','L',15,4], 'FOUR SEASON SYRUP'=>['Drinks&Wine','L',12,3], 'PEACH SYRUP'=>['Drinks&Wine','L',12,3],
            'BLUE CURACAO'=>['Drinks&Wine','L',8,2], 'TEQUILA'=>['Drinks&Wine','L',10,3], 'RUM'=>['Drinks&Wine','L',10,3],
            'VODKA'=>['Drinks&Wine','L',10,3], 'TONIC WATER'=>['Drinks&Wine','bottle',48,12], 'SODA WATER'=>['Drinks&Wine','bottle',48,12],
            'COCA COLA'=>['Drinks&Wine','can',48,12], 'SPRITE'=>['Drinks&Wine','can',48,12], 'ROYAL ORANGE'=>['Drinks&Wine','can',48,12],
            'ICE'=>['Drinks&Wine','kg',40,10],
        ];

        $inventory = [];
        foreach ($catalog as $name => [$category, $unit, $quantity, $minimum]) {
            $item = InventoryItem::whereRaw('UPPER(name) = ?', [$name])->first();
            if (!$item) {
                $item = InventoryItem::create([
                    'name' => $name, 'category' => $category, 'unit' => $unit,
                    'quantity' => $quantity, 'min_stock' => $minimum,
                ]);
            }
            $inventory[$name] = $item;
        }

        DB::transaction(function () use ($inventory) {
            foreach (MenuItem::all() as $menuItem) {
                $recipe = $this->recipeFor($menuItem->name, $menuItem->category);
                $menuItem->recipes()->delete();
                foreach ($recipe as $ingredient => $quantity) {
                    if (!isset($inventory[$ingredient])) {
                        continue;
                    }
                    $menuItem->recipes()->create([
                        'inventory_item_id' => $inventory[$ingredient]->id,
                        // The recipe column stores two decimal places; keep every
                        // amount valid for editing and stock deduction in the UI.
                        'quantity_needed' => max(0.001, round((float) $quantity, 3)),
                    ]);
                }
            }
        });
    }

    private function recipeFor(string $name, string $category): array
    {
        $n = strtoupper(preg_replace('/\s+/', ' ', trim($name)));

        $recipe = match (strtoupper($category)) {
            'RICE MEALS' => ['RICE'=>0.20, 'COOKING OIL'=>0.02, 'SALT'=>0.003],
            'NOODLES' => ['NOODLES'=>0.18, 'CABBAGE'=>0.05, 'CARROTS'=>0.04, 'SOY SAUCE'=>0.02, 'COOKING OIL'=>0.02],
            'APPETIZERS' => ['COOKING OIL'=>0.05, 'FLOUR'=>0.05, 'SALT'=>0.003],
            'SALADS' => ['LETTUCE'=>0.12, 'TOMATOES'=>0.06, 'CUCUMBER'=>0.05, 'HERBS'=>0.01],
            'ICED TEAS' => ['TEA SYRUP'=>0.08, 'LEMON'=>0.03, 'SUGAR'=>0.02, 'ICE'=>0.25],
            'PARADISE SHAKE COLLECTION', 'SMOOTHIE BAR' => ['MILK'=>0.18, 'SUGAR'=>0.025, 'ICE'=>0.22],
            'COCKTAILS' => ['VODKA'=>0.04, 'LIME'=>0.03, 'SUGAR'=>0.015, 'ICE'=>0.20],
            'CAKES' => ['FLOUR'=>0.12, 'EGG'=>1, 'BUTTER'=>0.04, 'SUGAR'=>0.06, 'CREAM'=>0.04],
            'PASTA & SPAG' => ['PASTA'=>0.18, 'GARLIC'=>0.01, 'COOKING OIL'=>0.02, 'CREAM'=>0.08],
            'PIZZA' => ['PIZZA DOUGH'=>1, 'TOMATO SAUCE'=>0.08, 'CHEESE'=>0.10],
            'STEAK' => ['BEEF'=>0.30, 'POTATOES'=>0.18, 'BUTTER'=>0.03, 'HERBS'=>0.01],
            'RICE BOWL' => ['RICE'=>0.20, 'SOY SAUCE'=>0.02, 'GARLIC'=>0.01, 'COOKING OIL'=>0.02],
            'DESSERT PARADISE' => ['MILK'=>0.12, 'SUGAR'=>0.05, 'CREAM'=>0.06],
            'BREAKFAST' => ['EGG'=>2, 'BREAD'=>2, 'BUTTER'=>0.02],
            'MAIN COURSE', 'SIGNATURE MENU', "CHEF'S SPECIAL PICKS", 'MUST TRY FAVORITES' => ['GARLIC'=>0.015, 'ONION'=>0.04, 'COOKING OIL'=>0.03, 'SALT'=>0.004, 'PEPPER'=>0.002],
            'BEVERAGES' => ['ICE'=>0.15],
            default => ['SALT'=>0.003, 'COOKING OIL'=>0.02],
        };

        // Named dishes and ingredients refine the category recipe.
        $add = function (string $ingredient, float|int $qty) use (&$recipe): void { $recipe[$ingredient] = $qty; };
        foreach ([
            'PORK'=>'PORK', 'CHICKEN'=>'CHICKEN', 'BEEF'=>'BEEF', 'SHRIMP'=>'SHRIMP', 'SQUID'=>'SQUID',
            'OCTOPUS'=>'OCTOPUS', 'SALMON'=>'SALMON', 'MANGO'=>'MANGO', 'AVOCADO'=>'AVOCADO',
            'WATERMELON'=>'WATERMELON', 'STRAWBERRY'=>'STRAWBERRY', 'CUCUMBER'=>'CUCUMBER',
        ] as $needle => $ingredient) {
            if (str_contains($n, $needle)) $add($ingredient, in_array($ingredient, ['PORK','CHICKEN','BEEF','SHRIMP','SQUID','OCTOPUS','SALMON']) ? 0.20 : 0.12);
        }

        if (str_contains($n, 'ADOBO')) { $add('PORK',0.22); $add('SOY SAUCE',0.035); $add('VINEGAR',0.025); }
        if (str_contains($n, 'SINIGANG')) { $add('PORK',0.22); $add('TAMARIND',0.04); $add('TOMATOES',0.08); }
        if (str_contains($n, 'GRILLED')) $add('CHICKEN',0.25);
        if (str_contains($n, 'KARE-KARE')) { $add('BEEF',0.22); $add('PEANUT SAUCE',0.10); $add('BEANS',0.06); }
        if (str_contains($n, 'SISIG')) { $add('PORK',0.20); $add('EGG',1); }
        if (str_contains($n, 'FRIED RICE')) { $add('EGG',1); $add('PEAS',0.03); $add('CARROTS',0.03); }
        if (str_contains($n, 'GARLIC RICE')) $add('GARLIC',0.02);
        if (str_contains($n, 'PLAIN RICE')) $recipe = ['RICE'=>0.20];
        if (str_contains($n, 'LUMPIA')) { $add('PORK',0.10); $add('CARROTS',0.03); }
        if (str_contains($n, 'CALAMARES')) $add('SQUID',0.18);
        if (str_contains($n, 'CAESAR')) { $add('CHICKEN',0.12); $add('CHEESE',0.03); }
        if (str_contains($n, 'FOUR SEASON')) $add('FOUR SEASON SYRUP',0.10);
        if (str_contains($n, 'PEACH')) $add('PEACH SYRUP',0.08);
        if (str_contains($n, 'BLUE')) $add('BLUE CURACAO',0.04);
        if (str_contains($n, 'MOJITO')) { $add('RUM',0.05); unset($recipe['VODKA']); }
        if (str_contains($n, 'TEQUILA') || str_contains($n, 'MARGARITA')) $add('TEQUILA',0.05);
        if (str_contains($n, 'TIRAMISU')) { $add('CREAM CHEESE',0.06); $add('CHOCOLATE',0.02); }
        if (str_contains($n, 'CHEESECAKE')) $add('CREAM CHEESE',0.10);
        if (str_contains($n, 'CHOCOL')) $add('CHOCOLATE',0.06);
        if (str_contains($n, 'CROISSANT') || str_contains($n, 'PAIN AU')) $add('BUTTER',0.08);
        if (str_contains($n, 'CINNAMON')) $add('SUGAR',0.08);
        if (str_contains($n, 'COOKIE')) $add('CHOCOLATE',0.05);
        if (str_contains($n, 'COCONUT')) $add('COCONUT MILK',0.15);
        if (str_contains($n, 'SEAFOOD')) $add('SEAFOOD MIX',0.22);
        if (str_contains($n, 'PESTO')) { $add('HERBS',0.04); unset($recipe['CREAM']); }
        if (str_contains($n, 'PEPPERONI')) $add('SAUSAGES',0.10);
        if (str_contains($n, 'HAWAIIAN')) $add('MANGO',0.08);
        if (str_contains($n, 'BQQ') || str_contains($n, 'BBQ')) { $add('PORK',0.25); $add('CHICKEN',0.25); $add('BEEF',0.25); }
        if (str_contains($n, 'PANCAKE')) { $recipe = ['PANCAKE MIX'=>0.18,'EGG'=>1,'MILK'=>0.12,'BUTTER'=>0.02,'SUGAR'=>0.02]; if (str_contains($n,'MANGO')) $add('MANGO',0.10); }
        if (str_contains($n, 'PUDDING')) $recipe = ['MILK'=>0.15,'CONDENSED MILK'=>0.05,'GELATIN'=>0.01,'SUGAR'=>0.03];
        if (str_contains($n, 'SHAVED ICE')) $recipe = ['ICE'=>0.35,'CONDENSED MILK'=>0.06,'MANGO'=>0.08,'SUGAR'=>0.02];
        if (str_contains($n, 'CAVEMAN')) { $add('SAUSAGES',2); $add('BACON',0.06); }
        if (str_contains($n, 'BRITISH')) { $add('SAUSAGES',2); $add('BEANS',0.08); $add('TOMATOES',0.08); }
        if (str_contains($n, 'SURFY')) { $add('BEEF',0.20); $add('SHRIMP',0.12); $add('POTATOES',0.15); }
        if (str_contains($n, 'SULTAN')) { $add('BEEF',0.22); $add('RICE',0.18); }
        if (str_contains($n, 'G.I')) { $add('CHICKEN',0.20); $add('POTATOES',0.15); }
        if (str_contains($n, 'BLIND CURVE')) { $add('CHICKEN',0.22); $add('POTATOES',0.12); }
        if (str_contains($n, 'PAELLA')) { $add('RICE',0.20); $add('SEAFOOD MIX',0.20); }
        if (str_contains($n, 'FLYING DREAM')) $add('CHICKEN',0.22);
        if (str_contains($n, 'YELLOW AURORA')) { $add('SHRIMP',0.16); $add('RICE',0.18); }

        if (str_contains($n, 'TONIC WATER')) $recipe = ['TONIC WATER'=>1,'ICE'=>0.10];
        if (str_contains($n, 'SODA WATER')) $recipe = ['SODA WATER'=>1,'ICE'=>0.10];
        if (str_contains($n, 'COCA COLA')) $recipe = ['COCA COLA'=>1,'ICE'=>0.10];
        if ($n === 'SPRITE') $recipe = ['SPRITE'=>1,'ICE'=>0.10];
        if (str_contains($n, 'ROYAL')) $recipe = ['ROYAL ORANGE'=>1,'ICE'=>0.10];

        return array_filter($recipe, fn ($qty) => $qty > 0);
    }
}
