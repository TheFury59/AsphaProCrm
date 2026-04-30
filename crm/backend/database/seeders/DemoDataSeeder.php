<?php

namespace Database\Seeders;

use App\Models\Client;
use App\Models\ClientAddress;
use App\Models\Employee;
use App\Models\EmployeeContract;
use App\Models\Service;
use App\Models\ServiceAssignment;
use App\Models\Site;
use App\Models\User;
use App\Services\AppointmentMaterializer;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DemoDataSeeder extends Seeder
{
    public function run(AppointmentMaterializer $materializer): void
    {
        $site = Site::firstWhere('code', 'ASPHA-MAIN');

        // === Catalogue de prestations ===
        $services = collect([
            ['name' => 'Ménage', 'code' => 'CLEAN-2H', 'duration' => 120, 'rate' => 25.00, 'color' => '#3b82f6'],
            ['name' => 'Aide aux courses', 'code' => 'SHOPPING', 'duration' => 60, 'rate' => 22.00, 'color' => '#10b981'],
            ['name' => 'Aide repas', 'code' => 'MEAL', 'duration' => 90, 'rate' => 23.00, 'color' => '#f59e0b'],
            ['name' => 'Compagnie & lecture', 'code' => 'COMPANY', 'duration' => 60, 'rate' => 20.00, 'color' => '#a855f7'],
        ])->map(fn ($s) => Service::firstOrCreate(
            ['code' => $s['code']],
            [
                'name' => $s['name'],
                'description' => null,
                'default_duration_minutes' => $s['duration'],
                'default_hourly_rate' => $s['rate'],
                'color' => $s['color'],
                'is_active' => true,
            ]
        ));

        // === 3 intervenants ===
        $employees = collect([
            ['first' => 'Sophie', 'last' => 'Martin',  'email' => 'sophie.martin@aspha.local',  'lat' => 48.8675, 'lng' => 2.3450, 'hours' => 35],
            ['first' => 'Karim',  'last' => 'Benali',  'email' => 'karim.benali@aspha.local',   'lat' => 48.8600, 'lng' => 2.3550, 'hours' => 30],
            ['first' => 'Émilie', 'last' => 'Dubois',  'email' => 'emilie.dubois@aspha.local',  'lat' => 48.8800, 'lng' => 2.3300, 'hours' => 25],
        ])->map(function ($e) use ($site) {
            $user = User::firstOrCreate(
                ['email' => $e['email']],
                [
                    'name' => $e['first'] . ' ' . $e['last'],
                    'password' => Hash::make('demo1234'),
                    'type' => User::TYPE_EMPLOYEE,
                    'site_id' => $site->id,
                    'email_verified_at' => now(),
                ]
            );
            $user->syncRoles(['employee']);

            $emp = Employee::firstOrCreate(
                ['user_id' => $user->id],
                [
                    'site_id' => $site->id,
                    'first_name' => $e['first'],
                    'last_name' => $e['last'],
                    'phone' => '01 23 45 67 89',
                    'address_line1' => '12 rue de la Paix',
                    'postal_code' => '75002',
                    'city' => 'Paris',
                    'country' => 'FR',
                    'geo_lat' => $e['lat'],
                    'geo_lng' => $e['lng'],
                    'hire_date' => now()->subYear()->toDateString(),
                    'status' => Employee::STATUS_ACTIVE,
                ]
            );

            EmployeeContract::firstOrCreate(
                ['employee_id' => $emp->id, 'is_current' => true],
                [
                    'position' => 'Auxiliaire de vie',
                    'weekly_hours' => $e['hours'],
                    'vacation_days_per_year' => 25,
                    'hourly_gross_rate' => 13.50,
                    'start_date' => now()->subYear()->toDateString(),
                    'contract_type' => 'cdi',
                ]
            );

            return $emp;
        });

        // === 5 clients avec adresses Paris ===
        $clients = collect([
            ['first' => 'Madame', 'last' => 'Dupont',   'email' => 'dupont@example.com',   'lat' => 48.8650, 'lng' => 2.3400, 'addr' => '5 rue Saint-Honoré',   'cp' => '75001'],
            ['first' => 'Monsieur', 'last' => 'Bernard', 'email' => 'bernard@example.com', 'lat' => 48.8700, 'lng' => 2.3500, 'addr' => '23 boulevard Haussmann', 'cp' => '75009'],
            ['first' => 'Madame', 'last' => 'Petit',    'email' => 'petit@example.com',   'lat' => 48.8550, 'lng' => 2.3600, 'addr' => '8 rue du Bac',          'cp' => '75007'],
            ['first' => 'Monsieur', 'last' => 'Robert', 'email' => 'robert@example.com',  'lat' => 48.8750, 'lng' => 2.3300, 'addr' => '14 avenue de l\'Opéra', 'cp' => '75002'],
            ['first' => 'Madame', 'last' => 'Lambert',  'email' => 'lambert@example.com', 'lat' => 48.8500, 'lng' => 2.3700, 'addr' => '3 rue Mouffetard',     'cp' => '75005'],
        ])->map(function ($c) use ($site) {
            $client = Client::firstOrCreate(
                ['email' => $c['email'], 'site_id' => $site->id],
                [
                    'type' => 'individual',
                    'first_name' => $c['first'],
                    'last_name' => $c['last'],
                    'phone' => '01 98 76 54 32',
                ]
            );
            ClientAddress::firstOrCreate(
                ['client_id' => $client->id, 'is_default' => true],
                [
                    'label' => 'Domicile',
                    'address_line1' => $c['addr'],
                    'postal_code' => $c['cp'],
                    'city' => 'Paris',
                    'country' => 'FR',
                    'geo_lat' => $c['lat'],
                    'geo_lng' => $c['lng'],
                ]
            );
            return $client;
        });

        // === Service assignments — mélange ponctuel / récurrent ===
        $admin = User::firstWhere('email', 'admin@aspha.local');

        // 1. Mme Dupont — Ménage hebdo lundi + mercredi 9h, par Sophie
        $sa1 = ServiceAssignment::firstOrCreate(
            [
                'client_id' => $clients[0]->id,
                'service_id' => $services[0]->id,
                'type' => ServiceAssignment::TYPE_RECURRING,
            ],
            [
                'client_address_id' => $clients[0]->addresses->first()->id,
                'default_employee_id' => $employees[0]->id,
                'duration_minutes' => 120,
                'recurrence_start' => now()->startOfMonth()->toDateString(),
                'recurrence_end' => now()->endOfMonth()->addMonths(2)->toDateString(),
                'recurrence_time' => '09:00:00',
                'recurrence_rule' => 'FREQ=WEEKLY;BYDAY=MO,WE',
                'status' => ServiceAssignment::STATUS_ACTIVE,
                'created_by_user_id' => $admin?->id,
                'notes' => 'Démo : ménage hebdo bi-hebdomadaire',
            ]
        );

        // 2. M. Bernard — Aide repas mardi/jeudi 12h, par Karim
        $sa2 = ServiceAssignment::firstOrCreate(
            [
                'client_id' => $clients[1]->id,
                'service_id' => $services[2]->id,
                'type' => ServiceAssignment::TYPE_RECURRING,
            ],
            [
                'client_address_id' => $clients[1]->addresses->first()->id,
                'default_employee_id' => $employees[1]->id,
                'duration_minutes' => 90,
                'recurrence_start' => now()->startOfMonth()->toDateString(),
                'recurrence_end' => null,
                'recurrence_time' => '12:00:00',
                'recurrence_rule' => 'FREQ=WEEKLY;BYDAY=TU,TH',
                'status' => ServiceAssignment::STATUS_ACTIVE,
                'created_by_user_id' => $admin?->id,
            ]
        );

        // 3. Mme Petit — Compagnie tous les vendredis 15h, par Émilie
        $sa3 = ServiceAssignment::firstOrCreate(
            [
                'client_id' => $clients[2]->id,
                'service_id' => $services[3]->id,
                'type' => ServiceAssignment::TYPE_RECURRING,
            ],
            [
                'client_address_id' => $clients[2]->addresses->first()->id,
                'default_employee_id' => $employees[2]->id,
                'duration_minutes' => 60,
                'recurrence_start' => now()->startOfMonth()->toDateString(),
                'recurrence_end' => null,
                'recurrence_time' => '15:00:00',
                'recurrence_rule' => 'FREQ=WEEKLY;BYDAY=FR',
                'status' => ServiceAssignment::STATUS_ACTIVE,
                'created_by_user_id' => $admin?->id,
            ]
        );

        // 4. M. Robert — Courses ponctuelles, jeudi prochain 10h, par Sophie
        ServiceAssignment::firstOrCreate(
            [
                'client_id' => $clients[3]->id,
                'service_id' => $services[1]->id,
                'type' => ServiceAssignment::TYPE_PUNCTUAL,
            ],
            [
                'client_address_id' => $clients[3]->addresses->first()->id,
                'default_employee_id' => $employees[0]->id,
                'duration_minutes' => 60,
                'scheduled_date' => now()->next(Carbon::THURSDAY)->toDateString(),
                'scheduled_time' => '10:00:00',
                'status' => ServiceAssignment::STATUS_ACTIVE,
                'created_by_user_id' => $admin?->id,
                'notes' => 'Démo : intervention ponctuelle',
            ]
        );

        // 5. Mme Lambert — Ménage tous les 15 jours, par Karim
        ServiceAssignment::firstOrCreate(
            [
                'client_id' => $clients[4]->id,
                'service_id' => $services[0]->id,
                'type' => ServiceAssignment::TYPE_RECURRING,
            ],
            [
                'client_address_id' => $clients[4]->addresses->first()->id,
                'default_employee_id' => $employees[1]->id,
                'duration_minutes' => 120,
                'recurrence_start' => now()->startOfMonth()->toDateString(),
                'recurrence_end' => null,
                'recurrence_time' => '14:00:00',
                'recurrence_rule' => 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO',
                'status' => ServiceAssignment::STATUS_ACTIVE,
                'created_by_user_id' => $admin?->id,
            ]
        );

        // === Matérialisation des appointments sur 6 semaines ===
        $from = now()->startOfWeek();
        $to = now()->addWeeks(6)->endOfWeek();
        $created = $materializer->materializeAll($from, $to);

        $this->command->info("Demo data seeded:");
        $this->command->info("  - {$services->count()} services");
        $this->command->info("  - {$employees->count()} intervenants");
        $this->command->info("  - {$clients->count()} clients");
        $this->command->info("  - 5 service_assignments");
        $this->command->info("  - {$created} appointments materialized over 6 weeks");
    }
}
