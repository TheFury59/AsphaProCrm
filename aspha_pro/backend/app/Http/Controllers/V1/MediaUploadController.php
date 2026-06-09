<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\Employee;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Endpoints d'upload de médias (avatars intervenants + logos clients).
 *
 * Stockage : Storage::disk('public') → exposé via `php artisan storage:link`
 * sur `/storage/...`. Chemin relatif stocké en BDD, URL absolue calculée par
 * accessor sur le model (cf. Employee::avatar_url, ClientCompany::logo_url).
 *
 * Sécurité : validation MIME + taille max 2 Mo + extension whitelist.
 * On utilise toujours `Str::random()` pour le nom de fichier afin d'éviter
 * tout path traversal (jamais de nom uploadé par l'utilisateur).
 */
class MediaUploadController extends Controller
{
    private const MAX_SIZE_KB = 2048; // 2 Mo
    private const ALLOWED_MIMES = ['jpg', 'jpeg', 'png', 'webp'];

    /**
     * POST /api/v1/employees/{employee}/avatar
     * Champ multipart : `avatar` (fichier image).
     *
     * Unification de l'avatar : on écrit sur `users.avatar_path` (la photo
     * PERSONNELLE de l'utilisateur lié à l'intervenant). Comme ça la photo est
     * partagée partout : fiche admin, app mobile intervenant, frontend web
     * /profil — UNE seule photo, UN seul fichier, pas de désynchronisation.
     *
     * Pour les intervenants sans user lié (cas rare, intervenant pas
     * encore activé), on tombe en fallback sur `employees.avatar_path`.
     */
    public function uploadEmployeeAvatar(Request $request, Employee $employee)
    {
        abort_unless($request->user()?->can('employees.edit'), 403);

        $request->validate([
            'avatar' => ['required', 'file', 'image', 'mimes:'.implode(',', self::ALLOWED_MIMES), 'max:'.self::MAX_SIZE_KB],
        ]);

        // Supprime les anciens avatars pour éviter d'accumuler des fichiers
        // orphelins. On nettoie les DEUX emplacements (legacy employees +
        // user) pour rester propre.
        if ($employee->avatar_path && Storage::disk('public')->exists($employee->avatar_path)) {
            Storage::disk('public')->delete($employee->avatar_path);
        }
        $user = $employee->user;
        if ($user?->avatar_path && Storage::disk('public')->exists($user->avatar_path)) {
            Storage::disk('public')->delete($user->avatar_path);
        }

        $file = $request->file('avatar');
        $ext = $file->getClientOriginalExtension() ?: $file->guessExtension();
        $filename = "{$employee->id}_".Str::random(16).".{$ext}";
        $path = $file->storeAs('avatars', $filename, 'public');

        // Priorité : on écrit sur le User (unifié). Sinon, fallback Employee.
        if ($user) {
            $user->forceFill(['avatar_path' => $path])->save();
            // On clear l'ancien chemin employee pour éviter qu'il prenne la
            // précédence dans le accessor (l'avatar perso doit gagner).
            if ($employee->avatar_path) {
                $employee->update(['avatar_path' => null]);
            }
        } else {
            $employee->update(['avatar_path' => $path]);
        }

        return ['data' => $employee->fresh(['user'])];
    }

    /**
     * DELETE /api/v1/employees/{employee}/avatar
     *
     * Supprime les deux chemins (perso users + legacy employees) pour rester
     * propre — symétrique avec l'upload unifié ci-dessus.
     */
    public function deleteEmployeeAvatar(Request $request, Employee $employee)
    {
        abort_unless($request->user()?->can('employees.edit'), 403);

        if ($employee->avatar_path && Storage::disk('public')->exists($employee->avatar_path)) {
            Storage::disk('public')->delete($employee->avatar_path);
        }
        $employee->update(['avatar_path' => null]);

        $user = $employee->user;
        if ($user?->avatar_path) {
            if (Storage::disk('public')->exists($user->avatar_path)) {
                Storage::disk('public')->delete($user->avatar_path);
            }
            $user->forceFill(['avatar_path' => null])->save();
        }

        return response()->noContent();
    }

    /**
     * POST /api/v1/clients/{client}/logo
     * Champ multipart : `logo` (fichier image).
     *
     * Le logo est stocké sur client_companies.photo (le DBML l'appelle "photo"
     * pour des raisons historiques mais c'est bien le logo de l'entreprise).
     */
    public function uploadClientLogo(Request $request, Client $client)
    {
        abort_unless($request->user()?->can('clients.edit'), 403);

        $request->validate([
            'logo' => ['required', 'file', 'image', 'mimes:'.implode(',', self::ALLOWED_MIMES), 'max:'.self::MAX_SIZE_KB],
        ]);

        $company = $client->company;
        if (! $company) {
            return response()->json(['message' => 'Ce client n\'a pas de fiche entreprise.'], 422);
        }

        if ($company->photo && Storage::disk('public')->exists($company->photo)) {
            Storage::disk('public')->delete($company->photo);
        }

        $file = $request->file('logo');
        $ext = $file->getClientOriginalExtension() ?: $file->guessExtension();
        $filename = "client_{$client->id}_".Str::random(16).".{$ext}";
        $path = $file->storeAs('logos', $filename, 'public');

        $company->update(['photo' => $path]);

        return ['data' => $company->fresh()];
    }

    /**
     * DELETE /api/v1/clients/{client}/logo
     */
    public function deleteClientLogo(Request $request, Client $client)
    {
        abort_unless($request->user()?->can('clients.edit'), 403);

        $company = $client->company;
        if (! $company) {
            return response()->noContent();
        }

        if ($company->photo && Storage::disk('public')->exists($company->photo)) {
            Storage::disk('public')->delete($company->photo);
        }
        $company->update(['photo' => null]);

        return response()->noContent();
    }
}
