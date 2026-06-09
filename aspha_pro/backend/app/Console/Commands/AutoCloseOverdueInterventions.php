<?php

namespace App\Console\Commands;

use App\Models\Intervention;
use Carbon\Carbon;
use Illuminate\Console\Command;

/**
 * Bascule automatiquement `status = realisee` les interventions ponctuelles
 * dont `end_datetime` est dépassé et qui étaient encore `planifiee`.
 *
 * Sans ce job, une intervention restait en bleu (planifiée) éternellement
 * après son heure de fin → le frontend ne pouvait pas distinguer un RDV
 * en cours d'un RDV terminé non badgé.
 *
 * Statuts cible après transition :
 *   - `realisee` (vert/violet selon présence du checkin côté affichage)
 *
 * Périmètre :
 *   - Interventions ponctuelles uniquement (`is_recurring = false`).
 *     Les patrons récurrents n'ont pas de `end_datetime` réel — leurs
 *     occurrences sont matérialisées comme interventions ponctuelles
 *     filles qui passent par cette logique.
 *   - On exclut les statuts non transitables : `annulee`, `refusee`,
 *     `realisee`, `draft`, `terminated`. On ne touche QUE `planifiee`.
 *   - On ne touche PAS `a_pourvoir` : c'est un problème admin (personne
 *     n'a été affecté à temps), pas une transition naturelle.
 *
 * Cohabite avec `NotifyOverdueCheckins` (+30 min admin alert) :
 *   - Si checkin présent au moment de la transition → status = realisee,
 *     affichage vert (badgé)
 *   - Si pas de checkin → status = realisee mais affichage violet
 *     ("badgeage manquant") + alerte critique admin déjà déclenchée.
 *
 * Planification : every five minutes (cf. routes/console.php).
 */
class AutoCloseOverdueInterventions extends Command
{
    protected $signature = 'app:auto-close-overdue-interventions';

    protected $description = 'Bascule les interventions dépassées (end_datetime passé) de planifiee vers realisee';

    public function handle(): int
    {
        $now = Carbon::now();

        $count = Intervention::query()
            ->where('status', 'planifiee')
            ->where('is_recurring', false)
            ->whereNotNull('end_datetime')
            ->where('end_datetime', '<', $now)
            ->update(['status' => 'realisee']);

        if ($count > 0) {
            $this->info("Auto-close : {$count} intervention(s) basculée(s) en realisee.");
        } else {
            $this->info('Auto-close : aucune intervention à fermer.');
        }

        return self::SUCCESS;
    }
}
