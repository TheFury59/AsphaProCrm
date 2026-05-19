<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
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
                'last_login_at' => optional($u->last_login_at)->toIso8601String(),
                'created_at' => optional($u->created_at)->toIso8601String(),
            ];
        });

        return ['data' => $paginated];
    }

    /**
     * POST /api/v1/admin/users
     *
     * Crée un nouvel utilisateur avec un rôle. Typiquement utilisé pour
     * créer des comptes admin/super_admin manuels. Pour les intervenants
     * et clients, préférer les flow dédiés (fiche intervenant → futur
     * "Créer accès", fiche client → "Accès extranet").
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
        ]);

        $plainPassword = $data['password'] ?? $this->generatePassword();

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($plainPassword),
            'status' => User::STATUS_ACTIVE,
        ]);

        $user->syncRoles([$data['role']]);

        return response()->json([
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $data['role'],
                ],
                // Affiché UNE seule fois côté UI — pas re-fetchable côté serveur
                'password' => $plainPassword,
                'password_was_generated' => empty($data['password']),
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

        return ['data' => $user->fresh()->only(['id', 'name', 'email', 'status'])];
    }

    /**
     * GET /api/v1/admin/users/roles
     * Renvoie la liste des rôles disponibles + leur description métier.
     * Utilisé par le frontend pour peupler le sélecteur.
     */
    public function availableRolesList(Request $request)
    {
        abort_unless($request->user()?->hasRole('super_admin'), 403);

        return [
            'data' => [
                ['name' => 'super_admin', 'label' => 'Super-administrateur', 'description' => 'Accès total sans exception, gestion des rôles incluse.'],
                ['name' => 'admin', 'label' => 'Administrateur', 'description' => 'Accès à tout le CRM sauf l\'onglet Permissions des paramètres.'],
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
