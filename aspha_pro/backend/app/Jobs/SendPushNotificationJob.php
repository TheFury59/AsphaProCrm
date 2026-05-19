<?php

namespace App\Jobs;

use App\Models\DeviceToken;
use App\Models\Notification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Envoi push via Firebase Cloud Messaging (FCM).
 *
 * audit 2026-05-19 — désactivation propre de la feature plutôt que de crasher :
 *   - Si FCM_SERVER_KEY vide → log INFO "skipped" et return (mode dev/staging).
 *   - Sinon → tentative d'envoi via HTTP v1 (TODO Firebase Admin SDK pour OAuth2),
 *     mais ne crashe jamais si endpoint en erreur. Le job ne retry que sur
 *     exception transport, pas sur 4xx/5xx du provider.
 *
 * Device token : lu depuis device_tokens (1ère ligne pour l'user). Si table
 * vide (cas par défaut au déploiement), log "no device token" et return.
 *
 * NB : l'ancien endpoint https://fcm.googleapis.com/fcm/send est DÉPRÉCIÉ
 * depuis juin 2024. La vraie migration nécessite Firebase Admin SDK pour
 * générer un access token OAuth2 + endpoint v1
 * (https://fcm.googleapis.com/v1/projects/{project-id}/messages:send).
 * Marqué TODO ci-dessous — pas critique tant que l'app mobile n'est pas livrée.
 */
class SendPushNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 3;
    public $backoff = [10, 60, 300];

    public function __construct(public int $notificationId) {}

    public function handle(): void
    {
        $notification = Notification::with('user')->find($this->notificationId);
        if (! $notification || ! $notification->user_id) return;

        $serverKey = config('services.fcm.server_key');

        // audit 2026-05-19 — feature désactivée tant que FCM pas configuré.
        // Le code mort historique passait quand même par un POST vers un endpoint
        // déprécié + device_token codé en dur à null → 100% des envois échouaient
        // silencieusement. On préfère un log explicite "skipped" en attendant
        // la vraie migration HTTP v1 + intégration mobile.
        if (! $serverKey) {
            Log::info('[PUSH SKIPPED] FCM not configured (FCM_SERVER_KEY empty)', [
                'notification_id' => $notification->id,
                'user_id' => $notification->user_id,
                'title' => $notification->title,
            ]);
            return;
        }

        // audit 2026-05-19 — lecture du device_token depuis device_tokens.
        // Table vide au déploiement → on log et on return proprement.
        $deviceToken = DeviceToken::where('user_id', $notification->user_id)
            ->latest('id')
            ->value('token');

        if (! $deviceToken) {
            Log::info("[PUSH SKIPPED] no device_token for user #{$notification->user_id}", [
                'notification_id' => $notification->id,
            ]);
            return;
        }

        // TODO audit 2026-05-19 — migrer vers FCM HTTP v1 :
        //   1. Installer firebase/php-jwt + récupérer un service account JSON
        //   2. Échanger le service account → access_token OAuth2
        //   3. POST https://fcm.googleapis.com/v1/projects/{project_id}/messages:send
        //      avec Authorization: Bearer {access_token}
        //   4. Payload : { "message": { "token": "...", "notification": {...}, "data": {...} } }
        //
        // En attendant : on log ce qu'on aurait envoyé, sans appeler l'endpoint
        // déprécié (qui retourne 404 NotRegistered depuis juin 2024).
        Log::info("[PUSH PENDING] FCM v1 migration required", [
            'notification_id' => $notification->id,
            'user_id' => $notification->user_id,
            'device_token_preview' => substr($deviceToken, 0, 12) . '…',
            'title' => $notification->title,
            'body' => $notification->body,
            'target_type' => $notification->target_type,
            'target_id' => $notification->target_id,
        ]);
    }
}
