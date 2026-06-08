<?php

namespace Database\Seeders;

use App\Models\NotificationType;
use Illuminate\Database\Seeder;

/**
 * Référentiel des types de notifications applicatives.
 * Catalogue minimal pour le MVP — à enrichir au fil des modules.
 */
class NotificationTypesSeeder extends Seeder
{
    public function run(): void
    {
        $types = [
            // Planning
            ['code' => 'intervention_assigned', 'label' => 'Intervention assignée', 'module' => 'planning', 'default_channels' => 'push,email'],
            ['code' => 'intervention_modified', 'label' => 'Intervention modifiée', 'module' => 'planning', 'default_channels' => 'push'],
            ['code' => 'intervention_cancelled', 'label' => 'Intervention annulée', 'module' => 'planning', 'default_channels' => 'push,email'],
            ['code' => 'replacement_requested', 'label' => 'Remplacement demandé', 'module' => 'planning', 'default_channels' => 'push,email'],
            // RDV à pourvoir : intervention sans intervenant assigné (status=a_pourvoir).
            // Notifie les admins pour qu'ils sélectionnent un intervenant.
            ['code' => 'intervention_unassigned', 'label' => 'RDV à pourvoir', 'module' => 'planning', 'default_channels' => 'push,email'],

            // RH
            ['code' => 'absence_created', 'label' => 'Absence enregistrée', 'module' => 'rh', 'default_channels' => 'push'],
            ['code' => 'training_due', 'label' => 'Formation à renouveler', 'module' => 'rh', 'default_channels' => 'email'],

            // Documents — renouvellement : document dont la date de fin de
            // validité (`expiry_date`) approche ou est dépassée. Émise par
            // la commande `app:notify-document-renewals` (quotidienne).
            ['code' => 'document_renewal', 'label' => 'Document à renouveler', 'module' => 'documents', 'default_channels' => 'push,email'],

            // Stock
            ['code' => 'stock_alert', 'label' => 'Stock sous le seuil', 'module' => 'stock', 'default_channels' => 'push,email'],

            // Portail
            ['code' => 'client_request_new', 'label' => 'Nouvelle réclamation client', 'module' => 'portal', 'default_channels' => 'push,email'],
            ['code' => 'client_reorder_new', 'label' => 'Nouveau réassort client', 'module' => 'portal', 'default_channels' => 'push'],
            // 'signature_requested' retire le 2026-05-18 (Pennylane gere les signatures).

            // Télégestion
            // checkin_late : alerte CRITIQUE — RDV non pointé 30 min après le
            // début (cf. NotifyOverdueCheckins). Canaux in-app + email.
            ['code' => 'checkin_late', 'label' => 'RDV non pointé', 'module' => 'telemanagement', 'default_channels' => 'push,email'],
            ['code' => 'checkin_missed', 'label' => 'Badgeage manqué', 'module' => 'telemanagement', 'default_channels' => 'push,email'],
            // Rappels intervenant (cf. NotifyCheckinReminders) — chaîne pour chaque RDV :
            // arrival_due = à l'heure du début, arrival_late = +5 min,
            // departure_due = -5 min avant la fin, departure_late = à l'heure de fin.
            ['code' => 'checkin_arrival_due', 'label' => 'Pense à badger ton arrivée', 'module' => 'telemanagement', 'default_channels' => 'push'],
            ['code' => 'checkin_arrival_late', 'label' => 'Arrivée non badgée', 'module' => 'telemanagement', 'default_channels' => 'push'],
            ['code' => 'checkin_departure_due', 'label' => 'Pense à badger ton départ', 'module' => 'telemanagement', 'default_channels' => 'push'],
            ['code' => 'checkin_departure_late', 'label' => 'Départ non badgé', 'module' => 'telemanagement', 'default_channels' => 'push'],
            // Récap des heures travaillées (hebdo le lundi, mensuel le 1er) envoyé
            // à chaque intervenant (cf. NotifyWorkedHours). Canaux in-app + email.
            ['code' => 'worked_hours_summary', 'label' => 'Récap heures travaillées', 'module' => 'telemanagement', 'default_channels' => 'push,email'],

            // Missions / contrats
            ['code' => 'mission_created', 'label' => 'Nouvelle mission', 'module' => 'missions', 'default_channels' => 'push'],

            // Ventes
            ['code' => 'invoice_paid', 'label' => 'Facture réglée', 'module' => 'sales', 'default_channels' => 'push'],
            ['code' => 'invoice_overdue', 'label' => 'Facture en retard', 'module' => 'sales', 'default_channels' => 'email'],
            ['code' => 'invoice_issued', 'label' => 'Nouvelle facture', 'module' => 'sales', 'default_channels' => 'push,email'],
            ['code' => 'quote_sent', 'label' => 'Devis à valider', 'module' => 'sales', 'default_channels' => 'push,email'],
            // Devis validé par le client → notifie les admins (workflow 2026-05-21)
            ['code' => 'quote_accepted', 'label' => 'Devis validé', 'module' => 'sales', 'default_channels' => 'push,email'],

            // Tickets
            ['code' => 'client_request_status', 'label' => 'Ticket mis à jour', 'module' => 'portal', 'default_channels' => 'push'],
            // Nouveau message dans le fil de discussion d'un ticket → notifie
            // tous les participants sauf l'auteur (workflow 2026-05-21).
            ['code' => 'client_request_message', 'label' => 'Nouveau message sur un ticket', 'module' => 'portal', 'default_channels' => 'push,email'],
            // Intervenant affecté à un ticket → on le prévient.
            ['code' => 'client_request_assigned', 'label' => 'Affecté à un ticket', 'module' => 'portal', 'default_channels' => 'push,email'],

            // Messagerie
            ['code' => 'new_message', 'label' => 'Nouveau message', 'module' => 'messaging', 'default_channels' => 'push'],

            // Matching
            ['code' => 'matching_proposal', 'label' => 'Proposition d\'affectation', 'module' => 'matching', 'default_channels' => 'push,email'],
        ];

        foreach ($types as $t) {
            NotificationType::updateOrCreate(
                ['code' => $t['code']],
                $t + ['status' => 'active'],
            );
        }
    }
}
