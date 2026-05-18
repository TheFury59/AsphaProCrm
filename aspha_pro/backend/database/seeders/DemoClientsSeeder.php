<?php

namespace Database\Seeders;

use App\Models\Address;
use App\Models\Client;
use App\Models\ClientCompany;
use App\Models\ClientContact;
use App\Models\Entity;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Seeder de clients de DEMO autour de la métropole lilloise.
 *
 * 5 clients fictifs avec des adresses géocodées réelles, tous à moins de
 * 45 min en voiture les uns des autres (typiquement 5–25 km).
 *
 * Sert à tester :
 *   - Le système de trajets payés (45 min max)
 *   - La détection de conflits horaires
 *   - L'affichage map / planning avec plusieurs RDV consécutifs
 *
 * Idempotent : si un client avec le même `code` existe déjà, on saute.
 * Pour ré-importer : `php artisan db:seed --class=DemoClientsSeeder`.
 */
class DemoClientsSeeder extends Seeder
{
    public function run(): void
    {
        $entity = Entity::first();
        if (! $entity) {
            $this->command->error('Aucune entité trouvée — lance d\'abord CatalogSeeder');
            return;
        }

        $owner = User::whereHas('roles', fn ($q) => $q->whereIn('name', ['super_admin', 'admin']))->first();
        if (! $owner) {
            $this->command->error('Aucun admin trouvé — lance d\'abord DatabaseSeeder');
            return;
        }

        // 5 clients dans la métropole lilloise, distances calculées via
        // Haversine — tous < 12 km du centre Lille = < 25 min en voiture.
        $clients = [
            [
                'code' => 'CLI-LILLE1',
                'company_name' => 'Boulangerie Le Bon Pain',
                'legal_form' => 'SARL',
                'siret' => '40012345600015',
                'phone_mobile' => '0320111122',
                'primary_email' => 'contact@lebonpain-lille.fr',
                'address' => '12 rue Faidherbe',
                'postal_code' => '59000',
                'city' => 'Lille',
                'lat' => 50.6363,
                'lng' => 3.0633,
                'contact_name' => 'Pierre Dubois',
                'contact_phone' => '0612345678',
            ],
            [
                'code' => 'CLI-ROUBAIX',
                'company_name' => 'Atelier Couture Textil',
                'legal_form' => 'SAS',
                'siret' => '40023456700016',
                'phone_mobile' => '0320222233',
                'primary_email' => 'contact@textil-roubaix.fr',
                'address' => '45 Grande Rue',
                'postal_code' => '59100',
                'city' => 'Roubaix',
                'lat' => 50.6942,
                'lng' => 3.1746,
                'contact_name' => 'Marie Lefèvre',
                'contact_phone' => '0623456789',
            ],
            [
                'code' => 'CLI-TOURCO',
                'company_name' => 'Restaurant Le Beffroi',
                'legal_form' => 'EURL',
                'siret' => '40034567800017',
                'phone_mobile' => '0320333344',
                'primary_email' => 'contact@lebeffroi-tourcoing.fr',
                'address' => '8 place Roussel',
                'postal_code' => '59200',
                'city' => 'Tourcoing',
                'lat' => 50.7236,
                'lng' => 3.1611,
                'contact_name' => 'Jean Martin',
                'contact_phone' => '0634567890',
            ],
            [
                'code' => 'CLI-VLA',
                'company_name' => 'TechHub Innovations',
                'legal_form' => 'SAS',
                'siret' => '40045678900018',
                'phone_mobile' => '0320444455',
                'primary_email' => 'contact@techhub-vla.fr',
                'address' => '22 rue du Recueil',
                'postal_code' => '59650',
                'city' => 'Villeneuve-d\'Ascq',
                'lat' => 50.6196,
                'lng' => 3.1452,
                'contact_name' => 'Sophie Bernard',
                'contact_phone' => '0645678901',
            ],
            [
                'code' => 'CLI-MADEL',
                'company_name' => 'Pharmacie de la Madeleine',
                'legal_form' => 'SARL',
                'siret' => '40056789000019',
                'phone_mobile' => '0320555566',
                'primary_email' => 'contact@pharma-madeleine.fr',
                'address' => '17 rue du Général de Gaulle',
                'postal_code' => '59110',
                'city' => 'La Madeleine',
                'lat' => 50.6553,
                'lng' => 3.0735,
                'contact_name' => 'Luc Petit',
                'contact_phone' => '0656789012',
            ],
        ];

        $created = 0;
        $skipped = 0;

        foreach ($clients as $c) {
            if (Client::where('code', $c['code'])->exists()) {
                $skipped++;
                continue;
            }

            $client = Client::create([
                'code' => $c['code'],
                'status' => 'active',
                'entity_id' => $entity->id,
                'owner_user_id' => $owner->id,
            ]);

            ClientCompany::create([
                'client_id' => $client->id,
                'company_name' => $c['company_name'],
                'legal_form' => $c['legal_form'],
                'siret' => $c['siret'],
                'phone_mobile' => $c['phone_mobile'],
                'primary_email' => $c['primary_email'],
            ]);

            // Adresse polymorphique (owner_type='client' grâce à la morphMap)
            Address::create([
                'owner_type' => 'client',
                'owner_id' => $client->id,
                'type' => 'main',
                'address' => $c['address'],
                'postal_code' => $c['postal_code'],
                'city' => $c['city'],
                'latitude' => $c['lat'],
                'longitude' => $c['lng'],
            ]);

            // Contact principal : 1 ligne par type (téléphone + email)
            // La table client_contacts a un schema simple {client_id, type, value, is_primary}
            ClientContact::create([
                'client_id' => $client->id,
                'type' => 'phone',
                'value' => $c['contact_phone'],
                'is_primary' => true,
            ]);
            ClientContact::create([
                'client_id' => $client->id,
                'type' => 'email',
                'value' => $c['primary_email'],
                'is_primary' => false,
            ]);

            $created++;
            $this->command->info("  + {$c['code']} ({$c['company_name']}) — {$c['city']}");
        }

        $this->command->info('');
        $this->command->info("DemoClientsSeeder : {$created} créés, {$skipped} déjà existants");

        // Mini-table des distances entre clients (pour aider à tester)
        if ($created > 0) {
            $this->command->info('');
            $this->command->info('Distances approximatives (Haversine) :');
            $all = Client::with('addresses')->whereIn('code', array_column($clients, 'code'))->get();
            foreach ($all as $a) {
                foreach ($all as $b) {
                    if ($a->id >= $b->id) continue;
                    $addrA = $a->addresses->first();
                    $addrB = $b->addresses->first();
                    if (! $addrA || ! $addrB) continue;
                    $km = $this->haversine($addrA->latitude, $addrA->longitude, $addrB->latitude, $addrB->longitude);
                    $minEstimated = (int) round($km * 60 / 40);  // 40 km/h moyen
                    $this->command->info(sprintf(
                        "  %s ↔ %s : %.1f km (~%d min)",
                        $a->code, $b->code, $km, $minEstimated,
                    ));
                }
            }
        }
    }

    private function haversine(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $R = 6371;  // rayon terre km
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
        return $R * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}
