<?php

namespace Database\Seeders;

use App\Models\Site;
use App\Models\User;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Roles Spatie (les permissions fines arriveront avec le module Rôles)
        foreach (['super-admin', 'admin', 'manager', 'employee', 'client'] as $roleName) {
            Role::findOrCreate($roleName, 'web');
        }

        // Site par défaut
        $site = Site::firstOrCreate(
            ['code' => 'ASPHA-MAIN'],
            [
                'name' => 'Aspha — Siège',
                'address_line1' => '',
                'postal_code' => '',
                'city' => '',
                'country' => 'FR',
                'timezone' => 'Europe/Paris',
                'is_active' => true,
            ]
        );

        // Super-administrateur
        $admin = User::firstOrCreate(
            ['email' => 'admin@aspha.local'],
            [
                'name' => 'Super Admin',
                'password' => 'admin1234',
                'type' => User::TYPE_ADMIN,
                'site_id' => $site->id,
                'email_verified_at' => now(),
            ]
        );
        $admin->syncRoles(['super-admin']);

        $this->command->info("Default admin: admin@aspha.local / admin1234");

        $this->call(DemoDataSeeder::class);
    }
}
