<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\ClientCompany;
use App\Models\Employee;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Role;

/**
 * Gestion des utilisateurs réservée au SUPER_ADMIN.
 *
 * Endpoints :
 *  GET  /api/v1/admin/users           — liste paginée avec rôle
 *  POST /api/v1/admin/users/{id}/role — affecter / changer le rôle d'un user
 *  PATCH /api/v1/admin/users/{id}     — modifier statut (active/inactive)
 *
 * Rôles disponibles côté métier :
 *  - super_admin : accès total sans exception
 *  - admin       : tout sauf onglet Permissions des paramètres
 *  - intervenant : extranet perso uniquement (planning, messagerie, profil)
 *  - client      : extranet client (factures, prestations, demandes)
 *
 * Sécurité : tous les endpoints requirent le rôle super_admin (vérifié via
 * abort_unless). Pas de permission Spatie granulaire — c'est tout ou rien.
 */
class UsersController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()?->hasRole('super_admin'), 403, "Accès super_admin requis");

        $perPage = min((int) $request->query('per_page', 25), 100);

        $query = User::query()
            ->with('roles:id,name')
            ->orderBy('name');

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($role = $request->query('role')) {
            $query->whereHas('roles', fn ($q) => $q->where('name', $role));
        }

        $paginated = $query->paginate($perPage);

        // Transforme pour exposer le rôle en string + statut
        $paginated->getCollection()->transform(function (User $u) {
            return [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'status' => $u->status ?? 'active',
                'role' => $u->getRoleNames()->first() ?? null,
                // Photo de profil — accessor User::avatar_url construit l'URL
                // absolue + cache-bust (?v=updated_at) à la volée. Sans ça
                // la liste admin affichait juste les initiales colorées.
                'avatar_url' => $u->avatar_url,
                'last_login_at' => optional($u->last_login_at)->toIso8601String(),
                'created_at' => optional($u->created_at)->toIso8601String(),
            ];
        });

        return ['data' => $paginated];
    }

    /**
     * POST /api/v1/admin/users
     *
     * Crée un nouvel utilisateur. Quand le rôle est `intervenant` ou
     * `client`, on crée AUSSI la fiche métier correspondante dans la même
     * transaction, sinon l'utilisateur orphelin n'a pas de fiche dans
     * l'ERP (bug historique : User créé sans Employee/Client).
     *
     * Champs supplémentaires requis selon le rôle :
     *  - intervenant : `entity_id` (obligatoire), `classification`
     *    (défaut `non_cadre`), `phone` (optionnel)
     *  - client : `entity_id` (obligatoire), `company_name` (obligatoire),
     *    `phone` (optionnel), `siret` (optionnel)
     *
     * Mot de passe : si non fourni, généré random 12 chars sans ambiguïtés
     * et retourné UNE SEULE FOIS dans la réponse (pas re-fetchable).
     */
    public function store(Request $request)
    {
        abort_unless($request->user()?->hasRole('super_admin'), 403, "Accès super_admin requis");

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['nullable', 'string', 'min:8'],
            'role' => ['required', Rule::in($this->availableRoles())],
            // Champs métier optionnels (requis conditionnellement selon le rôle).
            'entity_id' => ['nullable', 'exists:entities,id', 'required_if:role,intervenant', 'required_if:role,client'],
            'phone' => ['nullable', 'string', 'max:32'],
            // Intervenant
            'classification' => ['nullable', 'in:non_cadre,cadre'],
            // Client
            'company_name' => ['nullable', 'string', 'max:255', 'required_if:role,client'],
            'siret' => ['nullable', 'string', 'max:32'],
        ], [
            'entity_id.required_if' => "L'entité de rattachement est obligatoire pour créer un intervenant ou un client.",
            'company_name.required_if' => "Le nom de la société est obligatoire pour créer un client.",
        ]);

        $passwordWasGenerated = empty($data['password']);
        $plainPassword = $data['password'] ?? $this->generatePassword();

        $created = DB::transaction(function () use ($data, $plainPassword, $passwordWasGenerated, $request) {
            $user = User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => Hash::make($plainPassword),
                'status' => User::STATUS_ACTIVE,
                // Mot de passe temporaire généré → changement forcé à la 1re connexion.
                'must_change_password' => $passwordWasGenerated,
            ]);

            $user->syncRoles([$data['role']]);

            $linkedEntity = null;

            if ($data['role'] === 'intervenant') {
                $employee = Employee::create([
                    'user_id' => $user->id,
                    'entity_id' => $data['entity_id'],
                    'owner_user_id' => $request->user()->id,
                    'name' => $data['name'],
                    'phone' => $data['phone'] ?? null,
                    'classification' => $data['classification'] ?? 'non_cadre',
                ]);
                $linkedEntity = ['type' => 'employee', 'id' => $employee->id];
            } elseif ($data['role'] === 'client') {
                // Code temporaire (la colonne `code` est UNIQUE — on ne peut pas
                // l'insérer null en MySQL strict). On le remplace juste après par
                // CLI-{id zero-pad 4}, même pattern que ClientController::store.
                $tempCode = 'CLI-TMP-'.Str::random(10);
                $client = Client::create([
                    'code' => $tempCode,
                    'status' => 'active',
                    'entity_id' => $data['entity_id'],
                    'owner_user_id' => $request->user()->id,
                    'portal_user_id' => $user->id,
                ]);
                $client->update([
                    'code' => 'CLI-'.str_pad((string) $client->id, 4, '0', STR_PAD_LEFT),
                ]);
                ClientCompany::create([
                    'client_id' => $client->id,
                    'company_name' => $data['company_name'],
                    'siret' => $data['siret'] ?? null,
                    'phone_landline' => $data['phone'] ?? null,
                    'primary_email' => $data['email'],
                ]);
                $linkedEntity = ['type' => 'client', 'id' => $client->id];
            }

            return ['user' => $user, 'linked_entity' => $linkedEntity];
        });

        return response()->json([
            'data' => [
                'user' => [
                    'id' => $created['user']->id,
                    'name' => $created['user']->name,
                    'email' => $created['user']->email,
                    'role' => $data['role'],
                ],
                'linked_entity' => $created['linked_entity'],
                // Affiché UNE seule fois côté UI — pas re-fetchable côté serveur
                'password' => $plainPassword,
                'password_was_generated' => $passwordWasGenerated,
            ],
        ], 201);
    }

    /**
     * Génère un mot de passe lisible : 12 chars alphanum sans ambiguïtés.
     * Cf. ClientPortalAccessController::generatePassword pour le même algo.
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
     * POST /api/v1/admin/users/{user}/role
     * Body : { "role": "admin" | "intervenant" | "super_admin" | "client" }
     *
     * Affecte un rôle unique à l'utilisateur (remplace tous ses rôles
     * existants — convention métier : 1 user = 1 rôle).
     */
    public function setRole(Request $request, User $user)
    {
        abort_unless($request->user()?->hasRole('super_admin'), 403, "Accès super_admin requis");

        $data = $request->validate([
            'role' => ['required', Rule::in($this->availableRoles())],
        ]);

        // Garde-fou : un super_admin ne peut pas se rétrograder lui-même
        // (sinon plus moyen de revenir en arrière s'il est seul super_admin).
        if ($user->id === $request->user()->id && $data['role'] !== 'super_admin') {
            return response()->json([
                'message' => "Tu ne peux pas te retirer ton rôle super_admin toi-même. "
                    ."Demande à un autre super_admin de le faire.",
            ], 422);
        }

        $user->syncRoles([$data['role']]);

        return [
            'data' => [
                'id' => $user->id,
                'role' => $data['role'],
            ],
        ];
    }

    /**
     * PATCH /api/v1/admin/users/{user}
     * Modifier statut (activer / désactiver). Le user désactivé ne peut plus
     * se connecter (mais ses données restent : pas de soft delete).
     */
    public function update(Request $request, User $user)
    {
        abort_unless($request->user()?->hasRole('super_admin'), 403, "Accès super_admin requis");

        $data = $request->validate([
            'status' => ['sometimes', Rule::in(['active', 'inactive'])],
        ]);

        // Garde-fou : un super_admin ne peut pas se désactiver lui-même
        if ($user->id === $request->user()->id && ($data['status'] ?? null) === 'inactive') {
            return response()->json([
                'message' => "Impossible de désactiver ton propre compte.",
            ], 422);
        }

        $user->update($data);

        // Désactivation : on révoque les tokens Sanctum mobile + push token Expo.
        // Sinon un user désactivé pourrait continuer à utiliser l'app via son
        // Bearer token existant (faille de sécurité).
        if (($data['status'] ?? null) === 'inactive') {
            $user->tokens()->delete();
            if ($user->expo_push_token) {
                $user->forceFill(['expo_push_token' => null])->save();
            }
        }

        return ['data' => $user->fresh()->only(['id', 'name', 'email', 'status'])];
    }

    /**
     * GET /api/v1/admin/users/roles
     * Renvoie la liste des rôles disponibles + leur description métier.
     * Utilisé par le frontend pour peupler le sélecteur.
     */
    /**
     * DELETE /api/v1/admin/users/{user}
     *
     * Suppression COMPLÈTE d'un user (hard-delete, pas soft-delete). Cascade
     * en BDD via les FK ON DELETE CASCADE / SET NULL définies dans les
     * migrations Laravel — l'Employee lié (intervenant), le portal_user_id
     * sur Client (extranet client), les Personal Access Tokens, les
     * notifications, les sessions... seront supprimés/déliés automatiquement.
     *
     * Garde-fous :
     *   - super_admin uniquement
     *   - on s'interdit de supprimer son propre compte (sinon plus aucun
     *     super_admin disponible si c'était le dernier)
     *   - on s'interdit de supprimer le DERNIER super_admin du système
     *   - en cas de présence d'un Employee lié avec interventions futures,
     *     on délègue la responsabilité à l'admin (via paramètre `?force=1`)
     *
     * Réservé super_admin (action critique, irréversible).
     */
    public function destroy(Request $request, User $user)
    {
        abort_unless($request->user()?->hasRole('super_admin'), 403, "Accès super_admin requis");

        // Anti-suicide : un super_admin ne peut pas supprimer son propre compte.
        if ((int) $user->id === (int) $request->user()->id) {
            abort(409, "Tu ne peux pas supprimer ton propre compte. Demande à un autre super_admin de le faire.");
        }

        // Empêcher la suppression du DERNIER super_admin du système.
        if ($user->hasRole('super_admin')) {
            $remainingCount = User::role('super_admin')->where('id', '!=', $user->id)->count();
            if ($remainingCount === 0) {
                abort(409, "Impossible de supprimer le dernier super_admin du système. Crée un autre super_admin d'abord.");
            }
        }

        // Si user lié à un Employee avec interventions futures, on alerte
        // (sauf si ?force=1 explicite). Cascade BDD se chargera ensuite de
        // tout nettoyer si on confirme.
        $force = $request->boolean('force');
        if (! $force && $user->employee) {
            $futureCount = \App\Models\Intervention::where('employee_id', $user->employee->id)
                ->where('start_datetime', '>=', now())
                ->whereNotIn('status', ['annulee', 'realisee', 'terminated'])
                ->count();
            if ($futureCount > 0) {
                abort(409, "Cet utilisateur est lié à un intervenant avec {$futureCount} intervention(s) future(s). Réassignez-les d'abord, ou forcez via ?force=1.");
            }
        }

        $user->delete();

        return response()->noContent();
    }

    public function availableRolesList(Request $request)
    {
        abort_unless($request->user()?->hasRole('super_admin'), 403);

        return [
            'data' => [
                ['name' => 'super_admin', 'label' => 'Super-administrateur', 'description' => 'Accès total sans exception, gestion des rôles incluse.'],
                ['name' => 'admin', 'label' => 'Administrateur', 'description' => 'Accès à tout l\'ERP sauf l\'onglet Permissions des paramètres.'],
                ['name' => 'intervenant', 'label' => 'Intervenant', 'description' => 'Extranet personnel uniquement : planning, messagerie, profil.'],
                ['name' => 'client', 'label' => 'Client', 'description' => 'Extranet client : factures, prestations, demandes.'],
            ],
        ];
    }

    private function availableRoles(): array
    {
        return ['super_admin', 'admin', 'intervenant', 'client'];
    }
}
