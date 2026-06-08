<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * Authentification pour l'app mobile (Expo / React Native).
 *
 * Distinct de l'AuthController web (Sanctum SPA cookies) : ici on utilise
 * les **Personal Access Tokens** Sanctum. Le mobile envoie un email + mdp
 * + device_name → reçoit un token Bearer à utiliser pour toutes les
 * requêtes suivantes via `Authorization: Bearer <token>`.
 *
 * Endpoints :
 *  - POST /api/v1/mobile/login (public, rate-limited)
 *  - POST /api/v1/mobile/logout (auth Bearer)
 *  - POST /api/v1/mobile/push-token (auth Bearer) — enregistre l'expo push token
 *
 * Sécurité :
 *  - Filtre status=active à l'authent (un user désactivé ne peut pas se loguer).
 *  - Les tokens d'un user désactivé sont révoqués (cf. UsersController::update).
 *  - Pas d'expiration auto sur les tokens — l'app reste connectée tant que
 *    l'utilisateur ne fait pas logout explicite ou que l'admin ne révoque pas.
 */
class MobileAuthController extends Controller
{
    /**
     * POST /api/v1/mobile/login
     *
     * Body : { email, password, device_name }
     * Renvoie : { data: { token, user } }
     */
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            // device_name : ex. "iPhone 14 Pro · iOS 18.1" — sert à
            // identifier le token dans la table personal_access_tokens
            // (utile pour révoquer un device spécifique plus tard).
            'device_name' => ['required', 'string', 'max:128'],
        ]);

        $user = User::where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => __('auth.failed'),
            ]);
        }

        if (($user->status ?? 'active') !== 'active') {
            throw new AuthenticationException('Compte désactivé.');
        }

        // Génère un nouveau token Sanctum pour ce device.
        // Pas de scope / abilities pour V1 (token = pouvoirs complets de l'user).
        $token = $user->createToken($data['device_name'])->plainTextToken;

        $user->forceFill(['last_login_at' => now()])->save();

        return response()->json([
            'data' => [
                'token' => $token,
                'user' => $this->serializeUser($user),
            ],
        ]);
    }

    /**
     * POST /api/v1/mobile/logout
     *
     * Invalide UNIQUEMENT le token courant (les autres devices restent connectés).
     */
    public function logout(Request $request): JsonResponse
    {
        $token = $request->user()?->currentAccessToken();
        if ($token) {
            $token->delete();
        }

        return response()->json(['status' => 'ok']);
    }

    /**
     * POST /api/v1/mobile/push-token
     *
     * Body : { expo_push_token }
     * Enregistre/met à jour le token Expo Push de l'utilisateur (1 par user
     * actif — convention V1 multi-device viendra plus tard si besoin).
     *
     * Le format attendu est `ExponentPushToken[xxx...]`. On le valide
     * légèrement pour éviter de stocker n'importe quoi.
     */
    public function pushToken(Request $request): JsonResponse
    {
        $data = $request->validate([
            'expo_push_token' => [
                'required',
                'string',
                'max:255',
                'regex:/^ExponentPushToken\[[^\]]+\]$/',
            ],
        ]);

        $request->user()->forceFill([
            'expo_push_token' => $data['expo_push_token'],
        ])->save();

        return response()->json(['status' => 'ok']);
    }

    /**
     * Sérialisation user identique à AuthController::serializeUser (web)
     * pour que le mobile parse le même format.
     */
    private function serializeUser($user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'status' => $user->status ?? 'active',
            'must_change_password' => (bool) ($user->must_change_password ?? false),
            'role' => $user->getRoleNames()->first(),
            'permissions' => $user->getAllPermissions()->pluck('name'),
            'last_login_at' => optional($user->last_login_at)->toIso8601String(),
        ];
    }
}
