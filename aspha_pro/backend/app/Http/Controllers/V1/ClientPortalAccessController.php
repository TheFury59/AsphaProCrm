<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Mail\PortalCredentialsMail;
use App\Models\Client;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

/**
 * Gestion de l'accès extranet pour un client.
 *
 *  POST   /api/v1/clients/{client}/portal-access         — Créer l'accès
 *  POST   /api/v1/clients/{client}/portal-access/reset   — Reset mot de passe
 *  POST   /api/v1/clients/{client}/portal-access/email   — Envoyer les identifiants par email
 *  DELETE /api/v1/clients/{client}/portal-access         — Révoquer l'accès
 *
 * Le User créé porte le rôle Spatie "client" → RoleRouter le redirige
 * automatiquement vers /extranet/client après login.
 *
 * IMPORTANT : le mot de passe en clair n'est retourné qu'**une seule fois**
 * (à la création + au reset). L'admin doit le copier ou demander un nouvel
 * envoi par email. Aucun stockage clair côté serveur.
 */
class ClientPortalAccessController extends Controller
{
    /**
     * POST /api/v1/clients/{client}/portal-access
     *
     * Crée un User dédié + lie le client. Si le client a déjà un portal_user,
     * 409 (utiliser reset si besoin de changer le mot de passe).
     *
     * L'email peut être passé en paramètre (`email`) ou bouchonné depuis
     * `client.company.primary_email`. Si aucun n'est dispo → 422.
     */
    public function create(Request $request, Client $client)
    {
        abort_unless($request->user()?->can('clients.edit'), 403);

        if ($client->portal_user_id) {
            return response()->json([
                'message' => "Ce client a déjà un accès extranet. Utilise « Reset » pour générer un nouveau mot de passe.",
                'data' => $client->load('portalUser:id,name,email,status')->portalUser,
            ], 409);
        }

        $data = $request->validate([
            'email' => ['nullable', 'email', 'unique:users,email'],
            'send_email' => ['nullable', 'boolean'],
        ]);

        $client->loadMissing('company:id,client_id,company_name,primary_email');
        $email = $data['email']
            ?? $client->company?->primary_email
            ?? null;

        if (! $email) {
            return response()->json([
                'message' => "Aucun email fourni. Renseigne l'email principal de l'entreprise sur la fiche, ou passe `email` dans la requête.",
            ], 422);
        }

        // Verifie l'unicité même si on a sauté la règle (email fallback)
        if (User::where('email', $email)->exists()) {
            return response()->json([
                'message' => "Un utilisateur existe déjà avec l'email {$email}. Passe un email différent ou réutilise l'utilisateur existant.",
            ], 422);
        }

        $companyName = $client->company?->company_name ?? "Client {$client->code}";
        $plainPassword = $this->generatePassword();

        $user = DB::transaction(function () use ($email, $companyName, $plainPassword, $client) {
            $u = User::create([
                'name' => $companyName,
                'email' => $email,
                'password' => Hash::make($plainPassword),
                'status' => User::STATUS_ACTIVE,
                // Mot de passe temporaire → changement forcé à la 1re connexion.
                'must_change_password' => true,
            ]);
            $u->assignRole('client');
            $client->update(['portal_user_id' => $u->id]);
            return $u;
        });

        $emailSent = false;
        if (! empty($data['send_email'])) {
            $emailSent = $this->dispatchCredentialsMail($user, $plainPassword, $companyName);
        }

        return response()->json([
            'data' => [
                'user' => $user->only(['id', 'name', 'email', 'status']),
                // Affiché UNE seule fois côté UI — pas re-fetchable
                'password' => $plainPassword,
                'email_sent' => $emailSent,
            ],
        ], 201);
    }

