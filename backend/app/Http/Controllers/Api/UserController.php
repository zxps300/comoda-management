<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

class UserController extends Controller
{
    private function userPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'fullName' => $user->full_name,
            'username' => $user->username,
            'email' => $user->email,
            'biometricId' => $user->biometric_id,
            'role' => $user->role,
            'is_active' => $user->is_active,
            'createdAt' => $user->created_at?->toISOString(),
            'archivedAt' => $user->deleted_at?->toISOString(),
        ];
    }

    public function index()
    {
        $users = User::orderBy('full_name')->get()->map(fn($user) => $this->userPayload($user));
        return response()->json($users);
    }

    public function archived()
    {
        $users = User::onlyTrashed()
            ->orderByDesc('deleted_at')
            ->get()
            ->map(fn($user) => $this->userPayload($user));

        return response()->json($users);
    }

    public function store(Request $request)
    {
        $request->validate([
            'fullName' => 'required|string|max:255',
            'username' => 'required|string|max:255|unique:users,username',
            'password' => ['required', 'string', Password::min(12)->letters()->numbers()],
            'role'     => 'required|in:Admin,Cashier,Purchaser,Kitchen Staff,Waiter,Bar,Pastry',
            'email'    => 'nullable|email',
            'biometricId' => 'nullable|string|max:100|unique:users,biometric_id',
        ]);

        $user = User::create([
            'full_name' => $request->fullName,
            'username'  => $request->username,
            'password'  => Hash::make($request->password),
            'role'      => $request->role,
            'email'     => $request->email,
            'biometric_id' => $request->biometricId,
            'is_active' => true,
        ]);

        return response()->json([
            'id'        => $user->id,
            'fullName'  => $user->full_name,
            'username'  => $user->username,
            'email'     => $user->email,
            'biometricId' => $user->biometric_id,
            'role'      => $user->role,
            'is_active' => $user->is_active,
        ], 201);
    }

    public function show(User $user)
    {
        return response()->json([
            'id'        => $user->id,
            'fullName'  => $user->full_name,
            'username'  => $user->username,
            'email'     => $user->email,
            'biometricId' => $user->biometric_id,
            'role'      => $user->role,
            'is_active' => $user->is_active,
        ]);
    }

    public function update(Request $request, User $user)
    {
        $request->validate([
            'fullName' => 'sometimes|required|string|max:255',
            'username' => "sometimes|required|string|max:255|unique:users,username,{$user->id}",
            'password' => ['nullable', 'string', Password::min(12)->letters()->numbers()],
            'role'     => 'sometimes|required|in:Admin,Cashier,Purchaser,Kitchen Staff,Waiter,Bar,Pastry',
            'email'    => 'nullable|email',
            'biometricId' => "nullable|string|max:100|unique:users,biometric_id,{$user->id}",
        ]);

        $data = [];
        if ($request->has('fullName')) $data['full_name'] = $request->fullName;
        if ($request->has('username')) $data['username'] = $request->username;
        if ($request->filled('password')) $data['password'] = Hash::make($request->password);
        if ($request->has('role')) $data['role'] = $request->role;
        if ($request->has('email')) $data['email'] = $request->email;
        if ($request->has('biometricId')) $data['biometric_id'] = $request->biometricId;
        if ($request->has('is_active')) $data['is_active'] = (bool)$request->is_active;

        $user->update($data);

        return response()->json([
            'id'        => $user->id,
            'fullName'  => $user->full_name,
            'username'  => $user->username,
            'email'     => $user->email,
            'biometricId' => $user->biometric_id,
            'role'      => $user->role,
            'is_active' => $user->is_active,
        ]);
    }

    public function destroy(User $user)
    {
        // Prevent archiving the account currently running the admin session.
        if ($user->id === auth()->id()) {
            return response()->json(['message' => 'You cannot archive your own account.'], 400);
        }

        $user->tokens()->delete();
        $user->update(['is_active' => false]);
        $user->delete();
        return response()->json(['message' => 'User archived successfully.']);
    }

    public function restore(int $id)
    {
        $user = User::onlyTrashed()->findOrFail($id);
        $user->restore();
        $user->update(['is_active' => true]);

        return response()->json([
            'message' => 'User restored successfully.',
            'user' => $this->userPayload($user->fresh()),
        ]);
    }

    public function forceDelete(int $id)
    {
        $user = User::onlyTrashed()->findOrFail($id);
        $user->forceDelete();

        return response()->json(['message' => 'User permanently deleted.']);
    }
}
