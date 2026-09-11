<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\InventoryItem;
use App\Models\NotificationRead;
use App\Services\BatchExpiryService;
use App\Services\StockDeductionService;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $affected = app(BatchExpiryService::class)->quarantineDueBatches();
        if ($affected !== []) app(StockDeductionService::class)->refreshMenuAvailability($affected);

        $notifications = collect();
        $announcements = Announcement::with('creator')->where('is_active', true)
            ->where(fn($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->latest()->get();

        foreach ($announcements as $item) {
            $notifications->push([
                'key'=>"announcement:{$item->id}", 'type'=>'announcement', 'severity'=>$item->severity,
                'title'=>$item->title, 'message'=>$item->message,
                'source'=>'Admin · '.($item->creator?->full_name ?? 'Administrator'),
                'createdAt'=>$item->created_at?->toISOString(), 'url'=>'/dashboard',
            ]);
        }

        $inventory = InventoryItem::with([
            'stockBatches' => fn($q) => $q->where('quantity_remaining', '>', 0),
            'expiredStockBatches' => fn($q) => $q->where('quantity_remaining', '>', 0)->whereNull('disposed_at'),
        ])->get();
        foreach ($inventory as $item) {
            $qty = (float)$item->quantity;
            if ($qty <= 0) $notifications->push($this->stockAlert($item, 'out', 'urgent', 'Out of Stock', "{$item->name} has no stock remaining.", "inventory:out:{$item->id}:{$qty}"));
            elseif ($qty <= (float)$item->min_stock) $notifications->push($this->stockAlert($item, 'low', 'warning', 'Low Stock', "{$item->name} has {$qty} {$item->unit} remaining (minimum {$item->min_stock}).", "inventory:low:{$item->id}:{$qty}"));

            $nextExpiry = $item->stockBatches->whereNotNull('expires_at')->sortBy('expires_at')->first();
            if ($nextExpiry) {
                $days = now()->startOfDay()->diffInDays($nextExpiry->expires_at->startOfDay(), false);
                if ($days <= 3) {
                    $notifications->push($this->stockAlert($item, 'expiring', 'warning', 'Expiring Soon', "{$item->name} has stock expiring in {$days} day".($days === 1 ? '' : 's').'.', "inventory:expiring:{$item->id}:{$nextExpiry->expires_at->format('Ymd')}"));
                }
            }

            $expiredQty = (float) $item->expiredStockBatches->sum('quantity_remaining');
            if ($expiredQty > 0) {
                $notifications->push($this->stockAlert($item, 'expired', 'urgent', 'Expired Stock Separated', "{$item->name} has {$expiredQty} {$item->unit} awaiting disposal.", "inventory:expired:{$item->id}:{$expiredQty}"));
            }
        }

        $readKeys = NotificationRead::where('user_id', auth()->id())->pluck('notification_key')->flip();
        $result = $notifications->map(fn($item) => [...$item, 'isRead'=>$readKeys->has($item['key'])])->sortByDesc(fn($item) => [$item['isRead'] ? 0 : 1, $item['createdAt'] ?? ''])->values();
        return response()->json(['notifications'=>$result, 'unreadCount'=>$result->where('isRead', false)->count()]);
    }

    public function store(Request $request)
    {
        $data = $request->validate(['title'=>'required|string|max:120','message'=>'required|string|max:1000','severity'=>'required|in:info,success,warning,urgent','expires_at'=>'nullable|date|after:now']);
        $announcement = Announcement::create([...$data, 'created_by'=>auth()->id()]);
        return response()->json($announcement, 201);
    }

    public function markRead(Request $request)
    {
        $data = $request->validate(['key'=>'required|string|max:190']);
        NotificationRead::updateOrCreate(['user_id'=>auth()->id(),'notification_key'=>$data['key']], ['read_at'=>now()]);
        return response()->json(['message'=>'Notification marked as read']);
    }

    private function stockAlert($item, string $type, string $severity, string $title, string $message, string $key): array
    {
        return ['key'=>$key,'type'=>$type,'severity'=>$severity,'title'=>$title,'message'=>$message,'source'=>'Inventory','createdAt'=>now()->toISOString(),'url'=>'/inventory'];
    }
}
