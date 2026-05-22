<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Mail\PortalCredentialsMail;
use App\Models\Employee;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Gestion de l'accès extranet pour un intervenant (employee).
 *
 *  POST   /api/v1/employees/{employee}/portal-access         — Créer
 *  POST   /api/v1/employees/{employee}/portal-access/reset   — Reset pwd
 *  POST   /api/v1/employees/{employee}/portal-access/email   — Renvoyer email
 *  DELETE /api/v1/employees/{employee}/portal-access         — Révoquer
 *
 * Différence avec ClientPortalAccessController : on stocke le user lié
 * dans `employees.user_id` (FK directe historique) au lieu d'une colonne
 * `portal_user_id` dédiée. Sémantiquement c'est la même chose : le user
 * via lequel l'intervenant se connecte à son extranet personnel.
 *
 * Le User créé porte le rôle Spatie "intervenant" → RoleRouter le redirige
 * vers /extranet/intervenant après login.
 */
class EmployeePortalAccessController extends Controller
{
    public function create(Request $request, Employee $employee)
    {
        abort_unless($request->user()?->can('employees.edit'), 403);

        if ($employee->user_id) {
            return response()->json([
                'message' => "Cet intervenant a déjà un accès extranet. Utilise « Reset » pour générer un nouveau mot de passe.",
                'data' => $employee->load('user:id,name,email,status')->user,
            ], 409);
        }

        $data = $request->validate([
            'email' => ['required', 'email', 'unique:users,email'],
            'send_email' => ['nullable', 'boolean'],
        ]);

        $employeeName = $employee->name ?: "Intervenant #{$employee->id}";
        $plainPassword = $this->generatePassword();

        $user = DB::transaction(function () use ($data, $employeeName, $plainPassword, $employee) {
            $u = User::create([
                'name' => $employeeName,
                'email' => $data['email'],
                'password' => Hash::make($plainPassword),
                'status' => User::STATUS_ACTIVE,
                // Mot de passe temporaire → changement forcé à la 1re connexion.
                'must_change_password' => true,
            ]);
            $u->assignRole('intervenant');
            $employee->update(['user_id' => $u->id]);
            return $u;
        });

        $emailSent = false;
        if (! empty($data['send_email'])) {
            $emailSent = $this->dispatchCredentialsMail($user, $plainPassword, $employeeName);
        }

        return response()->json([
            'data' => [
                'user' => $user->only(['id', 'name', 'email', 'status']),
                'password' => $plainPassword,
                'email_sent' => $emailSent,
            ],
        ], 201);
    }

    public function reset(Request $request, Employee $employee)
    {
        abort_unless($request->user()?->can('employees.edit'), 403);

        $user = $employee->user;
        abort_unless($user, 404, "Cet intervenant n'a pas d'accès extranet. Crée-le d'abord.");

        $send = $request->boolean('send_email', false);
        $plainPassword = $this->generatePassword();
        // Nouveau mot de passe temporaire → changement forcé à la connexion.
        $user->update([
            'password' => Hash::make($plainPassword),
            'must_change_password' => true,
        ]);

        $emailSent = false;
        if ($send) {
            $emailSent = $this->dispatchCredentialsMail($user, $plainPassword, $employee->name ?: "Intervenant #{$employee->id}");
        }

        return [
            'data' => [
                'user' => $user->only(['id', 'name', 'email', 'status']),
                'password' => $plainPassword,
                'email_sent' => $emailSent,
            ],
        ];
    }

    public function sendEmail(Request $request, Employee $employee)
    {
        abort_unless($request->user()?->can('employees.edit'), 403);

        $user = $employee->user;
        abort_unless($user, 404, "Cet intervenant n'a pas d'accès extranet.");

        $plainPassword = $this->generatePassword();
        // Nouveau mot de passe temporaire → changement forcé à la connexion.
        $user->update([
            'password' => Hash::make($plainPassword),
            'must_change_password' => true,
        ]);

        $sent = $this->dispatchCredentialsMail($user, $plainPassword, $employee->name ?: "Intervenant #{$employee->id}");

        return [
            'data' => [
                'email_sent' => $sent,
                'password' => $plainPassword,
                'note' => "Un nouveau mot de passe a été généré et envoyé. L'ancien est invalidé.",
            ],
        ];
    }

    public function revoke(Request $request, Employee $employee)
    {
        abort_unless($request->user()?->can('employees.edit'), 403);

        $user = $employee->user;
        if ($user) {
            $user->update(['status' => 'inactive']);
            $user->tokens()->delete();
        }
        $employee->update(['user_id' => null]);

        return response()->noContent();
    }

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

    private function dispatchCredentialsMail(User $user, string $plainPassword, string $employeeName): bool
    {
        try {
            // Réutilise le même Mailable que côté client (le template est
            // générique "Votre accès au portail" — fonctionne pour tous).
            Mail::to($user->email)->send(new PortalCredentialsMail(
                companyName: $employeeName,
                email: $user->email,
                password: $plainPassword,
            ));
            return true;
        } catch (\Throwable $e) {
            Log::warning("Envoi email accès extranet intervenant KO pour {$user->email} : ".$e->getMessage());
            return false;
        }
    }
}
