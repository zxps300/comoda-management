<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        $user = User::where('username', $request->username)
            ->orWhere('email', $request->username)
            ->first();

        // ── Check if account is temporarily locked due to failed attempts ──
        if ($user && $user->locked_until && $user->locked_until->isFuture()) {
            $minutesRemaining = now()->diffInMinutes($user->locked_until) + 1;
            \Illuminate\Support\Facades\Log::warning("Login attempt on locked account: {$request->username} from IP {$request->ip()}");
            return response()->json([
                'message' => "Account is temporarily locked due to multiple failed attempts. Please try again in {$minutesRemaining} minute(s)."
            ], 423);
        }

        if (!$user || !Hash::check($request->password, $user->password)) {
            \Illuminate\Support\Facades\Log::warning("Failed login attempt for username: '{$request->username}' from IP {$request->ip()}");
            
            if ($user) {
                $failed = ($user->failed_login_count ?? 0) + 1;
                if ($failed >= 5) {
                    $user->update([
                        'failed_login_count' => 0,
                        'locked_until'       => now()->addMinutes(15),
                    ]);
                    \Illuminate\Support\Facades\Log::alert("Account {$user->username} (ID: {$user->id}) locked for 15 mins after 5 failed attempts from IP {$request->ip()}");
                    return response()->json([
                        'message' => 'Too many failed login attempts. Your account has been temporarily locked for 15 minutes.'
                    ], 423);
                } else {
                    $user->update(['failed_login_count' => $failed]);
                }
            }

            return response()->json(['message' => 'Invalid username or password'], 401);
        }

        if (!$user->is_active) {
            \Illuminate\Support\Facades\Log::warning("Login attempt for disabled account: {$user->username} from IP {$request->ip()}");
            return response()->json(['message' => 'Account is disabled'], 403);
        }

        // ── Reset failed attempts upon successful login ──
        $user->update([
            'failed_login_count' => 0,
            'locked_until'       => null,
        ]);

        \Illuminate\Support\Facades\Log::info("Successful login for user: {$user->username} (ID: {$user->id}, Role: {$user->role}) from IP {$request->ip()}");

        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'success' => true,
            'user' => [
                'id' => $user->id,
                'fullName' => $user->full_name,
                'username' => $user->username,
                'email' => $user->email,
                'role' => $user->role,
            ],
            'token' => $token,
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out']);
    }

    public function user(Request $request)
    {
        $user = $request->user();
        return response()->json([
            'id' => $user->id,
            'fullName' => $user->full_name,
            'username' => $user->username,
            'email' => $user->email,
            'role' => $user->role,
        ]);
    }
}
