<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\VatRate;
use Illuminate\Database\Seeder;

/**
 * Catalogue de prestations Aspha Services — liste fournie par la cliente
 * (2026-05-20). Nettoyage professionnel B2B.
 *
 * Idempotent : `firstOrCreate` sur le `code`. Relançable sans doublon.
 *
 * NB sur les prix : le prix catalogue est à 0 par défaut. Dans le nettoyage
 * professionnel, le tarif se fixe au devis selon la surface, la fréquence
 * et les contraintes du site — il n'y a pas de prix catalogue fixe. Le champ
 * `price` sert de tarif de référence, à ajuster par l'admin via l'UI
 * Prestations si un tarif standard existe.
 */
class PrestationCatalogSeeder extends Seeder
{
    public function run(): void
    {
        // TVA 20% — taux standard pour le nettoyage professionnel B2B.
        $vat20 = VatRate::where('rate', 20)->where('status', 'active')->first()
            ?? VatRate::firstOrCreate(['label' => 'TVA 20%'], ['rate' => 20, 'status' => 'active']);

        // Catégories adaptées au nettoyage pro (en plus des catégories
        // "services à la personne" déjà seedées).
        $categories = [];
        foreach ([
            'Nettoyage de locaux',
            'Nettoyage après chantier',
            'Vitrerie',
            'Nettoyage mécanisé',
            'Services annexes',
        ] as $label) {
            $categories[$label] = ProductCategory::firstOrCreate(
                ['label' => $label],
                ['status' => 'active'],
            )->id;
        }

        /*
         * Chaque prestation : [code, nom, catégorie, type, nature, billing_mode].
         *  - type     : 'hourly' (facturé à l'heure) | 'forfait' (prestation ponctuelle)
         *  - nature   : 'regular' (entretien récurrent) | 'punctual' (one-shot)
         *  - billing  : 'per_month' (contrat régulier) | 'per_intervention' (ponctuel)
         */
        $prestations = [
            // --- Nettoyage de locaux (entretien régulier) ---
            ['NET-BUREAUX',       'Nettoyage de bureaux',                'Nettoyage de locaux',     'hourly',  'regular',  'per_month'],
            ['NET-MEDICAL',       'Nettoyage de cabinets médicaux',      'Nettoyage de locaux',     'hourly',  'regular',  'per_month'],
            ['NET-COMMERCE',      'Nettoyage de commerces',              'Nettoyage de locaux',     'hourly',  'regular',  'per_month'],
            ['NET-COPRO',         'Nettoyage de copropriétés',           'Nettoyage de locaux',     'hourly',  'regular',  'per_month'],
            ['NET-PARTIES-COM',   'Entretien des parties communes',      'Nettoyage de locaux',     'hourly',  'regular',  'per_month'],
            ['NET-BIO',           'Bio-nettoyage',                       'Nettoyage de locaux',     'hourly',  'regular',  'per_month'],

            // --- Nettoyage après chantier (ponctuel) ---
            ['NET-APRES-TRAVAUX', 'Nettoyage après travaux',             'Nettoyage après chantier','forfait', 'punctual', 'per_intervention'],
            ['NET-FIN-CHANTIER',  'Nettoyage fin de chantier',           'Nettoyage après chantier','forfait', 'punctual', 'per_intervention'],
            ['NET-DEBARRAS',      'Débarras',                            'Nettoyage après chantier','forfait', 'punctual', 'per_intervention'],

            // --- Vitrerie ---
            ['VIT-GENERAL',       'Vitrerie',                            'Vitrerie',                'hourly',  'regular',  'per_month'],
            ['VIT-VITRINES',      'Nettoyage de vitrines commerciales',  'Vitrerie',                'hourly',  'regular',  'per_month'],
            ['VIT-ENSEIGNES',     'Nettoyage enseignes et panneaux vitrés','Vitrerie',              'forfait', 'punctual', 'per_intervention'],

            // --- Nettoyage mécanisé ---
            ['MEC-SHAMPOUINAGE',  'Shampouinage moquettes',              'Nettoyage mécanisé',      'forfait', 'punctual', 'per_intervention'],
            ['MEC-SOLS',          'Nettoyage mécanisé des sols',         'Nettoyage mécanisé',      'forfait', 'punctual', 'per_intervention'],
            ['MEC-MONOBROSSE',    'Monobrosse',                          'Nettoyage mécanisé',      'forfait', 'punctual', 'per_intervention'],
            ['MEC-AUTOLAVEUSE',   'Autolaveuse',                         'Nettoyage mécanisé',      'forfait', 'punctual', 'per_intervention'],

            // --- Services annexes ---
            ['SRV-POUBELLES',     'Sortie/entrée des poubelles',         'Services annexes',        'hourly',  'regular',  'per_week'],
            ['SRV-MAINTENANCE',   'Maintenance et petits travaux',       'Services annexes',        'forfait', 'punctual', 'per_intervention'],
            ['SRV-ESPACES-VERTS', 'Espaces verts et extérieurs',         'Services annexes',        'hourly',  'regular',  'per_month'],
        ];

        $created = 0;
        foreach ($prestations as [$code, $name, $category, $type, $nature, $billingMode]) {
            $product = Product::firstOrCreate(
                ['code' => $code],
                [
                    'status' => 'active',
                    'name' => $name,
                    'entity_id' => null, // global — disponible pour toutes les agences
                    'type' => $type,
                    'nature' => $nature,
                    'billing_mode' => $billingMode,
                    'category_id' => $categories[$category],
                    'price' => 0, // tarif fixé au devis (cf. note de classe)
                    'cost' => 0,
                    'vat_rate_id' => $vat20->id,
                    'amount_incl_tax' => false, // prix saisis en HT
                    'has_degressive_pricing' => false,
                    'specific_rates_forbidden' => false,
                ],
            );
            if ($product->wasRecentlyCreated) {
                $created++;
            }
        }

        $this->command->info("Catalogue prestations Aspha :");
        $this->command->info("  - " . count($categories) . " catégories de nettoyage");
        $this->command->info("  - {$created} prestation(s) créée(s) / " . count($prestations) . " au total");
    }
}
