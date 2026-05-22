<?php

namespace Database\Seeders;

use App\Models\AbsenceReason;
use App\Models\ClientAbsenceReason;
use App\Models\ClientEventType;
use App\Models\EmployeeEventType;
use App\Models\Entity;
use App\Models\JobReference;
use App\Models\KmIndemnityRate;
use App\Models\NotificationType;
use App\Models\ProductCategory;
use App\Models\Skill;
use App\Models\StockCategory;
use App\Models\SurchargeRule;
use App\Models\VatRate;
use Illuminate\Database\Seeder;

/**
 * Seeders de données catalogue de base (référentiels).
 *
 * Ces données sont la fondation : sans elles, impossible de créer
 * un client, un employé, un produit ou une intervention.
 */
class CatalogSeeder extends Seeder
{
    public function run(): void
    {
        // === Entité de démo Aspha ===
        $entity = Entity::firstOrCreate(
            ['siret' => '00000000000000'],
            [
                'name' => 'Aspha Service — Siège',
                'phone' => '01 23 45 67 89',
                'email' => 'contact@aspha.fr',
                'status' => 'active',
                'modulation_enabled' => false,
                'annualisation_enabled' => false,
                'latitude' => 48.8566,
                'longitude' => 2.3522,
            ]
        );

        // === Taux de TVA ===
        // Décision cliente 2026-05-22 : seul le taux 20 % est proposé. Les
        // autres taux restent créés (pour la rétro-compat des devis/factures
        // historiques) mais en `status = inactive` → ils n'apparaissent plus
        // dans les sélecteurs (`/referentials/vat-rates` ne renvoie que les
        // taux `active`).
        foreach ([
            ['label' => 'TVA 20%', 'rate' => 20.00, 'status' => 'active'],
            ['label' => 'TVA 10%', 'rate' => 10.00, 'status' => 'inactive'],
            ['label' => 'TVA 5.5%', 'rate' => 5.50, 'status' => 'inactive'],
            ['label' => 'TVA 0% (exonéré)', 'rate' => 0.00, 'status' => 'inactive'],
        ] as $vat) {
            VatRate::firstOrCreate(
                ['label' => $vat['label']],
                ['rate' => $vat['rate'], 'status' => $vat['status']]
            );
        }

        // === Catégories produits ===
        foreach (['Ménage', 'Aide à la personne', 'Garde', 'Jardinage', 'Bricolage', 'Autres'] as $cat) {
            ProductCategory::firstOrCreate(['label' => $cat], ['status' => 'active']);
        }

        // === Raisons d'absence client ===
        foreach ([
            ['label' => 'Hospitalisation', 'allow_indefinite_duration' => true],
            ['label' => 'Congé', 'allow_indefinite_duration' => false],
            ['label' => 'Absent du domicile', 'allow_indefinite_duration' => false],
            ['label' => 'Autre', 'allow_indefinite_duration' => true],
        ] as $reason) {
            ClientAbsenceReason::firstOrCreate(
                ['label' => $reason['label']],
                [
                    'status' => 'active',
                    'allow_indefinite_duration' => $reason['allow_indefinite_duration'],
                ]
            );
        }

        // === Raisons d'absence intervenant ===
        foreach ([
            ['code' => 'CP', 'label' => 'Congés payés', 'acronym' => 'CP', 'is_paid' => true, 'color' => '#10b981'],
            ['code' => 'CSS', 'label' => 'Congés sans solde', 'acronym' => 'CSS', 'is_paid' => false, 'color' => '#94a3b8'],
            ['code' => 'AM', 'label' => 'Arrêt maladie', 'acronym' => 'AM', 'is_paid' => true, 'color' => '#f59e0b'],
            ['code' => 'AT', 'label' => 'Accident du travail', 'acronym' => 'AT', 'is_paid' => true, 'color' => '#ef4444'],
            ['code' => 'MAT', 'label' => 'Congé maternité', 'acronym' => 'MAT', 'is_paid' => true, 'color' => '#a855f7'],
            ['code' => 'PAT', 'label' => 'Congé paternité', 'acronym' => 'PAT', 'is_paid' => true, 'color' => '#8b5cf6'],
            ['code' => 'AE', 'label' => 'Absence exceptionnelle', 'acronym' => 'AE', 'is_paid' => false, 'color' => '#6b7280'],
            ['code' => 'FO', 'label' => 'Formation', 'acronym' => 'FO', 'is_paid' => true, 'color' => '#3b82f6'],
        ] as $reason) {
            AbsenceReason::firstOrCreate(
                ['code' => $reason['code']],
                $reason + ['is_secondary' => false, 'status' => 'active']
            );
        }

        // === Compétences (placeholder — liste à enrichir par Pauline) ===
        foreach ([
            'Ménage général', 'Repassage', 'Vitres', 'Cuisine',
            'Aide aux courses', 'Aide à la mobilité', 'Aide repas',
            'Garde enfants', 'Garde animaux', 'Jardinage léger',
            'Petit bricolage', 'Compagnie & lecture',
        ] as $skill) {
            Skill::firstOrCreate(['label' => $skill], ['status' => 'active']);
        }

        // === Emplois repères ===
        foreach ([
            ['label' => 'Auxiliaire de vie sociale', 'classification' => 'non_cadre', 'level' => 1],
            ['label' => 'Assistant(e) de vie aux familles', 'classification' => 'non_cadre', 'level' => 2],
            ['label' => 'Employé(e) à domicile', 'classification' => 'non_cadre', 'level' => 1],
            ['label' => 'Aide ménagère', 'classification' => 'non_cadre', 'level' => 1],
            ['label' => 'Responsable de secteur', 'classification' => 'cadre', 'level' => 5],
        ] as $job) {
            JobReference::firstOrCreate(
                ['label' => $job['label']],
                $job + ['status' => 'active']
            );
        }

        // === Barèmes km (35 cts par défaut, configurables) ===
        foreach ([
            ['transport_mode' => 'car', 'label' => 'Barème voiture 0.35€/km', 'rate_per_km' => 0.35],
            ['transport_mode' => 'moto', 'label' => 'Barème moto 0.20€/km', 'rate_per_km' => 0.20],
            ['transport_mode' => 'bike', 'label' => 'Barème vélo 0.10€/km', 'rate_per_km' => 0.10],
        ] as $rate) {
            KmIndemnityRate::firstOrCreate(
                ['transport_mode' => $rate['transport_mode'], 'entity_id' => null],
                $rate + ['status' => 'active']
            );
        }

        // === Règles de majoration ===
        foreach ([
            ['label' => 'Majoration nuit (21h-6h)', 'type' => 'night', 'rate' => 25.00, 'rate_type' => 'percentage', 'applies_from' => '21:00:00', 'applies_to' => '06:00:00'],
            ['label' => 'Majoration dimanche', 'type' => 'weekend', 'rate' => 50.00, 'rate_type' => 'percentage', 'applies_from' => null, 'applies_to' => null],
            ['label' => 'Majoration jour férié', 'type' => 'holiday', 'rate' => 100.00, 'rate_type' => 'percentage', 'applies_from' => null, 'applies_to' => null],
        ] as $rule) {
            SurchargeRule::firstOrCreate(
                ['label' => $rule['label']],
                $rule + ['status' => 'active']
            );
        }

        // === Types d'événements client ===
        foreach ([
            ['label' => 'Rendez-vous évaluation', 'planning_color' => '#3b82f6'],
            ['label' => 'Visite de courtoisie', 'planning_color' => '#10b981'],
            ['label' => 'Réunion famille', 'planning_color' => '#f59e0b'],
            ['label' => 'Audit qualité', 'planning_color' => '#a855f7'],
        ] as $et) {
            ClientEventType::firstOrCreate(['label' => $et['label']], $et + ['status' => 'active']);
        }

        // === Types d'événements intervenant ===
        foreach ([
            ['label' => 'Entretien individuel', 'base_type' => 'event', 'is_payable' => true, 'planning_color' => '#3b82f6'],
            ['label' => 'Réunion d\'équipe', 'base_type' => 'event', 'is_payable' => true, 'planning_color' => '#8b5cf6'],
            ['label' => 'Formation', 'base_type' => 'training', 'is_payable' => true, 'planning_color' => '#10b981'],
            ['label' => 'Repos hebdomadaire', 'base_type' => 'rest', 'is_payable' => false, 'planning_color' => '#94a3b8'],
        ] as $et) {
            EmployeeEventType::firstOrCreate(
                ['label' => $et['label']],
                $et + [
                    'status' => 'active',
                    'impacts_modulation' => false,
                    'exported_to_payroll' => false,
                    'export_position' => 0,
                ]
            );
        }

        // === Catégories de stock ===
        foreach ([
            'Produits ménagers',
            'EPI (équipements de protection)',
            'Consommables',
            'Petit matériel',
        ] as $cat) {
            StockCategory::firstOrCreate(['label' => $cat], ['status' => 'active']);
        }

        // === Types de notification ===
        foreach ([
            ['code' => 'intervention_assigned', 'label' => 'Intervention assignée', 'module' => 'planning'],
            ['code' => 'intervention_cancelled', 'label' => 'Intervention annulée', 'module' => 'planning'],
            ['code' => 'absence_created', 'label' => 'Absence créée', 'module' => 'rh'],
            ['code' => 'stock_alert', 'label' => 'Alerte stock', 'module' => 'stock'],
            ['code' => 'client_request', 'label' => 'Nouvelle demande client', 'module' => 'portal'],
            ['code' => 'signature_pending', 'label' => 'Signature en attente', 'module' => 'portal'],
        ] as $nt) {
            NotificationType::firstOrCreate(
                ['code' => $nt['code']],
                $nt + ['default_channels' => 'push,email', 'status' => 'active']
            );
        }

        $this->command->info('Catalog seeded:');
        $this->command->info('  - 1 entité de démo (Aspha Service Siège)');
        $this->command->info('  - 4 taux TVA · 6 catégories produits · 4 raisons absence client · 8 raisons absence intervenant');
        $this->command->info('  - 12 compétences · 5 emplois repères · 3 barèmes km · 3 règles majoration');
        $this->command->info('  - 4 types événement client · 4 types événement intervenant · 4 catégories stock · 6 types notification');
    }
}