    /**
     * POST /api/v1/clients/{client}/portal-access/reset
     *
     * Regénère un mot de passe pour le portal_user existant et le retourne
     * en clair (une seule fois).
     */
    public function reset(Request $request, Client $client)
    {
        abort_unless($request->user()?->can('clients.edit'), 403);

        $user = $client->portalUser;
        abort_unless($user, 404, "Ce client n'a pas d'accès extranet. Crée-le d'abord.");

        $send = $request->boolean('send_email', false);
        $plainPassword = $this->generatePassword();
        // Nouveau mot de passe temporaire → changement forcé à la connexion.
        $user->update([
            'password' => Hash::make($plainPassword),
            'must_change_password' => true,
        ]);

        $emailSent = false;
        if ($send) {
            $companyName = $client->company?->company_name ?? "Client {$client->code}";
            $emailSent = $this->dispatchCredentialsMail($user, $plainPassword, $companyName);
        }

        return [
            'data' => [
                'user' => $user->only(['id', 'name', 'email', 'status']),
                'password' => $plainPassword,
                'email_sent' => $emailSent,
            ],
        ];
    }

    /**
     * POST /api/v1/clients/{client}/portal-access/email
     *
     * Re-envoie un email avec les identifiants. Pour la sécurité on regénère
     * un NOUVEAU mot de passe à ce moment-là (on n'a pas le clair stocké).
     * L'admin est averti que le mot de passe précédent est invalidé.
     */
    public function sendEmail(Request $request, Client $client)
    {
        abort_unless($request->user()?->can('clients.edit'), 403);

        $user = $client->portalUser;
        abort_unless($user, 404, "Ce client n'a pas d'accès extranet.");

        $plainPassword = $this->generatePassword();
        // Nouveau mot de passe temporaire → changement forcé à la connexion.
        $user->update([
            'password' => Hash::make($plainPassword),
            'must_change_password' => true,
        ]);

        $companyName = $client->company?->company_name ?? "Client {$client->code}";
        $sent = $this->dispatchCredentialsMail($user, $plainPassword, $companyName);

        return [
            'data' => [
                'email_sent' => $sent,
                'password' => $plainPassword,
                'note' => 'Un nouveau mot de passe a été généré et envoyé. L\'ancien est invalidé.',
            ],
        ];
    }

    /**
     * DELETE /api/v1/clients/{client}/portal-access
     *
     * Supprime le User dédié + détache le client. Soft delete préférable
     * à terme mais Sanctum/Spatie ne le gèrent pas natif sur users → on
     * marque status=inactive + on délie, l'historique reste intact.
     */
    public function revoke(Request $request, Client $client)
    {
        abort_unless($request->user()?->can('clients.edit'), 403);

        $user = $client->portalUser;
        if ($user) {
            $user->update(['status' => 'inactive']);
            // Supprime les tokens Sanctum actifs pour forcer la déconnexion
            $user->tokens()->delete();
        }
        $client->update(['portal_user_id' => null]);

        return response()->noContent();
    }

    /**
     * Génère un mot de passe lisible : 12 chars alphanum (sans 0/O/1/l).
     * Pas de symboles → plus facile à dicter par téléphone si besoin.
     */
    private function generatePassword(): string
    {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
        $out = '';
        $len = strlen($alphabet);
        for ($i = 0; $i < 12; $i++) {
            $out .= $alphabet[random_int(0, $len - 1)];
        }
        return $out;
    }

    /**
     * Envoie le mail Mailable contenant les identifiants. Retourne true si
     * dispatch OK, false sinon (en log + on continue : l'admin a quand
     * même le mot de passe en réponse API).
     */
    private function dispatchCredentialsMail(User $user, string $plainPassword, string $companyName): bool
    {
        try {
            Mail::to($user->email)->send(new PortalCredentialsMail(
                companyName: $companyName,
                email: $user->email,
                password: $plainPassword,
            ));
            return true;
        } catch (\Throwable $e) {
            // SMTP pas encore configuré (o2switch arrive) → on log proprement
            Log::warning("Envoi email accès extranet KO pour {$user->email} : ".$e->getMessage());
            return false;
        }
    }
}
