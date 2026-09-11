<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use App\Models\Schedule;
use Carbon\Carbon;
use Illuminate\Http\Request;

class AttendanceController extends Controller
{
    public function index(Request $request)
    {
        $query = AttendanceRecord::with('user')->orderByDesc('work_date')->orderByDesc('time_in');
        if ($request->filled('user_id')) $query->where('user_id', $request->user_id);
        if ($request->filled('start_date')) $query->whereDate('work_date', '>=', $request->start_date);
        if ($request->filled('end_date')) $query->whereDate('work_date', '<=', $request->end_date);
        return response()->json($query->get()->map(fn ($record) => $this->format($record)));
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $data['recorded_by'] = auth()->id();
        $record = AttendanceRecord::updateOrCreate(
            ['user_id' => $data['user_id'], 'work_date' => $data['work_date']],
            $data
        );
        return response()->json($this->format($record->load('user')), $record->wasRecentlyCreated ? 201 : 200);
    }

    public function update(Request $request, AttendanceRecord $attendance)
    {
        $data = $this->validated($request, true);
        $data['recorded_by'] = auth()->id();
        $attendance->update($data);
        return response()->json($this->format($attendance->load('user')));
    }

    public function destroy(AttendanceRecord $attendance)
    {
        $attendance->delete();
        return response()->json(['message' => 'Attendance record deleted']);
    }

    public function summary(Request $request)
    {
        $request->validate(['start_date' => 'required|date', 'end_date' => 'required|date|after_or_equal:start_date']);
        $records = AttendanceRecord::with('user')
            ->whereBetween('work_date', [$request->start_date, $request->end_date])->get();

        return response()->json($records->groupBy('user_id')->map(function ($group) {
            $minutes = $group->sum(fn ($r) => $r->time_in && $r->time_out ? $r->time_in->diffInMinutes($r->time_out) : 0);
            $lateMinutes = $group->sum(fn ($r) => $this->lateMinutes($r));
            return [
                'userId' => $group->first()->user_id,
                'employee' => $group->first()->user?->full_name ?? 'Unknown',
                'role' => $group->first()->user?->role ?? '—',
                'daysPresent' => $group->whereNotNull('time_in')->count(),
                'completedDays' => $group->whereNotNull('time_in')->whereNotNull('time_out')->count(),
                'totalMinutes' => $minutes,
                'totalHours' => round($minutes / 60, 2),
                'lateMinutes' => $lateMinutes,
                'incompleteRecords' => $group->filter(fn ($r) => $r->time_in && !$r->time_out)->count(),
            ];
        })->values());
    }

    private function validated(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';
        return $request->validate([
            'user_id' => "$required|exists:users,id",
            'work_date' => "$required|date",
            'time_in' => 'nullable|date',
            'time_out' => 'nullable|date|after:time_in',
            'source' => 'nullable|in:Manual,Biometric,Import',
            'notes' => 'nullable|string|max:500',
        ]);
    }

    private function lateMinutes(AttendanceRecord $record): int
    {
        if (!$record->time_in) return 0;
        $schedule = Schedule::where('user_id', $record->user_id)
            ->where('day_of_week', $record->work_date->format('l'))->first();
        if (!$schedule) return 0;
        $scheduled = Carbon::parse($record->work_date->format('Y-m-d') . ' ' . $schedule->start_time);
        return $record->time_in->greaterThan($scheduled) ? $scheduled->diffInMinutes($record->time_in) : 0;
    }

    private function format(AttendanceRecord $record): array
    {
        $minutes = $record->time_in && $record->time_out ? $record->time_in->diffInMinutes($record->time_out) : 0;
        return [
            'id' => $record->id,
            'user_id' => $record->user_id,
            'employee' => $record->user?->full_name ?? 'Unknown',
            'role' => $record->user?->role ?? '—',
            'work_date' => $record->work_date?->format('Y-m-d'),
            'time_in' => $record->time_in?->toISOString(),
            'time_out' => $record->time_out?->toISOString(),
            'source' => $record->source,
            'notes' => $record->notes,
            'totalMinutes' => $minutes,
            'totalHours' => round($minutes / 60, 2),
            'lateMinutes' => $this->lateMinutes($record),
            'status' => !$record->time_in ? 'Absent' : (!$record->time_out ? 'On Duty' : 'Completed'),
        ];
    }
}
