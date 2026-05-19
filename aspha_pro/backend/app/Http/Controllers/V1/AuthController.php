<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * POST /api/v1/login
     */
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'remember' => ['boolean'],
        ]);

        // ⚠️ Sécurité : on filtre sur `status=active` directement dans les
        // credentials. Auth::attempt accepte un 3e arg (where conditions
        // additionnelles). Sans ça, un user `inactive` (révoqué via
        // ClientPortalAccessController::revoke ou UsersController) restait
        // fonctionnel — `revoke` ne fait que `update(['status' => 'inactive'])`
        // sans purger tokens/sessions. Cf. audit 2026-05-19.
        if (! Auth::attempt(
            [
                'email' => $credentials['email'],
                'password' => $credentials['password'],
                'status' => 'active',
            ],
            $credentials['remember'] ?? false
        )) {
            throw ValidationException::withMessages([
                'email' => __('auth.failed'),
            ]);
        }

        $request->session()->regenerate();

        $user = $request->user();
        $user->forceFill(['last_login_at' => now()])->save();

        return response()->json(['data' => $this->serializeUser($user)]);
    }

    /**
     * POST /api/v1/logout
     */
    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['status' => 'ok']);
    }

    /**
     * GET /api/v1/me
     */
    public function me(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->serializeUser($request->user())]);
    }

    /**
     * PATCH /api/v1/me
     *
     * L'utilisateur connecté modifie son propre profil (name + email).
     * Pour le mot de passe, requiert l'ancien (current_password) en plus
     * du nouveau (password) → évite que quelqu'un qui a hijack une session
     * change le password sans connaître l'actuel.
     */
    public function updateMe(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            // Changement de mot de passe optionnel : si `password` est passé,
            // `current_password` doit l'être aussi et matcher le hash actuel.
            'password' => ['sometimes', 'string', 'min:8'],
            'current_password' => ['required_with:password', 'string'],
        ]);

        if (isset($data['password'])) {
            if (! Hash::check($data['current_password'], $user->password)) {
                throw ValidationException::withMessages([
                    'current_password' => 'Le mot de passe actuel est incorrect.',
                ]);
            }
            $user->password = Hash::make($data['password']);
        }

        if (isset($data['name'])) $user->name = $data['name'];
        if (isset($data['email'])) $user->email = $data['email'];

        $user->save();

        return response()->json(['data' => $this->serializeUser($user->fresh())]);
    }

    private function serializeUser($user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'status' => $user->status ?? 'active',
            'role' => $user->getRoleNames()->first(),
            'permissions' => $user->getAllPermissions()->pluck('name'),
            'last_login_at' => optional($user->last_login_at)->toIso8601String(),
        ];
    }
}
