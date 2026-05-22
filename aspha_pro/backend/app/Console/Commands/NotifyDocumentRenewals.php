<?php

namespace App\Console\Commands;

use App\Models\Client;
use App\Models\Contract;
use App\Models\Document;
use App\Models\Employee;
use App\Models\Invoice;
use App\Models\Notification;
use App\Models\NotificationType;
use App\Models\Quote;
use App\Models\User;
use App\Services\NotificationDispatcher;
use Carbon\Carbon;
use Illuminate\Console\Command;

/**
 * Alerte de renouvellement des documents (chantier H, 2026-05-22).
 *
 * Parcourt les documents dont `expiry_date` est renseignée et tombe dans la
 * fenêtre d'alerte : [aujourd'hui − ∞, aujourd'hui + 30 jours]. Autrement dit
 * tout document qui expire dans les 30 prochains jours OU déjà expiré.
 *
 * Pour chaque document concerné, émet une notification `document_renewal`
 * via le NotificationDispatcher :
 *   - aux administrateurs (super_admin + admin) — ils pilotent le suivi ;
 *   - au destinataire de la fiche, si on peut le résoudre en utilisateur :
 *       owner `client`   → le portal_user du client (extranet client) ;
 *       owner `employee` → le user de l'intervenant (extranet intervenant).
 *     Les owners `contract`/`invoice`/`quote` sont remontés à leur entité
 *     parente pour résoudre le destinataire.
 *
 * ANTI-SPAM : on ne ré-émet PAS une alerte pour un document si une
 * notification `document_renewal` ciblant CE document a déjà été créée au
 * cours des `RESEND_AFTER_DAYS` derniers jours. La commande tourne tous les
 * jours mais ne « rappelle » donc qu'à intervalle espacé (par défaut 7j).
 * Le filtre se fait sur (target_type='document', target_id=$doc->id) — le
 * deep-link de la cloche est par ailleurs ainsi correctement câblé.
 *
 * Planification : quotidienne (cf. routes/console.php). En production, le
 * scheduler nécessite un tick externe (cron `php artisan schedule:run`/min).
 */
class NotifyDocumentRenewals extends Command
{
    protected $signature = 'app:notify-document-renewals';

    protected $description = 'Alerte les destinataires et les admins des documents à renouveler (expiry_date proche/dépassée)';

    /** Fenêtre d'anticipation : un document est « à renouveler » à J−30. */
    private const WINDOW_DAYS = 30;

    /** Anti-spam : délai minimal entre deux rappels pour le même document. */
    private const RESEND_AFTER_DAYS = 7;

    public function handle(NotificationDispatcher $dispatcher): int
    {
        $today = Carbon::today();
        $limit = $today->copy()->addDays(self::WINDOW_DAYS);

        // Documents avec une date de fin de validité connue, dans la fenêtre
        // d'alerte (déjà expirés OU expirant sous 30 jours).
        $documents = Document::whereNotNull('expiry_date')
            ->whereDate('expiry_date', '<=', $limit)
            ->orderBy('expiry_date')
            ->get();

        if ($documents->isEmpty()) {
            $this->info('Aucun document à renouveler.');
            return self::SUCCESS;
        }

        // Type de notif requis — abandonne proprement s'il n'est pas seedé.
        $type = NotificationType::where('code', 'document_renewal')
            ->where('status', 'active')->first();
        if (! $type) {
            $this->warn("Type de notification 'document_renewal' absent — lancer le NotificationTypesSeeder.");
            return self::SUCCESS;
        }

        $adminIds = User::role(['super_admin', 'admin'])->pluck('id')->map('intval')->all();

        $sent = 0;
        $skipped = 0;

        foreach ($documents as $doc) {
            // ANTI-SPAM : déjà alerté récemment pour CE document ?
            $alreadyNotified = Notification::where('notification_type_id', $type->id)
                ->where('target_type', 'document')
                ->where('target_id', $doc->id)
                ->where('created_at', '>=', $today->copy()->subDays(self::RESEND_AFTER_DAYS))
                ->exists();
            if ($alreadyNotified) {
                $skipped++;
                continue;
            }

            // Destinataires : admins + (si résolu) l'utilisateur extranet lié.
            $recipientIds = $adminIds;
            $recipientUserId = $this->resolveRecipientUserId($doc);
            if ($recipientUserId) {
                $recipientIds[] = $recipientUserId;
            }
            $recipientIds = array_values(array_unique(array_filter($recipientIds)));
            if (empty($recipientIds)) {
                $skipped++;
                continue;
            }

            $expiry = Carbon::parse($doc->expiry_date);
            $isExpired = $expiry->isBefore($today);
            $when = $isExpired
                ? 'a expiré le ' . $expiry->format('d/m/Y')
                : 'expire le ' . $expiry->format('d/m/Y');

            $body = "Le document « {$doc->label} » {$when}. Pensez à le renouveler.";

            $dispatcher->dispatch(
                code: 'document_renewal',
                userIds: $recipientIds,
                title: $isExpired ? 'Document expiré' : 'Document à renouveler',
                body: $body,
                target: $doc,
                // Document expiré = alerte plus visible côté cloche.
                priority: $isExpired ? 'high' : 'normal',
            );

            $sent++;
        }

        $this->info("Renouvellements : {$sent} alerte(s) émise(s), {$skipped} ignorée(s) (anti-spam ou destinataire introuvable).");
        return self::SUCCESS;
    }

    /**
     * Résout l'utilisateur extranet destinataire du document à partir de son
     * owner. Retourne null si aucun utilisateur ne peut être rattaché (le
     * document sera alors notifié aux seuls admins).
     */
    private function resolveRecipientUserId(Document $doc): ?int
    {
        return match ($doc->owner_type) {
            'client' => Client::find($doc->owner_id)?->portal_user_id,
            'employee' => Employee::find($doc->owner_id)?->user_id,
            'contract' => Employee::find(Contract::find($doc->owner_id)?->employee_id)?->user_id,
            'invoice' => Client::find(Invoice::find($doc->owner_id)?->client_id)?->portal_user_id,
            'quote' => Client::find(Quote::find($doc->owner_id)?->client_id)?->portal_user_id,
            default => null,
        };
    }
}
