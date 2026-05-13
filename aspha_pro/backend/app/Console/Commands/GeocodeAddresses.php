<?php

namespace App\Console\Commands;

use App\Models\Address;
use App\Services\GeocodingService;
use Illuminate\Console\Command;

/**
 * Géocode en bulk toutes les adresses sans latitude/longitude.
 *
 * Utile en migration / one-shot : l'observer Address ne déclenche le géocodage
 * que sur création / update. Les adresses créées AVANT l'ajout de l'observer
 * restent sans coordonnées → cette commande les rattrape.
 *
 * Usage :
 *   php artisan geocode:addresses              → toutes les adresses sans lat/lng
 *   php artisan geocode:addresses --force      → re-géocode toutes (même celles déjà géocodées)
 *   php artisan geocode:addresses --limit=50   → limite pour ne pas saturer BAN
 */
class GeocodeAddresses extends Command
{
    protected $signature = 'geocode:addresses {--force : Re-géocode même les adresses déjà géocodées} {--limit=200 : Nombre max d\'adresses à traiter}';

    protected $description = 'Géocode en bulk les adresses dépourvues de lat/lng via BAN.gouv.fr';

    public function handle(GeocodingService $geocoding): int
    {
        $query = Address::query();

        if (! $this->option('force')) {
            $query->where(function ($q) {
                $q->whereNull('latitude')->orWhereNull('longitude');
            });
        }

        $total = $query->count();
        $limit = (int) $this->option('limit');

        if ($total === 0) {
            $this->info('✓ Toutes les adresses sont déjà géocodées.');
            return self::SUCCESS;
        }

        $this->info("Géocodage de {$total} adresses (limite : {$limit})…");

        $addresses = $query->limit($limit)->get();
        $progressBar = $this->output->createProgressBar($addresses->count());
        $progressBar->start();

        $stats = ['ok' => 0, 'failed' => 0, 'skipped' => 0];

        foreach ($addresses as $addr) {
            if (! $addr->address && ! $addr->city) {
                $stats['skipped']++;
                $progressBar->advance();
                continue;
            }

            try {
                $coords = $geocoding->geocode($addr->address, $addr->postal_code, $addr->city);
                if ($coords) {
                    // Update direct pour ne pas re-trigger l'observer (qui appellerait encore le service)
                    Address::where('id', $addr->id)->update([
                        'latitude' => $coords[0],
                        'longitude' => $coords[1],
                    ]);
                    $stats['ok']++;
                } else {
                    $stats['failed']++;
                }
            } catch (\Throwable $e) {
                $stats['failed']++;
            }

            // Throttle léger : BAN tolère jusqu'à 50 req/s mais soyons sympas
            usleep(50_000);  // 50ms = max 20 req/s
            $progressBar->advance();
        }

        $progressBar->finish();
        $this->newLine(2);

        $this->table(
            ['Statut', 'Nombre'],
            [
                ['✓ Géocodées avec succès', $stats['ok']],
                ['✗ Échec (adresse non trouvée)', $stats['failed']],
                ['— Ignorées (vides)', $stats['skipped']],
            ],
        );

        $remaining = $total - $addresses->count();
        if ($remaining > 0) {
            $this->warn("Il reste {$remaining} adresses à géocoder. Relance la commande pour continuer.");
        }

        return self::SUCCESS;
    }
}
