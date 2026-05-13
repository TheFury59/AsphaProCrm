<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Gestion de la matrice rôle × permission via UI super-admin.
 *
 * Endpoints :
 *  - GET  /admin/permissions     → liste perms + roles + matrice actuelle
 *  - PUT  /admin/roles/{role}/permissions  → sync toutes les permissions du rôle
 */
class PermissionsController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()?->hasRole('super_admin'), 403);

        $permissions = Permission::orderBy('name')->get(['id', 'name']);
        $roles = Role::with('permissions:id')->orderBy('name')->get();

        $matrix = $roles->mapWithKeys(function ($role) {
            return [$role->name => $role->permissions->pluck('id')->all()];
        });

        // Groupe les permissions par module pour l'UI (ex: clients.* → "clients")
        $grouped = $permissions->groupBy(function ($p) {
            return str_contains($p->name, '.') ? explode('.', $p->name)[0] : 'other';
        });

        return [
            'data' => [
                'roles' => $roles->map(fn ($r) => ['id' => $r->id, 'name' => $r->name]),
                'permissions' => $permissions,
                'grouped' => $grouped,
                'matrix' => $matrix,
            ],
        ];
    }

    public function syncRolePermissions(Request $request, string $roleName)
    {
        abort_unless($request->user()?->hasRole('super_admin'), 403);
        abort_if($roleName === 'super_admin', 422, 'Le super_admin a toutes les permissions par construction.');

        $data = $request->validate([
            'permission_ids' => ['required', 'array'],
            'permission_ids.*' => ['integer'],
        ]);

        $role = Role::where('name', $roleName)->firstOrFail();
        $permissions = Permission::whereIn('id', $data['permission_ids'])->get();
        $role->syncPermissions($permissions);

        return ['data' => ['role' => $role->name, 'count' => $permissions->count()]];
    }
}
