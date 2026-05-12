<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Artisan;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Crée les rôles et permissions de base d'Aspha Pro.
 *
 * Rôles (depuis modifications docx) :
 *   - super_admin    : accès total (duplicable)
 *   - admin          : agent administratif (tout sauf paie)
 *   - intervenant    : télégestion uniquement + planning perso
 *   - client         : portail client
 *
 * Les permissions fines sont attribuées par module/action.
 * La matrice complète figure dans plan-rebuild-aspha-pro.docx (§ 8).
 */
class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        // Reset cache Spatie
        Artisan::call('permission:cache-reset');

        // === Permissions par module ===
        $permissions = [
            // Clients
            'clients.view', 'clients.create', 'clients.edit', 'clients.delete',
            // Employees
            'employees.view', 'employees.create', 'employees.edit', 'employees.delete',
            // Paie (super_admin uniquement)
            'payroll.view', 'payroll.export',
            // Contrats
            'contracts.view', 'contracts.edit',
            // Planning
            'planning.view', 'planning.edit', 'planning.create_intervention',
            // Télégestion
            'telemanagement.badge', 'telemanagement.manual_entry',
            // Ventes
            'sales.quotes.view', 'sales.quotes.edit',
            'sales.invoices.view', 'sales.invoices.edit',
            'sales.payments.record',
            // Portail client
            'portal.requests.create', 'portal.signatures.sign',
            // Stock
            'stock.view', 'stock.manage',
            // Admin
            'admin.users.manage', 'admin.roles.manage',
        ];

        foreach ($permissions as $perm) {
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
        }

        // === Rôles ===
        $superAdmin = Role::firstOrCreate(['name' => 'super_admin', 'guard_name' => 'web']);
        $admin = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $intervenant = Role::firstOrCreate(['name' => 'intervenant', 'guard_name' => 'web']);
        $client = Role::firstOrCreate(['name' => 'client', 'guard_name' => 'web']);

        // === Attribution permissions ===

        // super_admin = TOUT
        $superAdmin->syncPermissions(Permission::all());

        // admin = tout sauf paie + roles + delete clients
        $admin->syncPermissions([
            'clients.view', 'clients.create', 'clients.edit',
            'employees.view', 'employees.create', 'employees.edit',
            'contracts.view', 'contracts.edit',
            'planning.view', 'planning.edit', 'planning.create_intervention',
            'telemanagement.badge', 'telemanagement.manual_entry',
            'sales.quotes.view', 'sales.quotes.edit',
            'sales.invoices.view', 'sales.invoices.edit',
            'sales.payments.record',
            'stock.view', 'stock.manage',
        ]);

        // intervenant = télégestion + planning perso
        $intervenant->syncPermissions([
            'planning.view',
            'telemanagement.badge',
        ]);

        // client = portail uniquement
        $client->syncPermissions([
            'sales.quotes.view',
            'sales.invoices.view',
            'planning.view',
            'portal.requests.create',
            'portal.signatures.sign',
        ]);

        $this->command->info('Roles & permissions seeded:');
        $this->command->info('  - 4 roles : super_admin, admin, intervenant, client');
        $this->command->info('  - ' . count($permissions) . ' permissions');
    }
}
