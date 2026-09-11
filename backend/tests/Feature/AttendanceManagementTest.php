<?php

namespace Tests\Feature;

use App\Models\Schedule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AttendanceManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_record_attendance_and_view_duty_summary(): void
    {
        $admin = User::create(['full_name'=>'Admin','username'=>'admin_att','email'=>'admin-att@example.com','password'=>'password123','role'=>'Admin','is_active'=>true]);
        $staff = User::create(['full_name'=>'Waiter One','username'=>'waiter_att','email'=>'waiter-att@example.com','password'=>'password123','role'=>'Waiter','is_active'=>true,'biometric_id'=>'BIO-001']);
        Schedule::create(['user_id'=>$staff->id,'day_of_week'=>'Monday','start_time'=>'08:00','end_time'=>'17:00','shift_label'=>'Morning']);
        Sanctum::actingAs($admin);

        $this->postJson('/api/attendance', [
            'user_id'=>$staff->id,
            'work_date'=>'2026-08-24',
            'time_in'=>'2026-08-24T08:10:00',
            'time_out'=>'2026-08-24T17:10:00',
            'source'=>'Biometric',
        ])->assertCreated()->assertJsonPath('status', 'Completed')->assertJsonPath('lateMinutes', 10);

        $this->getJson('/api/attendance/summary?start_date=2026-08-01&end_date=2026-08-31')
            ->assertOk()
            ->assertJsonPath('0.employee', 'Waiter One')
            ->assertJsonPath('0.daysPresent', 1)
            ->assertJsonPath('0.totalHours', 9);
    }
}
