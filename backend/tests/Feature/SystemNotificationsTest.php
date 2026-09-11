<?php

namespace Tests\Feature;

use App\Models\InventoryItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SystemNotificationsTest extends TestCase
{
    use RefreshDatabase;

    public function test_every_role_can_see_admin_updates_and_inventory_alerts_with_personal_read_state(): void
    {
        $admin = User::create(['full_name'=>'Admin','username'=>'notify_admin','email'=>'notify-admin@example.com','password'=>'password123','role'=>'Admin','is_active'=>true]);
        $cashier = User::create(['full_name'=>'Cashier','username'=>'notify_cashier','email'=>'notify-cashier@example.com','password'=>'password123','role'=>'Cashier','is_active'=>true]);
        InventoryItem::create(['name'=>'Beef','category'=>'Meats','unit'=>'kg','quantity'=>0,'min_stock'=>5]);

        Sanctum::actingAs($admin);
        $this->postJson('/api/notifications/announcements', ['title'=>'Staff Meeting','message'=>'Meeting at 4 PM','severity'=>'info'])->assertCreated();

        Sanctum::actingAs($cashier);
        $feed = $this->getJson('/api/notifications')->assertOk()
            ->assertJsonPath('unreadCount', 2)
            ->assertJsonFragment(['title'=>'Staff Meeting'])
            ->assertJsonFragment(['title'=>'Out of Stock']);

        $announcementKey = collect($feed->json('notifications'))->firstWhere('type', 'announcement')['key'];
        $this->postJson('/api/notifications/read', ['key'=>$announcementKey])->assertOk();
        $this->getJson('/api/notifications')->assertOk()->assertJsonPath('unreadCount', 1);

        Sanctum::actingAs($admin);
        $this->getJson('/api/notifications')->assertOk()->assertJsonPath('unreadCount', 2);
    }
}
