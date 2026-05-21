<?php

namespace Database\Seeders;

use App\Models\AppSetting;
use Illuminate\Database\Seeder;

class AppSettingsSeeder extends Seeder
{
    public function run(): void
    {
        $settings = [
            // Planning
            [
                'key' => 'long_absence_threshold_days',
                'category' => 'planning',
                'label' => 'Seuil "absence longue durée"',
                'description' => 'Une absence ≥ ce nombre de jours s\'affiche dans le bandeau sticky du planning.',
                'value' => ['value' => 5],
                'value_type' => 'integer',
            ],
            [
                'key' => 'badge_late_threshold_minutes',
                'category' => 'planning',
                'label' => 'Marge retard badgeage (min)',
                'description' => 'Au-delà, le badgeage s\'affiche en orange (retard).',
                'value' => ['value' => 5],
                'value_type' => 'integer',
            ],

            // Trajets
            [
                'key' => 'paid_travel_max_minutes',
                'category' => 'travel',
                'label' => 'Trajet payé max (min)',
                'description' => 'Entre 2 RDV : si gap ≤ ce nombre de minutes, le trajet est payé à l\'intervenant. Sinon non payé (pause prolongée).',
                'value' => ['value' => 45],
                'value_type' => 'integer',
            ],

            // Stock
            [
                'key' => 'stock_alert_default_threshold',
                'category' => 'stock',
                'label' => 'Seuil d\'alerte stock par défaut',
                'description' => 'Valeur initiale pour les nouveaux produits stock.',
                'value' => ['value' => 10],
                'value_type' => 'integer',
            ],

            // Intégrations
            [
                'key' => 'silae_portal_url',
                'category' => 'integrations',
                'label' => 'URL du portail Silae',
                'description' => 'Lien ouvert depuis l\'ERP pour la gestion des fiches de paie.',
                'value' => ['value' => 'https://app.silae.fr'],
                'value_type' => 'string',
            ],
            [
                'key' => 'silae_api_enabled',
                'category' => 'integrations',
                'label' => 'API Silae activée',
                'description' => 'Active la synchronisation automatique des heures vers Silae (nécessite clé API).',
                'value' => ['value' => false],
                'value_type' => 'boolean',
            ],
            [
                'key' => 'google_maps_api_key',
                'category' => 'integrations',
                'label' => 'Clé Google Maps Distance Matrix',
                'description' => 'Pour calculer les temps de trajet réels entre 2 RDV. Laisse vide pour fallback Haversine.',
                'value' => null,
                'value_type' => 'string',
                'is_secret' => true,
            ],
        ];

        foreach ($settings as $s) {
            AppSetting::updateOrCreate(['key' => $s['key']], $s);
        }
    }
}
