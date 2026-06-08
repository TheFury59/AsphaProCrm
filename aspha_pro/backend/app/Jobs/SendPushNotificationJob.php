<?php

namespace App\Jobs;

use App\Models\Notification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Envoi push via Expo Push Notification Service.
 *
 * Pourquoi Expo plutôt que FCM brut ?
 *  - L'app mobile Aspha est faite avec Expo (managed workflow).
 *  - Expo gère APNs (iOS) + FCM (Android) en un seul endpoint REST gratuit
 *    et illimité (https://exp.host/--/api/v2/push/send), sans avoir à
 *    générer des access tokens OAuth2 ni stocker un service-account JSON.
 *  - Permet de basculer plus tard vers FCM v1 direct si on sort du
 *    managed workflow.
 *
 * Comportement :
 *  - Lit le `expo_push_token` directement sur `users` (1 token par user
 *    actif, suffit pour V1 — voir migration 2026_06_02_100000).
 *  - Si le token est absent ou invalide → log INFO "skipped" et return.
 *  - Mappe la priorité `high`/`critical` → son par défaut + priority `high`
 *    côté Expo (vibration + écran allumé sur Android).
 *  - Payload data inclut le code de notif + target → permet à l'app
 *    d'ouvrir directement la bonne page au tap.
 *  - 3 retries avec backoff exponentiel sur erreur transport.
 */
class SendPushNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 3;
    public $backoff = [10, 60, 300];

    public function __construct(public int $notificationId) {}

    public function handle(): void
    {
        $notification = Notification::with(['user', 'notificationType'])
            ->find($this->notificationId);

        if (! $notification || ! $notification->user_id) {
            return;
        }

        $token = $notification->user->expo_push_token ?? null;

        if (! $token || ! str_starts_with($token, 'ExponentPushToken[')) {
            Log::info('[PUSH SKIPPED] No expo_push_token for user', [
                'notification_id' => $notification->id,
                'user_id' => $notification->user_id,
            ]);
            return;
        }

        $priority = $notification->priority ?? 'normal';
        $isHighPriority = in_array($priority, ['high', 'critical'], true);

        $payload = [
            'to' => $token,
            'title' => $notification->title ?? 'Aspha Pro',
            'body' => $notification->body ?? '',
            'data' => [
                'notification_id' => $notification->id,
                'code' => $notification->notificationType?->code,
                'target_type' => $notification->target_type,
                'target_id' => $notification->target_id,
                'priority' => $priority,
            ],
            // Son par défaut iOS uniquement sur les notifs importantes.
            'sound' => $isHighPriority ? 'default' : null,
            // Channel Android — l'app crée un channel "default" + un channel
            // "critical" avec son et vibration accentuée (configurés côté
            // expo-notifications dans l'app).
            'channelId' => $isHighPriority ? 'critical' : 'default',
            // Priorité de delivery Android : "high" force le réveil de
            // l'écran ; "normal" est plus économe.
            'priority' => $isHighPriority ? 'high' : 'normal',
        ];

        try {
            $response = Http::acceptJson()
                ->timeout(10)
                ->post('https://exp.host/--/api/v2/push/send', $payload);

            if ($response->failed()) {
                Log::warning('[PUSH] Expo Push API failed', [
                    'notification_id' => $notification->id,
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
                throw new \RuntimeException('Expo Push API error: ' . $response->status());
            }

            // L'API Expo renvoie un statut par message. Si le token est
            // invalide (DeviceNotRegistered, InvalidCredentials) on purge
            // le token côté user pour ne plus tenter à l'avenir.
            $data = $response->json('data');
            if (is_array($data) && ($data['status'] ?? null) === 'error') {
                $errorCode = $data['details']['error'] ?? null;
                if (in_array($errorCode, ['DeviceNotRegistered', 'InvalidCredentials'], true)) {
                    $notification->user->forceFill(['expo_push_token' => null])->save();
                    Log::info('[PUSH] Token invalide purgé', [
                        'user_id' => $notification->user_id,
                        'error' => $errorCode,
                    ]);
                }
            }
        } catch (\Throwable $e) {
            Log::warning("Push notification #{$notification->id} échouée", [
                'error' => $e->getMessage(),
            ]);
            throw $e; // laisse la queue retry selon $tries/$backoff
        }
    }
}
