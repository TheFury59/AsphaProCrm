<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Mail\PasswordResetMail;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

/**
 * Mot de passe oublié — flow standard 2 étapes :
 *
 *   1. POST /forgot-password { email }
 *      → si l'email existe : génère un token (table password_reset_tokens),
 *        envoie un mail avec lien `https://<frontend>/reset-password?token=X&email=Y`
 *      → si l'email n'existe pas : on renvoie le MEME 200 OK (anti-enum d'emails)
 *
 *   2. POST /reset-password { token, email, password, password_confirmation }
 *      → valide le token + l'email + applique le nouveau mot de passe
 *      → consomme le token (Laravel le supprime atomiquement)
 *      → revoke tous les Personal Access Tokens existants pour forcer une
 *        nouvelle connexion sur tous les devices (mobile / web)
 *
 * Routes publiques (pas d'auth requise). Throttle léger pour éviter le spam.
 *
 * Le frontend handle l'URL `/reset-password?token=...&email=...` et appelle
 * `/api/v1/reset-password` avec le payload complet.
 */
class PasswordResetController extends Controller
{
    /**
     * POST /api/v1/forgot-password
     *
     * Envoie un email avec un lien de réinitialisation si l'email existe.
     * Réponse 200 systématique (anti-enum), avec un message générique.
     */
    public function forgot(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $user = User::where('email', $data['email'])->first();

        // Anti-enum : on répond toujours 200 OK même si l'email n'existe pas.
        // Côté UX, le user sait qu'il doit vérifier sa boîte mail.
        if (! $user || $user->status !== 'active') {
            return response()->json([
                'message' => 'Si cet email existe, un lien de réinitialisation vient d\'être envoyé.',
            ]);
        }

        // Génère + persiste le token via le broker Laravel (table password_reset_tokens).
        $token = Password::broker()->createToken($user);

        // URL frontend pour la page reset (config app.url → frontend root).
        $frontendUrl = rtrim(config('app.frontend_url') ?? config('app.url', 'http://localhost'), '/');
        $resetUrl = $frontendUrl.'/reset-password?token='.$token.'&email='.urlencode($user->email);

        Mail::to($user->email)->send(new PasswordResetMail(
            userName: $user->name,
            resetUrl: $resetUrl,
            expiresInMinutes: (int) config('auth.passwords.users.expire', 60),
        ));

        return response()->json([
            'message' => 'Si cet email existe, un lien de réinitialisation vient d\'être envoyé.',
        ]);
    }

    /**
     * POST /api/v1/reset-password
     *
     * Valide le token + applique le nouveau mot de passe.
     * Réponses possibles :
     *   - 200 : mot de passe changé, tokens API révoqués
     *   - 422 : token invalide / expiré, email inconnu, password trop court
     */
    public function reset(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $status = Password::reset(
            $data,
            function (User $user, string $password) {
                $user->forceFill([
                    'password' => Hash::make($password),
                    'must_change_password' => false,
                    'remember_token' => Str::random(60),
                ])->save();

                // Révoque tous les Personal Access Tokens existants (mobile +
                // éventuels autres devices) — la nouvelle session devra
                // re-login. Côté web, le cookie Sanctum reste valide pour
                // l'instant (le user pourra se re-login si besoin).
                $user->tokens()->delete();

                event(new PasswordReset($user));
            }
        );

        if ($status === Password::PasswordReset) {
            return response()->json([
                'message' => 'Mot de passe réinitialisé. Vous pouvez maintenant vous connecter.',
            ]);
        }

        // Token invalide ou expiré, email inconnu, etc.
        return response()->json([
            'message' => __($status),
            'errors' => ['email' => [__($status)]],
        ], 422);
    }
}
