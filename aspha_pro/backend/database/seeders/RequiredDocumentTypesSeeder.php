<?php

namespace Database\Seeders;

use App\Models\RequiredDocumentType;
use Illuminate\Database\Seeder;

class RequiredDocumentTypesSeeder extends Seeder
{
    public function run(): void
    {
        $defaults = [
            ['label' => 'Carte d\'identité (recto + verso)', 'category_match' => 'cni', 'applies_to' => 'all', 'is_mandatory' => true, 'display_order' => 10],
            ['label' => 'RIB', 'category_match' => 'rib', 'applies_to' => 'all', 'is_mandatory' => true, 'display_order' => 20],
            ['label' => 'Carte vitale', 'category_match' => 'carte_vitale', 'applies_to' => 'all', 'is_mandatory' => true, 'display_order' => 30],
            ['label' => 'Justificatif de domicile', 'category_match' => 'justificatif_domicile', 'applies_to' => 'all', 'is_mandatory' => true, 'display_order' => 40],
            ['label' => 'Permis de conduire', 'category_match' => 'permis', 'applies_to' => 'all', 'is_mandatory' => false, 'display_order' => 50],
            ['label' => 'Contrat de travail signé', 'category_match' => 'contrat', 'applies_to' => 'all', 'is_mandatory' => true, 'display_order' => 60],
            ['label' => 'Mutuelle - attestation', 'category_match' => 'mutuelle', 'applies_to' => 'all', 'is_mandatory' => false, 'display_order' => 70],
            ['label' => 'DPAE (Déclaration Préalable à l\'Embauche)', 'category_match' => 'dpae', 'applies_to' => 'all', 'is_mandatory' => true, 'display_order' => 80],
            ['label' => 'Diplôme métier', 'category_match' => 'diplome', 'applies_to' => 'all', 'is_mandatory' => false, 'display_order' => 90],
        ];
        foreach ($defaults as $d) {
            RequiredDocumentType::updateOrCreate(['label' => $d['label']], $d);
        }
    }
}
