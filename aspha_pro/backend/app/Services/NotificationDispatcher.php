<?php

namespace App\Services;

use App\Jobs\SendEmailNotificationJob;
use App\Jobs\SendPushNotificationJob;
use App\Jobs\SendSmsNotificationJob;
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
 *      - via_sms → dispatch SendSmsNotificationJob
 *   4. Si aucune préférence : utilise default_channels du type
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
 *   );
 */
class NotificationDispatcher
{
    public function dispatch(
        string $code,
        array $userIds,
        string $title,
        ?string $body = null,
        $target = null,
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
                'target_id' => $target?->id ?? 0,
                'channel' => 'push',
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
                    $pref->via_sms ? 'sms' : null,
                ])
                : array_map('trim', explode(',', $type->default_channels ?? 'push'));

            // 3. Dispatch jobs par canal
            foreach ($channels as $channel) {
                match ($channel) {
                    'push' => SendPushNotificationJob::dispatch($notification->id),
                    'email' => SendEmailNotificationJob::dispatch($notification->id),
                    'sms' => SendSmsNotificationJob::dispatch($notification->id),
                    default => null,
                };
            }
        }
    }
}
