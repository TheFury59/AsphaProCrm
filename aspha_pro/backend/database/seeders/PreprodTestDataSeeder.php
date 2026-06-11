<?php

namespace Database\Seeders;

use App\Models\Address;
use App\Models\Checkin;
use App\Models\Client;
use App\Models\ClientCompany;
use App\Models\ClientContact;
use App\Models\ClientPrestation;
use App\Models\ClientRequest;
use App\Models\ClientRequestMessage;
use App\Models\Contract;
use App\Models\Employee;
use App\Models\Entity;
use App\Models\Intervention;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Mission;
use App\Models\Quote;
use App\Models\QuoteItem;
use App\Models\Skill;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Seeder de données de PRÉPROD pour tester l'app web + mobile.
 *
 * Génère un jeu réaliste : 3 clients B2B, 2 intervenants, 3 missions,
 * 8-12 interventions (passées/futures), 3 devis, 3 factures, 2 tickets.
 *
 * Idempotent : on utilise updateOrCreate / firstOrCreate / where()->exists()
 * pour qu'un second `db:seed --class=PreprodTestDataSeeder` ne crée pas de doublons.
 *
 * Refus de tourner en prod (sauf si le nom d'app contient "PREPROD") — garde-fou
 * pour éviter d'écraser des vraies données client en production.
 *
 * Observers Eloquent désactivés pendant l'exécution (Model::withoutEvents) pour
 * NE PAS générer des centaines de notifications "fausses" au seed. Le contexte
 * métier (event créé/modifié) n'a pas de sens en seed de démo.
 */
class PreprodTestDataSeeder extends Seeder
{
    private const PASSWORD = 'Preprod2026!';
    private const EMAIL_DOMAIN = 'aspha-test.local';

    public function run(): void
    {
        // === Garde-fou prod ===
        abort_if(
            config('app.env') === 'production' && ! str_contains((string) config('app.name'), 'PREPROD'),
            500,
            'Ce seeder ne doit pas tourner en prod.'
        );

        // On désactive les observers Eloquent pendant tout le seed : sans ça,
        // créer 10 interventions + 3 missions + 3 devis + 3 factures + 2 tickets
        // dispatcherait des dizaines de notifications dans `notifications`,
        // pollue la cloche des admins et fausse les tests UI.
        Model::withoutEvents(function () {
            DB::transaction(function () {
                $entity = $this->getEntity();
                $owner = $this->getOwnerAdmin();

                $clients = $this->seedClients($entity, $owner);
                $intervenants = $this->seedIntervenants($entity, $owner);

                [$missions, $prestations] = $this->seedMissionsAndPrestations($clients);
                $this->seedInterventions($clients, $missions, $prestations, $intervenants);
                $this->seedQuotes($clients, $entity, $owner);
                $this->seedInvoices($clients, $entity);
                $this->seedTickets($clients, $intervenants, $owner);
            });
        });

        $this->printRecap();
    }

    // ===================================================================
    //  RÉFÉRENTIELS
    // ===================================================================

    private function getEntity(): Entity
    {
        $entity = Entity::where('siret', '00000000000000')->first()
            ?? Entity::first();

        if (! $entity) {
            $this->command->error('Aucune entité trouvée — lance d\'abord CatalogSeeder.');
            abort(500, 'Entité manquante.');
        }
        return $entity;
    }

    private function getOwnerAdmin(): User
    {
        $owner = User::whereHas('roles', fn ($q) => $q->whereIn('name', ['super_admin', 'admin']))->first();
        if (! $owner) {
            $this->command->error('Aucun admin trouvé — lance d\'abord DatabaseSeeder.');
            abort(500, 'Admin manquant.');
        }
        return $owner;
    }

    /**
     * Récupère ou crée une Skill par label (idempotent).
     */
    private function skill(string $label): Skill
    {
        return Skill::firstOrCreate(
            ['label' => $label],
            ['status' => 'active']
        );
    }

    // ===================================================================
    //  CLIENTS
    // ===================================================================

    /**
     * @return array<string,Client> indexé par clé courte ('atelier', 'boulangerie', 'cabinet')
     */
    private function seedClients(Entity $entity, User $owner): array
    {
        $defs = [
            'atelier' => [
                'code' => 'CLI001',
                'email' => 'atelier.textil@'.self::EMAIL_DOMAIN,
                'name' => 'Atelier Couture Textil',
                'user_name' => 'Atelier Couture Textil',
                'legal_form' => 'SARL',
                'siret' => '40012345600015',
                'vat_number' => 'FR12400123456',
                'manager_first_name' => 'Marie',
                'manager_last_name' => 'Lefèvre',
                'manager_civility' => 'Mme',
                'manager_role' => 'Gérante',
                'phone_landline' => '0320111111',
                'phone_mobile' => '0612111111',
                'address' => '45 Grande Rue',
                'postal_code' => '59500',
                'city' => 'Douai',
                'lat' => 50.3714,
                'lng' => 3.0800,
                'contact_name' => 'Marie Lefèvre',
                'contact_phone' => '0612111111',
            ],
            'boulangerie' => [
                'code' => 'CLI002',
                'email' => 'boulangerie.centre@'.self::EMAIL_DOMAIN,
                'name' => 'Boulangerie du Centre',
                'user_name' => 'Boulangerie du Centre',
                'legal_form' => 'EURL',
                'siret' => '40023456700016',
                'vat_number' => 'FR34400234567',
                'manager_first_name' => 'Pierre',
                'manager_last_name' => 'Dubois',
                'manager_civility' => 'M.',
                'manager_role' => 'Gérant',
                'phone_landline' => '0320222222',
                'phone_mobile' => '0612222222',
                'address' => '12 rue Faidherbe',
                'postal_code' => '59000',
                'city' => 'Lille',
                'lat' => 50.6363,
                'lng' => 3.0633,
                'contact_name' => 'Pierre Dubois',
                'contact_phone' => '0612222222',
            ],
            'cabinet' => [
                'code' => 'CLI003',
                'email' => 'cabinet.saint-roch@'.self::EMAIL_DOMAIN,
                'name' => 'Cabinet Médical Saint-Roch',
                'user_name' => 'Cabinet Médical Saint-Roch',
                'legal_form' => 'SCP',
                'siret' => '40034567800017',
                'vat_number' => 'FR56400345678',
                'manager_first_name' => 'Sophie',
                'manager_last_name' => 'Bernard',
                'manager_civility' => 'Dr',
                'manager_role' => 'Médecin responsable',
                'phone_landline' => '0320333333',
                'phone_mobile' => '0612333333',
                'address' => '8 place Saint-Roch',
                'postal_code' => '59500',
                'city' => 'Douai',
                'lat' => 50.3741,
                'lng' => 3.0833,
                'contact_name' => 'Sophie Bernard',
                'contact_phone' => '0612333333',
            ],
        ];

        $clients = [];

        foreach ($defs as $key => $def) {
            // 1) User portail client
            $portalUser = User::where('email', $def['email'])->first();
            if (! $portalUser) {
                $portalUser = User::create([
                    'name' => $def['user_name'],
                    'email' => $def['email'],
                    'password' => self::PASSWORD,
                    'status' => User::STATUS_ACTIVE,
                    'must_change_password' => false,
                    'email_verified_at' => now(),
                ]);
            }
            // syncRoles est idempotent
            $portalUser->syncRoles(['client']);

            // 2) Client (clé idempotente = code)
            // Détache d'abord le portalUser de tout autre client qui le porterait
            // (la colonne clients.portal_user_id est UNIQUE — collision possible si
            // un seeder de démo l'avait déjà attribué à un autre client).
            Client::where('portal_user_id', $portalUser->id)
                ->where('code', '!=', $def['code'])
                ->update(['portal_user_id' => null]);

            $client = Client::where('code', $def['code'])->first();
            if (! $client) {
                $client = Client::create([
                    'code' => $def['code'],
                    'status' => Client::STATUS_ACTIVE,
                    'entity_id' => $entity->id,
                    'owner_user_id' => $owner->id,
                    'portal_user_id' => $portalUser->id,
                ]);
            } elseif ($client->portal_user_id !== $portalUser->id) {
                $client->update(['portal_user_id' => $portalUser->id]);
            }

            // 3) ClientCompany (1-1)
            ClientCompany::updateOrCreate(
                ['client_id' => $client->id],
                [
                    'company_name' => $def['name'],
                    'legal_form' => $def['legal_form'],
                    'siret' => $def['siret'],
                    'vat_number' => $def['vat_number'],
                    'manager_civility' => $def['manager_civility'],
                    'manager_first_name' => $def['manager_first_name'],
                    'manager_last_name' => $def['manager_last_name'],
                    'manager_role' => $def['manager_role'],
                    'phone_landline' => $def['phone_landline'],
                    'phone_mobile' => $def['phone_mobile'],
                    'primary_email' => $def['email'],
                ]
            );

            // 4) Adresse principale (idempotent : 1 seule adresse main par client)
            $hasMain = Address::where('owner_type', 'client')
                ->where('owner_id', $client->id)
                ->where('type', 'main')
                ->exists();

            if (! $hasMain) {
                // On force lat/lng pour skip le géocodage (BAN.gouv plante sur Windows
                // en CI sans CA bundle + on évite N requêtes HTTP en seed)
                Address::create([
                    'owner_type' => 'client',
                    'owner_id' => $client->id,
                    'type' => 'main',
                    'address' => $def['address'],
                    'postal_code' => $def['postal_code'],
                    'city' => $def['city'],
                    'latitude' => $def['lat'],
                    'longitude' => $def['lng'],
                ]);
            }

            // 5) Contact principal (1 entrée téléphone + 1 entrée email)
            // Clé d'idempotence : (client_id, type, value)
            ClientContact::firstOrCreate(
                [
                    'client_id' => $client->id,
                    'type' => 'phone',
                    'value' => $def['contact_phone'],
                ],
                ['name' => $def['contact_name'], 'is_primary' => true]
            );
            ClientContact::firstOrCreate(
                [
                    'client_id' => $client->id,
                    'type' => 'email',
                    'value' => $def['email'],
                ],
                ['name' => $def['contact_name'], 'is_primary' => false]
            );

            $clients[$key] = $client->fresh();
        }

        return $clients;
    }

    // ===================================================================
    //  INTERVENANTS
    // ===================================================================

    /**
     * @return array<string,Employee> indexé par clé courte ('adeline', 'mehdi')
     */
    private function seedIntervenants(Entity $entity, User $owner): array
    {
        $defs = [
            'adeline' => [
                'email' => 'adeline.muret@'.self::EMAIL_DOMAIN,
                'name' => 'Adeline Muret',
                'phone' => '0612999911',
                'weekly_duration' => 35,
                'skills' => ['Couture', 'Ménage général'],
            ],
            'mehdi' => [
                'email' => 'mehdi.lambert@'.self::EMAIL_DOMAIN,
                'name' => 'Mehdi Lambert',
                'phone' => '0612999922',
                'weekly_duration' => 30,
                'skills' => ['Plomberie', 'Électricité'],
            ],
        ];

        $intervenants = [];

        foreach ($defs as $key => $def) {
            // 1) User preprod (toujours créé pour avoir un compte test prévisible).
            $user = User::where('email', $def['email'])->first();
            if (! $user) {
                $user = User::create([
                    'name' => $def['name'],
                    'email' => $def['email'],
                    'password' => self::PASSWORD,
                    'status' => User::STATUS_ACTIVE,
                    'must_change_password' => false,
                    'email_verified_at' => now(),
                ]);
            }
            $user->syncRoles(['intervenant']);

            // 2) Employee. Brief : « si déjà existante, skip — sinon créer ».
            // Priorité d'identification :
            //  (a) Employee déjà lié à notre user preprod (run précédent) → on le réutilise.
            //  (b) Sinon, Employee du même nom (Adeline saisie avant le seeder)
            //      → on l'adopte (sans la dupliquer).
            //  (c) Sinon → on en crée un nouveau lié au user preprod.
            $employee = Employee::where('user_id', $user->id)->first();
            if (! $employee) {
                $employee = Employee::where('name', $def['name'])->first();
                if ($employee && ! $employee->user_id) {
                    // L'employee existant n'a pas de user : on attache le user preprod.
                    $employee->update(['user_id' => $user->id]);
                }
            }
            if (! $employee) {
                $employee = Employee::create([
                    'user_id' => $user->id,
                    'entity_id' => $entity->id,
                    'owner_user_id' => $owner->id,
                    'name' => $def['name'],
                    'phone' => $def['phone'],
                    'classification' => Employee::CLASSIFICATION_NON_CADRE,
                    'transport_mode' => 'car',
                    'has_company_vehicle' => false,
                ]);
            }

            // 3) Contrat actif (idempotent : 1 contrat is_current par employee)
            $hasCurrent = Contract::where('employee_id', $employee->id)
                ->where('is_current', true)
                ->exists();

            if (! $hasCurrent) {
                Contract::create([
                    'employee_id' => $employee->id,
                    'entity_id' => $entity->id,
                    'is_current' => true,
                    'position' => 'Intervenant terrain',
                    'contract_type' => 'cdi',
                    'start_date' => Carbon::today()->subMonths(6)->toDateString(),
                    'work_time_type' => 'part_time',
                    'weekly_duration' => $def['weekly_duration'],
                    'monthly_duration' => round($def['weekly_duration'] * 52 / 12, 2),
                    'pay_mode' => 'monthly_salary',
                    'monthly_salary' => 1800.00,
                    'hourly_rate' => 12.50,
                    'employee_status' => 'non_cadre',
                    'seniority_date' => Carbon::today()->subMonths(6)->toDateString(),
                    'qualification' => 'Auxiliaire de vie sociale',
                    'geographic_zone' => 'france_metro',
                ]);
            }

            // 4) Compétences (sync sans détacher : on ajoute, on ne retire pas)
            $skillIds = collect($def['skills'])
                ->map(fn (string $label) => $this->skill($label)->id)
                ->all();
            $employee->skills()->syncWithoutDetaching($skillIds);

            $intervenants[$key] = $employee->fresh();
        }

        return $intervenants;
    }

    // ===================================================================
    //  MISSIONS + PRESTATIONS
    // ===================================================================

    /**
     * @param  array<string,Client>  $clients
     * @return array{0:array<string,Mission>,1:array<string,ClientPrestation>}
     */
    private function seedMissionsAndPrestations(array $clients): array
    {
        $defs = [
            'atelier' => [
                'name' => 'Maintenance hebdo atelier',
                'rhythm' => 'per_week',
                'prestations' => [
                    ['label' => 'Entretien hebdomadaire atelier', 'price' => 80.00, 'duration' => 120],
                    ['label' => 'Petites réparations couture', 'price' => 45.00, 'duration' => 60],
                ],
            ],
            'boulangerie' => [
                'name' => 'Nettoyage quotidien fournil',
                'rhythm' => 'per_week',
                'prestations' => [
                    ['label' => 'Nettoyage fournil & vitrine', 'price' => 35.00, 'duration' => 60],
                ],
            ],
            'cabinet' => [
                'name' => 'Désinfection salles de consult',
                'rhythm' => 'per_week',
                'prestations' => [
                    ['label' => 'Désinfection salles + accueil', 'price' => 65.00, 'duration' => 90],
                    ['label' => 'Réassort consommables', 'price' => 20.00, 'duration' => 30],
                ],
            ],
        ];

        $missions = [];
        $prestations = [];

        foreach ($defs as $key => $def) {
            $client = $clients[$key];

            // Mission idempotente (clé = client_id + name)
            $mission = Mission::where('client_id', $client->id)
                ->where('name', $def['name'])
                ->first();

            if (! $mission) {
                $mission = Mission::create([
                    'client_id' => $client->id,
                    'name' => $def['name'],
                    'status' => 'active',
                    'no_intervention_no_bill' => false,
                    'payment_methods' => 'transfer,check',
                    'online_payment_enabled' => false,
                    'billing_rhythm' => $def['rhythm'],
                ]);
            }
            $missions[$key] = $mission;

            // Prestations (idempotent par mission_id + label)
            foreach ($def['prestations'] as $i => $p) {
                $existing = ClientPrestation::where('mission_id', $mission->id)
                    ->where('label', $p['label'])
                    ->first();

                if (! $existing) {
                    $existing = ClientPrestation::create([
                        'client_id' => $client->id,
                        'mission_id' => $mission->id,
                        'label' => $p['label'],
                        'start_date' => Carbon::today()->subMonth()->toDateString(),
                        'billing_type' => 'forfait',
                        'pricing_type' => 'custom',
                        'custom_price' => $p['price'],
                        'base_price' => $p['price'],
                        'duration_minutes' => $p['duration'],
                        'nature' => 'punctual', // pas de récurrence auto (on génère nous-mêmes)
                        'no_intervention_no_bill' => false,
                    ]);
                }
                $prestations["{$key}_{$i}"] = $existing;
            }
        }

        return [$missions, $prestations];
    }

    // ===================================================================
    //  INTERVENTIONS (RDV)
    // ===================================================================

    /**
     * @param  array<string,Client>          $clients
     * @param  array<string,Mission>         $missions
     * @param  array<string,ClientPrestation>$prestations
     * @param  array<string,Employee>        $intervenants
     */
    private function seedInterventions(array $clients, array $missions, array $prestations, array $intervenants): void
    {
        // Carbon ancré à aujourd'hui — semaine ISO (lundi base).
        $today = Carbon::today();
        $adeline = $intervenants['adeline'];
        $mehdi = $intervenants['mehdi'];

        $atelier = $clients['atelier'];
        $boulangerie = $clients['boulangerie'];
        $cabinet = $clients['cabinet'];

        // Liste des RDV à créer. Clé d'idempotence : (client_id, employee_id, start_datetime).
        // 5 passés (réalisés) + 3 cette semaine + 2 semaine prochaine = 10 total.
        $defs = [
            // === 5 RDV PASSÉS (réalisés) — semaine dernière ===
            // 4 avec checkin OK (vert), 1 sans checkin (violet/badgeage manquant)
            [
                'client' => $atelier, 'mission' => $missions['atelier'], 'prestation' => $prestations['atelier_0'],
                'employee' => $adeline, 'start' => $today->copy()->subDays(7)->setTime(9, 0),
                'end' => $today->copy()->subDays(7)->setTime(11, 0),
                'status' => 'realisee', 'checkin' => true,
            ],
            [
                'client' => $boulangerie, 'mission' => $missions['boulangerie'], 'prestation' => $prestations['boulangerie_0'],
                'employee' => $adeline, 'start' => $today->copy()->subDays(6)->setTime(7, 0),
                'end' => $today->copy()->subDays(6)->setTime(8, 0),
                'status' => 'realisee', 'checkin' => true,
            ],
            [
                'client' => $cabinet, 'mission' => $missions['cabinet'], 'prestation' => $prestations['cabinet_0'],
                'employee' => $mehdi, 'start' => $today->copy()->subDays(5)->setTime(14, 0),
                'end' => $today->copy()->subDays(5)->setTime(15, 30),
                'status' => 'realisee', 'checkin' => true,
            ],
            [
                'client' => $atelier, 'mission' => $missions['atelier'], 'prestation' => $prestations['atelier_1'],
                'employee' => $adeline, 'start' => $today->copy()->subDays(4)->setTime(10, 0),
                'end' => $today->copy()->subDays(4)->setTime(11, 0),
                'status' => 'realisee', 'checkin' => true,
            ],
            [
                // RDV sans checkin (violet/badgeage manquant)
                'client' => $boulangerie, 'mission' => $missions['boulangerie'], 'prestation' => $prestations['boulangerie_0'],
                'employee' => $mehdi, 'start' => $today->copy()->subDays(3)->setTime(7, 0),
                'end' => $today->copy()->subDays(3)->setTime(8, 0),
                'status' => 'realisee', 'checkin' => false,
            ],
            // === 3 RDV CETTE SEMAINE (planifiée) ===
            // Adeline : 2 / Mehdi : 1
            [
                'client' => $atelier, 'mission' => $missions['atelier'], 'prestation' => $prestations['atelier_0'],
                'employee' => $adeline, 'start' => $today->copy()->addDays(1)->setTime(9, 0),
                'end' => $today->copy()->addDays(1)->setTime(11, 0),
                'status' => 'planifiee', 'checkin' => false,
            ],
            [
                'client' => $boulangerie, 'mission' => $missions['boulangerie'], 'prestation' => $prestations['boulangerie_0'],
                'employee' => $adeline, 'start' => $today->copy()->addDays(2)->setTime(7, 0),
                'end' => $today->copy()->addDays(2)->setTime(8, 0),
                'status' => 'planifiee', 'checkin' => false,
            ],
            [
                'client' => $cabinet, 'mission' => $missions['cabinet'], 'prestation' => $prestations['cabinet_0'],
                'employee' => $mehdi, 'start' => $today->copy()->addDays(3)->setTime(14, 0),
                'end' => $today->copy()->addDays(3)->setTime(15, 30),
                'status' => 'planifiee', 'checkin' => false,
            ],
            // === 2 RDV SEMAINE PROCHAINE ===
            [
                'client' => $atelier, 'mission' => $missions['atelier'], 'prestation' => $prestations['atelier_0'],
                'employee' => $adeline, 'start' => $today->copy()->addDays(8)->setTime(9, 0),
                'end' => $today->copy()->addDays(8)->setTime(11, 0),
                'status' => 'planifiee', 'checkin' => false,
            ],
            [
                'client' => $cabinet, 'mission' => $missions['cabinet'], 'prestation' => $prestations['cabinet_1'],
                'employee' => $mehdi, 'start' => $today->copy()->addDays(9)->setTime(10, 0),
                'end' => $today->copy()->addDays(9)->setTime(10, 30),
                'status' => 'planifiee', 'checkin' => false,
            ],
        ];

        foreach ($defs as $d) {
            // Idempotence : on cherche un RDV au même start, pour le même client+employee
            $existing = Intervention::where('client_id', $d['client']->id)
                ->where('employee_id', $d['employee']->id)
                ->where('start_datetime', $d['start']->format('Y-m-d H:i:s'))
                ->first();

            if ($existing) {
                continue;
            }

            $iv = Intervention::create([
                'client_id' => $d['client']->id,
                'mission_id' => $d['mission']->id,
                'client_prestation_id' => $d['prestation']->id,
                'employee_id' => $d['employee']->id,
                'is_recurring' => false,
                'status' => $d['status'],
                'is_group' => false,
                'start_datetime' => $d['start'],
                'end_datetime' => $d['end'],
                'bill_client' => true,
                'is_paid' => true,
            ]);

            // Checkin pour les RDV terminés effectivement badgés
            if ($d['checkin']) {
                Checkin::create([
                    'employee_id' => $d['employee']->id,
                    'intervention_id' => $iv->id,
                    'checkin_time' => $d['start'],
                    'checkout_time' => $d['end'],
                    'flag_no_gps' => true,
                ]);
            }
        }
    }

    // ===================================================================
    //  DEVIS
    // ===================================================================

    /**
     * @param  array<string,Client>  $clients
     */
    private function seedQuotes(array $clients, Entity $entity, User $owner): void
    {
        $today = Carbon::today();
        $quoteTypeId = $this->getOrCreateDefaultQuoteTypeId($entity);

        // === Devis 1 — Atelier — status sent — 3 items — ~2400€ TTC ===
        $this->upsertQuote(
            client: $clients['atelier'],
            entity: $entity,
            owner: $owner,
            quoteTypeId: $quoteTypeId,
            reference: $this->buildReference('QUO', 1),
            quoteDate: $today->copy()->subDays(2)->toDateString(),
            status: 'sent',
            items: [
                ['label' => 'Entretien hebdomadaire (forfait mois)', 'qty' => 4, 'unit_price' => 320.00],
                ['label' => 'Petites réparations couture', 'qty' => 2, 'unit_price' => 380.00],
                ['label' => 'Audit qualité', 'qty' => 1, 'unit_price' => 360.00],
            ],
            total: 4 * 320 + 2 * 380 + 360, // 1280 + 760 + 360 = 2400
        );

        // === Devis 2 — Boulangerie — accepted — 2 items — ~1800€ ===
        $this->upsertQuote(
            client: $clients['boulangerie'],
            entity: $entity,
            owner: $owner,
            quoteTypeId: $quoteTypeId,
            reference: $this->buildReference('QUO', 2),
            quoteDate: $today->copy()->subDays(10)->toDateString(),
            status: 'accepted',
            items: [
                ['label' => 'Nettoyage fournil quotidien (forfait mois)', 'qty' => 1, 'unit_price' => 1400.00],
                ['label' => 'Désinfection mensuelle approfondie', 'qty' => 1, 'unit_price' => 400.00],
            ],
            total: 1400 + 400,
        );

        // === Devis 3 — Cabinet — refused — 1 item ===
        $this->upsertQuote(
            client: $clients['cabinet'],
            entity: $entity,
            owner: $owner,
            quoteTypeId: $quoteTypeId,
            reference: $this->buildReference('QUO', 3),
            quoteDate: $today->copy()->subDays(15)->toDateString(),
            status: 'refused',
            items: [
                ['label' => 'Désinfection ponctuelle complète', 'qty' => 1, 'unit_price' => 850.00],
            ],
            total: 850.00,
        );
    }

    /**
     * Référence prévisible (et idempotente) pour les devis/factures de preprod.
     * On NE PASSE PAS par DocumentSequenceService pour éviter de polluer le
     * compteur réel (qui doit refléter les vrais documents émis).
     */
    private function buildReference(string $type, int $sequence): string
    {
        // Préfixe PRE pour marquer "preprod" et ne PAS collider avec les vraies refs.
        $yearMonth = date('Ym');
        return strtoupper($type).'-PRE-'.$yearMonth.'-'.str_pad((string) $sequence, 4, '0', STR_PAD_LEFT);
    }

    private function getOrCreateDefaultQuoteTypeId(Entity $entity): int
    {
        // On utilise updateOrCreate sur le label pour garantir une ligne idempotente.
        $row = DB::table('quote_types')->where('label', 'Standard preprod')->first();
        if ($row) {
            return (int) $row->id;
        }
        return (int) DB::table('quote_types')->insertGetId([
            'entity_id' => $entity->id,
            'label' => 'Standard preprod',
            'nature' => 'punctual',
            'status' => 'active',
        ]);
    }

    /**
     * @param  array<int,array{label:string,qty:float|int,unit_price:float}>  $items
     */
    private function upsertQuote(
        Client $client,
        Entity $entity,
        User $owner,
        int $quoteTypeId,
        string $reference,
        string $quoteDate,
        string $status,
        array $items,
        float $total,
    ): void {
        $quote = Quote::where('reference', $reference)->first();

        if (! $quote) {
            $quote = Quote::create([
                'reference' => $reference,
                'client_id' => $client->id,
                'quote_type_id' => $quoteTypeId,
                'entity_id' => $entity->id,
                'owner_user_id' => $owner->id,
                'nature' => 'punctual',
                'quote_date' => $quoteDate,
                'validity_date' => Carbon::parse($quoteDate)->addDays(30)->toDateString(),
                'billing_mode' => 'forfait',
                'status' => $status,
                'total' => $total,
                'pennylane_id' => '', // colonne NOT NULL sans default
            ]);
        }

        // Items idempotents : on supprime et re-crée si la quote est nouvelle.
        if ($quote->items()->count() === 0) {
            $order = 0;
            foreach ($items as $item) {
                QuoteItem::create([
                    'quote_id' => $quote->id,
                    'item_type' => 'forfait',
                    'label' => $item['label'],
                    'quantity' => $item['qty'],
                    'unit_price' => $item['unit_price'],
                    'total' => $item['qty'] * $item['unit_price'],
                    'order' => $order++,
                ]);
            }
        }
    }

    // ===================================================================
    //  FACTURES
    // ===================================================================

    /**
     * @param  array<string,Client>  $clients
     */
    private function seedInvoices(array $clients, Entity $entity): void
    {
        $today = Carbon::today();

        // === Facture 1 — Atelier — paid — mois dernier — ~1200€ ===
        $this->upsertInvoice(
            client: $clients['atelier'],
            entity: $entity,
            reference: $this->buildReference('INV', 1),
            invoiceDate: $today->copy()->subDays(30)->toDateString(),
            dueDate: $today->copy()->subDays(15)->toDateString(),
            status: 'sent',
            paymentStatus: 'paid',
            items: [
                ['label' => 'Entretien hebdomadaire — mois écoulé', 'qty' => 4, 'unit_price' => 240.00],
                ['label' => 'Petites réparations', 'qty' => 2, 'unit_price' => 120.00],
            ],
            total: 4 * 240 + 2 * 120, // 1200
        );

        // === Facture 2 — Boulangerie — sent (en attente paiement) — 2 sem. ~950€ ===
        $this->upsertInvoice(
            client: $clients['boulangerie'],
            entity: $entity,
            reference: $this->buildReference('INV', 2),
            invoiceDate: $today->copy()->subDays(14)->toDateString(),
            dueDate: $today->copy()->addDays(16)->toDateString(),
            status: 'sent',
            paymentStatus: 'unpaid',
            items: [
                ['label' => 'Nettoyage fournil quotidien — quinzaine', 'qty' => 1, 'unit_price' => 750.00],
                ['label' => 'Produits & consommables', 'qty' => 1, 'unit_price' => 200.00],
            ],
            total: 750 + 200, // 950
        );

        // === Facture 3 — Cabinet — overdue (45j) — ~600€ ===
        $this->upsertInvoice(
            client: $clients['cabinet'],
            entity: $entity,
            reference: $this->buildReference('INV', 3),
            invoiceDate: $today->copy()->subDays(45)->toDateString(),
            dueDate: $today->copy()->subDays(15)->toDateString(),
            status: 'sent',
            paymentStatus: 'unpaid', // marquer overdue est un calcul (due_date < now() + unpaid)
            items: [
                ['label' => 'Désinfection salles & accueil — forfait mensuel', 'qty' => 1, 'unit_price' => 600.00],
            ],
            total: 600.00,
        );
    }

    /**
     * @param  array<int,array{label:string,qty:float|int,unit_price:float}>  $items
     */
    private function upsertInvoice(
        Client $client,
        Entity $entity,
        string $reference,
        string $invoiceDate,
        string $dueDate,
        string $status,
        string $paymentStatus,
        array $items,
        float $total,
    ): void {
        $invoice = Invoice::where('reference', $reference)->first();

        if (! $invoice) {
            $invoice = Invoice::create([
                'reference' => $reference,
                'type' => 'client',
                'client_id' => $client->id,
                'entity_id' => $entity->id,
                'payment_mode' => 'transfer',
                'payment_status' => $paymentStatus,
                'send_mode' => 'email',
                'invoice_date' => $invoiceDate,
                'due_date' => $dueDate,
                'total' => $total,
                'needs_recalculation' => false,
                'status' => $status,
                'pennylane_id' => '', // colonne NOT NULL sans default
            ]);
        }

        if ($invoice->invoiceItems()->count() === 0) {
            foreach ($items as $item) {
                InvoiceItem::create([
                    'invoice_id' => $invoice->id,
                    'item_type' => 'forfait',
                    'label' => $item['label'],
                    'quantity' => $item['qty'],
                    'unit_price' => $item['unit_price'],
                    'total' => $item['qty'] * $item['unit_price'],
                ]);
            }
        }
    }

    // ===================================================================
    //  TICKETS / SIGNALEMENTS
    // ===================================================================

    /**
     * @param  array<string,Client>   $clients
     * @param  array<string,Employee> $intervenants
     */
    private function seedTickets(array $clients, array $intervenants, User $owner): void
    {
        // === Ticket 1 — créé par le CLIENT (Atelier) ===
        $clientPortalUser = $clients['atelier']->portalUser;

        $ticket1 = ClientRequest::where('client_id', $clients['atelier']->id)
            ->where('subject', 'Problème porte d\'accès')
            ->first();

        if (! $ticket1) {
            $ticket1 = ClientRequest::create([
                'client_id' => $clients['atelier']->id,
                'type' => 'problem_report',
                'subject' => 'Problème porte d\'accès',
                'body' => 'Bonjour, depuis ce matin la porte de derrière reste bloquée. L\'intervenant n\'arrive pas à entrer. Pouvez-vous nous aider rapidement ? Merci.',
                'status' => 'open',
                'priority' => 'high',
                'created_by_user_id' => $clientPortalUser?->id ?? $owner->id,
                'assigned_to' => $owner->id,
            ]);
        }

        // Messages du fil (idempotent : seulement si vide)
        if ($ticket1->messages()->count() === 0) {
            ClientRequestMessage::create([
                'client_request_id' => $ticket1->id,
                'sender_id' => $clientPortalUser?->id ?? $owner->id,
                'body' => 'Bonjour, la porte est toujours bloquée. Pouvez-vous prévoir le passage d\'un dépanneur ?',
            ]);
            ClientRequestMessage::create([
                'client_request_id' => $ticket1->id,
                'sender_id' => $owner->id,
                'body' => 'Bonjour, nous prenons en charge. Un intervenant passera demain matin avec un serrurier.',
            ]);
        }

        // === Ticket 2 — créé par l'INTERVENANT (Adeline) pour Boulangerie ===
        $adelineUser = $intervenants['adeline']->user;

        $ticket2 = ClientRequest::where('client_id', $clients['boulangerie']->id)
            ->where('subject', 'Matériel manquant')
            ->first();

        if (! $ticket2) {
            $ticket2 = ClientRequest::create([
                'client_id' => $clients['boulangerie']->id,
                'type' => 'problem_report',
                'subject' => 'Matériel manquant',
                'body' => 'Lors de l\'intervention de ce matin, j\'ai constaté qu\'il manquait du produit dégraissant. Merci de prévoir un réassort.',
                'status' => 'in_progress',
                'priority' => 'normal',
                'created_by_user_id' => $adelineUser?->id ?? $owner->id,
                'assigned_to' => $owner->id,
            ]);
        }

        if ($ticket2->messages()->count() === 0) {
            ClientRequestMessage::create([
                'client_request_id' => $ticket2->id,
                'sender_id' => $adelineUser?->id ?? $owner->id,
                'body' => 'Bonjour, il manque le dégraissant en cuisine. Pouvez-vous en commander pour la prochaine intervention ? Merci.',
            ]);
        }
    }

    // ===================================================================
    //  RÉCAP FINAL
    // ===================================================================

    private function printRecap(): void
    {
        $this->command->info('');
        $this->command->info('====================================================');
        $this->command->info('  Données preprod seedées :');
        $this->command->info('====================================================');
        $this->command->info('  3 clients (portail extranet) :');
        $this->command->info('    - atelier.textil@'.self::EMAIL_DOMAIN);
        $this->command->info('    - boulangerie.centre@'.self::EMAIL_DOMAIN);
        $this->command->info('    - cabinet.saint-roch@'.self::EMAIL_DOMAIN);
        $this->command->info('  2 intervenants (extranet + mobile) :');
        $this->command->info('    - adeline.muret@'.self::EMAIL_DOMAIN);
        $this->command->info('    - mehdi.lambert@'.self::EMAIL_DOMAIN);
        $this->command->info('  Mot de passe commun : '.self::PASSWORD);
        $this->command->info('----------------------------------------------------');
        $this->command->info('  3 missions, 10 interventions, 3 devis, 3 factures, 2 tickets');
        $this->command->info('====================================================');
    }
}
