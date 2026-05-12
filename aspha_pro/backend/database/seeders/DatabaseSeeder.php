<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Étape 1 : rôles + permissions
        $this->call(RolesAndPermissionsSeeder::class);

        // Étape 2 : catalogue (entité, TVA, raisons, compétences, barèmes, etc.)
        $this->call(CatalogSeeder::class);

        // Étape 2bis : types de notifications applicatives
        $this->call(NotificationTypesSeeder::class);

        // Étape 3 : super-admin par défaut
        $admin = User::firstOrCreate(
            ['email' => 'admin@aspha.local'],
            [
                'name' => 'Super Admin',
                'password' => 'admin1234',
                'status' => User::STATUS_ACTIVE,
                'email_verified_at' => now(),
            ]
        );
        $admin->syncRoles(['super_admin']);

        $this->command->info('');
        $this->command->info('====================================================');
        $this->command->info('  Aspha Pro — données initiales chargées');
        $this->command->info('====================================================');
        $this->command->info('  Super-admin : admin@aspha.local / admin1234');
        $this->command->info('====================================================');
    }
}
