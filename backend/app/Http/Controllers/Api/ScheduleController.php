<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Schedule;
use App\Models\User;
use Illuminate\Http\Request;

class ScheduleController extends Controller
{
    // GET /api/schedules?user_id=X — get all schedules (optionally filtered by user)
    public function index(Request $request)
    {
        $dayOrder = ['Monday'=>0,'Tuesday'=>1,'Wednesday'=>2,'Thursday'=>3,'Friday'=>4,'Saturday'=>5,'Sunday'=>6];
        $query = Schedule::with('user');
        if ($request->has('user_id')) {
            $query->where('user_id', $request->user_id);
        }
        $sorted = $query->get()->sortBy(fn($s) => $dayOrder[$s->day_of_week] ?? 7)->values();
        return response()->json($sorted->map(fn($s) => [
            'id'          => $s->id,
            'user_id'     => $s->user_id,
            'userName'    => $s->user->full_name ?? '—',
            'userRole'    => $s->user->role ?? '—',
            'day_of_week' => $s->day_of_week,
            'start_time'  => $s->start_time,
            'end_time'    => $s->end_time,
            'shift_label' => $s->shift_label,
            'notes'       => $s->notes,
        ]));
    }

    // POST /api/schedules
    public function store(Request $request)
    {
        $request->validate([
            'user_id'     => 'required|exists:users,id',
            'day_of_week' => 'required|in:Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday',
            'start_time'  => 'required|date_format:H:i',
            'end_time'    => 'required|date_format:H:i|after:start_time',
            'shift_label' => 'nullable|string|max:50',
            'notes'       => 'nullable|string',
        ]);

        $schedule = Schedule::create($request->only(['user_id', 'day_of_week', 'start_time', 'end_time', 'shift_label', 'notes']));
        $schedule->load('user');

        return response()->json([
            'id'          => $schedule->id,
            'user_id'     => $schedule->user_id,
            'userName'    => $schedule->user->full_name,
            'userRole'    => $schedule->user->role,
            'day_of_week' => $schedule->day_of_week,
            'start_time'  => $schedule->start_time,
            'end_time'    => $schedule->end_time,
            'shift_label' => $schedule->shift_label,
            'notes'       => $schedule->notes,
        ], 201);
    }

    // PUT /api/schedules/{id}
    public function update(Request $request, Schedule $schedule)
    {
        $request->validate([
            'user_id'     => 'sometimes|exists:users,id',
            'day_of_week' => 'sometimes|in:Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday',
            'start_time'  => 'sometimes|date_format:H:i',
            'end_time'    => 'sometimes|date_format:H:i',
            'shift_label' => 'nullable|string|max:50',
            'notes'       => 'nullable|string',
        ]);

        $schedule->update($request->only(['user_id', 'day_of_week', 'start_time', 'end_time', 'shift_label', 'notes']));
        $schedule->load('user');

        return response()->json([
            'id'          => $schedule->id,
            'user_id'     => $schedule->user_id,
            'userName'    => $schedule->user->full_name,
            'userRole'    => $schedule->user->role,
            'day_of_week' => $schedule->day_of_week,
            'start_time'  => $schedule->start_time,
            'end_time'    => $schedule->end_time,
            'shift_label' => $schedule->shift_label,
            'notes'       => $schedule->notes,
        ]);
    }

    // DELETE /api/schedules/{id}
    public function destroy(Schedule $schedule)
    {
        $schedule->delete();
        return response()->json(['message' => 'Schedule deleted']);
    }
}
