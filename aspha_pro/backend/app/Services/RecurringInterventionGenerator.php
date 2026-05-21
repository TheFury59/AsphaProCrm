<?php

namespace App\Services;

use App\Models\ClientPrestation;
use App\Models\Intervention;

/**
 * Génère l'intervention « modèle » de récurrence rattachée à une prestation
 * contractualisée de nature `regular`.
 *
 * Contexte (refonte 2026-05-21) : quand une mission est créée/mise à jour avec
 * une prestation récurrente, on matérialise UNE intervention `is_recurring=true`
 * `status='a_pourvoir'` `employee_id=null`. L'`InterventionExpander` se charge
 * ensuite d'afficher les occurrences virtuelles sur le planning.
 *
 * Anti-doublon : si une intervention récurrente non-exception existe déjà pour
 * la même `client_prestation_id`, on la met à jour au lieu d'en recréer une.
 * Cela garantit l'idempotence quand la mission est éditée plusieurs fois.
 *
 * Pour les prestations `punctual` : aucune intervention n'est générée (l'admin
 * crée les RDV ponctuels manuellement depuis le planning).
 */
class RecurringInterventionGenerator
{
    /**
     * Synchronise l'intervention récurrente d'une prestation.
     *
     * - nature = 'regular' → crée/maj l'intervention récurrente modèle.
     * - nature = 'punctual' → no-op (rien à générer).
     *
     * @return Intervention|null L'intervention récurrente, ou null si ponctuelle.
     */
    public function syncForPrestation(ClientPrestation $prestation): ?Intervention
    {
        // Si la prestation n'est plus récurrente (passée à 'punctual' lors d'une
        // mise à jour) on supprime l'éventuelle intervention récurrente modèle
        // déjà générée — sinon une récurrence orpheline resterait au planning.
        if ($prestation->nature !== 'regular' || ! $prestation->recurrence_frequency) {
            $this->removeRecurrenceFor($prestation);
            return null;
        }

        $payload = $this->buildPayload($prestation);

        // Anti-doublon : on cherche une intervention récurrente déjà générée
        // pour cette prestation (modèle, pas exception).
        $existing = Intervention::where('client_prestation_id', $prestation->id)
            ->where('is_recurring', true)
            ->where('is_exception', false)
            ->first();

        $defaultEmployeeId = $prestation->default_employee_id;

        if ($existing) {
            // On met à jour les paramètres de récurrence.
            $existing->fill($payload);

            // Intervenant par défaut : si la prestation en porte un et que le
            // RDV est encore « à pourvoir » (jamais affecté à la main), on
            // applique cet intervenant. On ne touche JAMAIS un RDV déjà
            // « planifié » : une affectation manuelle de l'admin est prioritaire.
            if ($defaultEmployeeId && $existing->status === 'a_pourvoir') {
                $existing->employee_id = $defaultEmployeeId;
                $existing->status = 'planifiee';
            }
            $existing->save();

            return $existing;
        }

        // Création : si la prestation a un intervenant par défaut, le RDV
        // récurrent naît directement « planifié » et affecté ; sinon « à pourvoir ».
        return Intervention::create($payload + [
            'status' => $defaultEmployeeId ? 'planifiee' : 'a_pourvoir',
            'employee_id' => $defaultEmployeeId,
        ]);
    }

    /**
     * Supprime l'intervention récurrente modèle d'une prestation devenue
     * ponctuelle (soft delete — ne touche pas aux exceptions/occurrences réelles).
     */
    private function removeRecurrenceFor(ClientPrestation $prestation): void
    {
        Intervention::where('client_prestation_id', $prestation->id)
            ->where('is_recurring', true)
            ->where('is_exception', false)
            ->get()
            ->each->delete();
    }

    /**
     * Construit les champs de récurrence à partir de la prestation.
     */
    private function buildPayload(ClientPrestation $prestation): array
    {
        // Date de début de récurrence = date de début de la prestation,
        // fallback aujourd'hui si absente.
        $startDate = $prestation->start_date
            ? $prestation->start_date->toDateString()
            : now()->toDateString();

        $endType = $prestation->recurrence_end_type ?: 'never';

        // Si la prestation a une end_date et aucun end_type explicite "on_date",
        // on borne quand même la récurrence à end_date pour rester cohérent.
        $recurrenceEndDate = null;
        if ($endType === 'on_date') {
            $recurrenceEndDate = $prestation->end_date?->toDateString();
        }

        return [
            'client_id' => $prestation->client_id,
            'mission_id' => $prestation->mission_id,
            'client_prestation_id' => $prestation->id,
            'is_recurring' => true,
            'is_exception' => false,
            'recurrence_start_date' => $startDate,
            'start_time' => $this->normalizeTime($prestation->recurrence_start_time) ?? '09:00:00',
            'end_time' => $this->normalizeTime($prestation->recurrence_end_time) ?? '17:00:00',
            'frequency' => $prestation->recurrence_frequency,
            'interval' => max(1, (int) ($prestation->recurrence_interval ?? 1)),
            'days_of_week' => $prestation->recurrence_days_of_week,
            'end_type' => $endType,
            'recurrence_end_date' => $recurrenceEndDate,
            'occurrences_count' => $endType === 'after_occurrences'
                ? max(1, (int) ($prestation->recurrence_occurrences_count ?? 1))
                : null,
        ];
    }

    /**
     * Normalise un champ time vers le format H:i:s attendu par la colonne SQL.
     * Accepte "09:00", "09:00:00" ou un objet Carbon.
     */
    private function normalizeTime(mixed $time): ?string
    {
        if (! $time) {
            return null;
        }
        $str = (string) $time;
        // "09:00" → "09:00:00"
        if (preg_match('/^\d{2}:\d{2}$/', $str)) {
            return $str . ':00';
        }
        // Carbon casté en datetime → on extrait l'heure
        if (preg_match('/(\d{2}:\d{2}:\d{2})/', $str, $m)) {
            return $m[1];
        }

        return $str;
    }
}
