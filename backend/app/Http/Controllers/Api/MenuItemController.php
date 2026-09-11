<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MenuItem;
use App\Models\MenuPriceHistory;
use App\Models\MenuItemRecipe;
use App\Services\MenuImageService;
use App\Services\BatchExpiryService;
use App\Services\ServingAvailabilityService;
use App\Services\StockDeductionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class MenuItemController extends Controller
{
    public function __construct(
        private readonly MenuImageService $menuImages,
        private readonly ServingAvailabilityService $servings,
    ) {
    }

    // ── Helper to format a single item for API response ──────────────
    private function format(MenuItem $item): array
    {
        $item->loadMissing('variants', 'recipes.inventoryItem');
        $availability = $this->servings->calculate($item);

        return [
            'id'           => $item->id,
            'name'         => $item->name,
            'description'  => $item->description,
            'category'     => $item->category,
            'price'        => (float) $item->price,
            'takeOutPrice' => $item->take_out_price !== null ? (float) $item->take_out_price : null,
            'available'    => $availability['canServe'],
            'configuredAvailable' => (bool) $item->available,
            'isBestSeller' => (bool) $item->is_best_seller,
            'availableServings' => $availability['availableServings'],
            'maxQuantity'  => $availability['availableServings'],
            'canServe'     => $availability['canServe'],
            'hasRecipe'    => $availability['hasRecipe'],
            'limitingIngredient' => $availability['limitingIngredient'],
            'image'        => $item->thumbnail,
            'originalImage'=> $item->image,
            'variants'     => $item->variants->map(fn($v) => [
                'id'           => $v->id,
                'label'        => $v->label,
                'price'        => (float) $v->price,
                'takeOutPrice' => $v->take_out_price !== null ? (float) $v->take_out_price : null,
                'sortOrder'    => $v->sort_order,
            ])->values(),
            'recipe'       => $item->recipes->map(fn($r) => [
                'id'              => $r->id,
                'inventoryItemId' => $r->inventory_item_id,
                'ingredientName'  => $r->inventoryItem?->name,
                'unit'            => $r->inventoryItem?->unit,
                'quantityNeeded'  => (float) $r->quantity_needed,
                'stockAvailable'  => (float) ($r->inventoryItem?->quantity ?? 0),
            ])->values(),
        ];
    }

    // ── Sync variants from request array ─────────────────────────────
    private function syncVariants(MenuItem $item, array $variants): void
    {
        $item->variants()->delete();
        foreach ($variants as $i => $v) {
            if (empty($v['label']) && !isset($v['price'])) continue;
            $item->variants()->create([
                'label'          => $v['label'],
                'price'          => $v['price'],
                'take_out_price' => isset($v['takeOutPrice']) && $v['takeOutPrice'] !== '' ? $v['takeOutPrice'] : null,
                'sort_order'     => $i,
            ]);
        }
    }

    public function index()
    {
        $affected = app(BatchExpiryService::class)->quarantineDueBatches();
        if ($affected !== []) app(StockDeductionService::class)->refreshMenuAvailability($affected);

        return response()->json(
            MenuItem::with('variants', 'recipes.inventoryItem')->get()->map(fn($item) => $this->format($item))
        );
    }

    public function store(Request $request)
    {
        \Illuminate\Support\Facades\Log::info('Store menu item request received', [
            'method' => $request->method(),
            'url' => $request->fullUrl(),
            'headers' => $request->headers->all(),
            'body' => $request->all(),
            'files' => $request->allFiles()
        ]);

        if ($request->user()->role !== 'Admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        // Decode variants JSON string (sent as string in FormData with image uploads)
        if ($request->has('variants') && is_string($request->input('variants'))) {
            $request->merge(['variants' => json_decode($request->input('variants'), true) ?? []]);
        }

        $validator = \Illuminate\Support\Facades\Validator::make($request->all(), [
            'name'           => 'required|string',
            'description'    => 'nullable|string|max:500',
            'category'       => 'required|string',
            'price'          => 'nullable|numeric|min:0',
            'take_out_price' => 'nullable|numeric|min:0',
            'available'      => 'boolean',
            'is_best_seller' => 'boolean',
            'image'          => 'nullable|image|max:10240',
            'variants'       => 'nullable|array',
            'variants.*.label' => 'required_with:variants|string',
            'variants.*.price' => 'required_with:variants|numeric|min:0',
            'variants.*.takeOutPrice' => 'nullable|numeric|min:0',
        ]);

        if ($validator->fails()) {
            \Illuminate\Support\Facades\Log::error('Validation failed', $validator->errors()->toArray());
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $request->merge($validator->validated());

        $data = $request->only('name', 'description', 'category', 'price', 'take_out_price', 'available', 'is_best_seller');

        if ($request->hasFile('image')) {
            $ext      = $request->file('image')->getClientOriginalExtension();
            $filename = Str::slug($request->input('name')).'-'.now()->format('YmdHis').'-'.Str::lower(Str::random(6)).'.'.$ext;
            $data['image'] = $request->file('image')->storeAs('menu-items', $filename, 'public');
            $this->menuImages->createThumbnail($data['image']);
        }

        $item = MenuItem::create($data);

        // Handle variants from JSON body OR multipart form
        $variants = $request->input('variants');
        if (is_string($variants)) {
            $variants = json_decode($variants, true) ?? [];
        }
        if (!empty($variants)) {
            $this->syncVariants($item, $variants);
        }

        return response()->json($this->format($item->fresh()), 201);
    }

    public function show(MenuItem $menuItem)
    {
        return response()->json($this->format($menuItem));
    }

    public function update(Request $request, MenuItem $menuItem)
    {
        if ($request->user()->role !== 'Admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        // Decode variants JSON string (sent as string in FormData with image uploads)
        if ($request->has('variants') && is_string($request->input('variants'))) {
            $request->merge(['variants' => json_decode($request->input('variants'), true) ?? []]);
        }

        $request->validate([
            'name'           => 'sometimes|required|string',
            'description'    => 'nullable|string|max:500',
            'category'       => 'sometimes|required|string',
            'price'          => 'nullable|numeric|min:0',
            'take_out_price' => 'nullable|numeric|min:0',
            'available'      => 'boolean',
            'is_best_seller' => 'boolean',
            'image'          => 'nullable|image|max:10240',
            'variants'       => 'nullable|array',
            'variants.*.label' => 'required_with:variants|string',
            'variants.*.price' => 'required_with:variants|numeric|min:0',
            'variants.*.takeOutPrice' => 'nullable|numeric|min:0',
            'price_change_reason' => 'nullable|string|max:500',
        ]);

        $data = $request->only('name', 'description', 'category', 'price', 'take_out_price', 'available', 'is_best_seller');

        if ($request->hasFile('image')) {
            $ext      = $request->file('image')->getClientOriginalExtension();
            $itemName = $request->input('name', $menuItem->name);
            $filename = Str::slug($itemName).'-'.now()->format('YmdHis').'-'.Str::lower(Str::random(6)).'.'.$ext;
            $data['image'] = $request->file('image')->storeAs('menu-items', $filename, 'public');
            $this->menuImages->createThumbnail($data['image']);
        }

        $variants = $request->input('variants');
        if (is_string($variants)) {
            $variants = json_decode($variants, true) ?? [];
        }

        $oldPrice = $menuItem->price !== null ? (float) $menuItem->price : null;
        $oldTakeOutPrice = $menuItem->take_out_price !== null ? (float) $menuItem->take_out_price : null;
        $oldVariants = $menuItem->variants->mapWithKeys(fn($variant) => [mb_strtolower(trim($variant->label)) => [
            'label' => $variant->label,
            'price' => $variant->price,
            'takeOutPrice' => $variant->take_out_price,
        ]])->all();

        DB::transaction(function () use ($request, $menuItem, $data, $variants, $oldPrice, $oldTakeOutPrice, $oldVariants) {
            $menuItem->update($data);

            if (array_key_exists('price', $data)) {
                $this->recordPriceChange($request, $menuItem, 'Dine in', null, $oldPrice, $data['price']);
            }
            if (array_key_exists('take_out_price', $data)) {
                $this->recordPriceChange($request, $menuItem, 'Take out', null, $oldTakeOutPrice, $data['take_out_price']);
            }

            if ($variants !== null) {
                $newVariants = collect($variants)->filter(fn($variant) => !empty($variant['label']))
                    ->mapWithKeys(fn($variant) => [mb_strtolower(trim($variant['label'])) => $variant])->all();
                foreach (array_unique(array_merge(array_keys($oldVariants), array_keys($newVariants))) as $key) {
                    $before = $oldVariants[$key] ?? null;
                    $after = $newVariants[$key] ?? null;
                    $label = $after['label'] ?? $before['label'] ?? 'Variant';
                    $this->recordPriceChange($request, $menuItem, 'Variant dine in', $label, $before['price'] ?? null, $after['price'] ?? null);
                    $this->recordPriceChange($request, $menuItem, 'Variant take out', $label, $before['takeOutPrice'] ?? null, $after['takeOutPrice'] ?? null);
                }
                $this->syncVariants($menuItem, $variants);
            }
        });

        return response()->json($this->format($menuItem->fresh()));
    }

    public function destroy(Request $request, MenuItem $menuItem)
    {
        if ($request->user()->role !== 'Admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $menuItem->delete();
        return response()->json(['message' => 'Menu item deleted']);
    }

    public function priceHistory(Request $request, MenuItem $menuItem)
    {
        if ($request->user()->role !== 'Admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return response()->json(
            $menuItem->priceHistory()->get()->map(fn(MenuPriceHistory $entry) => [
                'id' => $entry->id,
                'priceType' => $entry->price_type,
                'variantLabel' => $entry->variant_label,
                'oldPrice' => $entry->old_price !== null ? (float) $entry->old_price : null,
                'newPrice' => $entry->new_price !== null ? (float) $entry->new_price : null,
                'staffMember' => $entry->changed_by_name,
                'reason' => $entry->reason,
                'changedAt' => $entry->created_at?->toISOString(),
            ])
        );
    }

    public function priceHistoryIndex(Request $request)
    {
        if ($request->user()->role !== 'Admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $request->validate([
            'from' => 'nullable|date',
            'to' => 'nullable|date|after_or_equal:from',
        ]);

        $query = MenuPriceHistory::query()->latest('created_at')->latest('id');
        if ($request->filled('from')) $query->whereDate('created_at', '>=', $request->input('from'));
        if ($request->filled('to')) $query->whereDate('created_at', '<=', $request->input('to'));

        return response()->json($query->get()->map(fn(MenuPriceHistory $entry) => [
            'id' => $entry->id,
            'productName' => $entry->menu_item_name,
            'priceType' => $entry->price_type,
            'variantLabel' => $entry->variant_label,
            'oldPrice' => $entry->old_price !== null ? (float) $entry->old_price : null,
            'newPrice' => $entry->new_price !== null ? (float) $entry->new_price : null,
            'staffMember' => $entry->changed_by_name,
            'reason' => $entry->reason,
            'changedAt' => $entry->created_at?->toISOString(),
        ]));
    }

    private function recordPriceChange(
        Request $request,
        MenuItem $menuItem,
        string $priceType,
        ?string $variantLabel,
        mixed $oldPrice,
        mixed $newPrice,
    ): void {
        $old = $oldPrice === null || $oldPrice === '' ? null : round((float) $oldPrice, 2);
        $new = $newPrice === null || $newPrice === '' ? null : round((float) $newPrice, 2);

        if ($old === $new) {
            return;
        }

        MenuPriceHistory::create([
            'menu_item_id' => $menuItem->id,
            'menu_item_name' => $menuItem->name,
            'price_type' => $priceType,
            'variant_label' => $variantLabel,
            'old_price' => $old,
            'new_price' => $new,
            'changed_by_user_id' => $request->user()?->id,
            'changed_by_name' => $request->user()?->full_name ?? $request->user()?->username ?? 'Unknown staff',
            'reason' => $request->input('price_change_reason') ?: null,
        ]);
    }

    // ── Recipe CRUD ──────────────────────────────────────────────────

    public function getRecipe(MenuItem $menuItem)
    {
        $menuItem->load('recipes.inventoryItem');
        return response()->json(
            $menuItem->recipes->map(fn($r) => [
                'id'              => $r->id,
                'inventoryItemId' => $r->inventory_item_id,
                'ingredientName'  => $r->inventoryItem?->name,
                'unit'            => $r->inventoryItem?->unit,
                'quantityNeeded'  => (float) $r->quantity_needed,
                'stockAvailable'  => (float) ($r->inventoryItem?->quantity ?? 0),
            ])
        );
    }

    public function updateRecipe(Request $request, MenuItem $menuItem)
    {
        if (!in_array($request->user()->role, ['Admin', 'Kitchen'])) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $request->validate([
            'ingredients'                    => 'present|array',
            'ingredients.*.inventory_item_id'=> 'required|exists:inventory_items,id',
            'ingredients.*.quantity_needed'  => 'required|numeric|min:0.001',
        ]);

        // Sync: delete all existing and recreate
        $menuItem->recipes()->delete();

        foreach ($request->ingredients as $ing) {
            $menuItem->recipes()->create([
                'inventory_item_id' => $ing['inventory_item_id'],
                'quantity_needed'   => $ing['quantity_needed'],
            ]);
        }

        // Refresh availability for this menu item
        $service = new \App\Services\StockDeductionService();
        $inventoryIds = collect($request->ingredients)->pluck('inventory_item_id')->toArray();
        $service->refreshMenuAvailability($inventoryIds);

        $menuItem->load('recipes.inventoryItem');
        return response()->json([
            'message' => 'Recipe updated successfully',
            'recipe'  => $menuItem->recipes->map(fn($r) => [
                'id'              => $r->id,
                'inventoryItemId' => $r->inventory_item_id,
                'ingredientName'  => $r->inventoryItem?->name,
                'unit'            => $r->inventoryItem?->unit,
                'quantityNeeded'  => (float) $r->quantity_needed,
                'stockAvailable'  => (float) ($r->inventoryItem?->quantity ?? 0),
            ]),
        ]);
    }
}
