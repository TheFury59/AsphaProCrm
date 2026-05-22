<?php

namespace App\Services;

use App\Jobs\SendEmailNotificationJob;
use App\Jobs\SendPushNotificationJob;
use App\Models\Notification;
use App\Models\NotificationPreference;
use App\Models\NotificationType;
use Illuminate\Support\Facades\Log;

/**
 * Point d'entrée unique pour déclencher une notification.
 *
 * Workflow :
 *   1. Récupère le NotificationType par code (ex: 'intervention_assigned')
 *   2. Pour chaque destinataire : crée la notification en BDD (canal in-app)
 *   3. Consulte les préférences user pour ce type
 *      - via_push → dispatch SendPushNotificationJob
 *      - via_email → dispatch SendEmailNotificationJob
 *   4. Si aucune préférence : utilise default_channels du type
 *
 * Canaux disponibles : `in-app` (toujours, via la BDD) + `push` (FCM, gratuit
 * illimité) + `email` (SMTP). Le canal SMS a été retiré : décision produit
 * du 2026-05-18 — uniquement notifs in-app/push/email.
 *
 * Les jobs sont en file (queue: notifications) pour ne pas bloquer la requête HTTP.
 * En dev (queue=sync) ils s'exécutent immédiatement.
 *
 * Usage :
 *   app(NotificationDispatcher::class)->dispatch(
 *     code: 'intervention_assigned',
 *     userIds: [12, 15],
 *     title: 'Nouvelle intervention',
 *     body: 'Demain 10h chez Dupont',
 *     target: $intervention,
 *     priority: 'high',  // optionnel — 'normal' (défaut) / 'high' / 'critical'
 *   );
 */
class NotificationDispatcher
{
    /**
     * @param  string  $priority  Priorité de la notif : 'normal' (défaut),
     *                             'high' ou 'critical'. Met en évidence
     *                             l'alerte côté cloche (bordure + bip).
     *                             Paramètre optionnel en fin de signature
     *                             pour ne pas casser les appels existants.
     */
    public function dispatch(
        string $code,
        array $userIds,
        string $title,
        ?string $body = null,
        $target = null,
        string $priority = 'normal',
    ): void {
        $type = NotificationType::where('code', $code)->where('status', 'active')->first();
        if (! $type) {
            Log::warning("NotificationDispatcher: type {$code} inconnu/inactif");
            return;
        }

        foreach (array_unique($userIds) as $userId) {
            // 1. Créer la notif in-app (toujours)
            // Utilise getMorphClass() pour respecter la morph map de
            // AppServiceProvider — retourne 'client_request' au lieu de
            // 'App\Models\ClientRequest', ce qui permet au frontend de mapper
            // facilement target_type → route (deep-link cloche → fiche).
            $targetType = $target
                ? (method_exists($target, 'getMorphClass') ? $target->getMorphClass() : $target::class)
                : null;

            $notification = Notification::create([
                'user_id' => $userId,
                'notification_type_id' => $type->id,
                'title' => $title,
                'body' => $body,
                'target_type' => $targetType,
                // ⚠️ Avant : `?? 0` — insérait 0 quand pas de target, mais la
                // colonne `target_id` est unsignedBigInteger NOT NULL → ça
                // créait un deep-link cassé pointant vers un id inexistant.
                // Fix : null si pas de target (la colonne est nullable depuis
                // la migration `2026_05_19_fix_notifications_target_nullable`).
                // Cf. audit 2026-05-19 (CRIT).
                'target_id' => $target?->id,
                'channel' => 'push',
                // Sécurise contre une valeur hors énum (fallback 'normal').
                'priority' => in_array($priority, ['normal', 'high', 'critical'], true)
                    ? $priority
                    : 'normal',
                'is_read' => false,
                'sent_at' => now(),
            ]);

            // 2. Déterminer les canaux à utiliser
            $pref = NotificationPreference::where('user_id', $userId)
                ->where('notification_type_id', $type->id)
                ->first();

            if ($pref && ! $pref->is_enabled) {
                continue;  // user a désactivé ce type
            }

            $channels = $pref
                ? array_filter([
                    $pref->via_push ? 'push' : null,
                    $pref->via_email ? 'email' : null,
                ])
                : array_filter(
                    array_map('trim', explode(',', $type->default_channels ?? 'push')),
                    // Filtre defensif : si un seeder/migration legacy contient
                    // encore 'sms', on l'ignore (le job n'existe plus).
                    fn ($c) => in_array($c, ['push', 'email'], true),
                );

            // 3. Dispatch jobs par canal
            foreach ($channels as $channel) {
                match ($channel) {
                    'push' => SendPushNotificationJob::dispatch($notification->id),
                    'email' => SendEmailNotificationJob::dispatch($notification->id),
                    default => null,
                };
            }
        }
    }
}
