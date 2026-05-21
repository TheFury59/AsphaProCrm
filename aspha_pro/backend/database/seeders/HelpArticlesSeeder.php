<?php

namespace Database\Seeders;

use App\Models\HelpArticle;
use Illuminate\Database\Seeder;

class HelpArticlesSeeder extends Seeder
{
    public function run(): void
    {
        $articles = [
            [
                'slug' => 'planning-creer-rdv',
                'title' => 'Créer un RDV dans le planning',
                'summary' => 'Comment créer une intervention ponctuelle ou récurrente.',
                'category' => 'planning',
                'audience' => 'admin',
                'display_order' => 10,
                'body' => "# Créer un RDV\n\n## Ponctuel\n\n1. Clique-glisse sur le créneau souhaité, OU clic droit → \"Intervention ponctuelle\"\n2. Renseigne client + intervenant (optionnel)\n3. Valide → drag-drop possible ensuite pour ajuster\n\n## Récurrent\n\n1. Clic droit sur le planning → \"Intervention récurrente\"\n2. Choisis fréquence (hebdo / mensuel) et jours\n3. La série apparaît automatiquement aux dates concernées\n\nPour modifier UNE seule occurrence sans casser la série, drag-drop la date concernée : ça crée automatiquement une **exception** liée à la série.",
            ],
            [
                'slug' => 'planning-trajets',
                'title' => 'Trajets entre RDV et règle 45 min',
                'category' => 'planning',
                'audience' => 'admin',
                'display_order' => 20,
                'body' => "# Trajets entre RDV\n\nEntre deux RDV consécutifs d'un même intervenant, le système calcule automatiquement :\n- Distance via Google Maps Distance Matrix (si configurée) ou Haversine\n- Temps de trajet\n- Si le trajet est **payé** ou non\n\n## Règle 45 minutes\n\n- Si le **gap** (fin RDV N → début RDV N+1) est ≤ **45 minutes** → trajet **payé** à l'intervenant\n- Si > 45 minutes → trajet **non payé** (pause prolongée)\n\nLe seuil est paramétrable dans **Paramètres → Trajets**.",
            ],
            [
                'slug' => 'badgeage-qr',
                'title' => 'Badgeage par QR code',
                'category' => 'telegestion',
                'audience' => 'all',
                'display_order' => 10,
                'body' => "# Badgeage par QR code\n\n## Côté admin\n\nGénérer un QR pour chaque adresse client depuis **Télégestion → QR Codes**. Le QR est ensuite imprimé et apposé chez le client.\n\n## Côté intervenant\n\nÀ l'arrivée sur place :\n1. Ouvre l'app mobile Aspha\n2. Scanne le QR\n3. Le badgeage **entrée** est enregistré, avec horodatage GPS optionnel\n\nÀ la sortie : re-scanner le QR pour valider le badgeage **sortie**.\n\nEn cas d'oubli, l'admin peut faire une **saisie manuelle** depuis Télégestion → Saisie manuelle (avec motif).",
            ],
            [
                'slug' => 'factures-facturx',
                'title' => 'Factures Factur-X et envoi Pennylane',
                'category' => 'facturation',
                'audience' => 'admin',
                'display_order' => 10,
                'body' => "# Factures Factur-X\n\nDepuis le 1er septembre 2026, toutes les factures B2B doivent être au format **Factur-X PDF/A-3** (norme EN 16931).\n\nL'ERP génère ce format automatiquement :\n1. Crée la facture standard depuis le module Factures\n2. Clique sur le bouton **PDF Factur-X** → téléchargement automatique\n3. Le PDF visible contient aussi les données XML CII embarquées\n\n## Sync Pennylane\n\nClic sur l'icône cloud → push automatique vers Pennylane. La facture y apparaît avec son `pennylane_id`.\n\nMode mock si la clé API n'est pas configurée (utile en dev).",
            ],
            [
                'slug' => 'mon-planning-intervenant',
                'title' => 'Consulter mon planning',
                'category' => 'intervenant',
                'audience' => 'intervenant',
                'display_order' => 10,
                'body' => "# Mon planning\n\nDepuis l'**Extranet intervenant → Mon planning**, tu vois tes RDV de la semaine en vue calendrier.\n\nVues disponibles : Jour / Semaine / Liste.\n\nLes RDV sont :\n- **Bleus** : planifiés\n- **Verts** : terminés\n- **Rouges** : annulés\n\nLecture seule : pour modifier un RDV, contacte ton admin.",
            ],
            [
                'slug' => 'mes-factures-client',
                'title' => 'Télécharger mes factures',
                'category' => 'client',
                'audience' => 'client',
                'display_order' => 10,
                'body' => "# Mes factures\n\nDepuis ton extranet, onglet **Factures**, tu retrouves toutes tes factures émises par Aspha.\n\nClique sur **PDF** pour télécharger la facture au format Factur-X PDF/A-3 (compatible avec ton expert-comptable).\n\nStatuts :\n- **Paid** : réglée\n- **Partial** : règlement partiel reçu\n- **Unpaid** : en attente de règlement",
            ],
        ];
        foreach ($articles as $a) {
            HelpArticle::updateOrCreate(['slug' => $a['slug']], $a + ['published' => true]);
        }
    }
}
