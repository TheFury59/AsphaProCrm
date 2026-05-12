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
 * Envoi push via Firebase Cloud Messaging (FCM).
 *
 * Mode mock si FCM_SERVER_KEY vide → log seulement.
 * Mode réel : POST https://fcm.googleapis.com/fcm/send avec Authorization: key=...
 *
 * Le token device est récupéré sur l'enregistrement push_device (TODO : table à créer).
 * Pour le MVP, le job se contente de logger ce qu'il enverrait.
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
        if (! $serverKey) {
            Log::info('[PUSH MOCK] notification #' . $notification->id, [
                'user_id' => $notification->user_id,
                'title' => $notification->title,
                'body' => $notification->body,
            ]);
            return;
        }

        // TODO : récupérer le device token depuis user.push_tokens (table push_devices à créer)
        $deviceToken = null;
        if (! $deviceToken) {
            Log::warning("Push: aucun device token pour user #{$notification->user_id}");
            return;
        }

        $response = Http::withHeaders([
            'Authorization' => 'key=' . $serverKey,
            'Content-Type' => 'application/json',
        ])->post('https://fcm.googleapis.com/fcm/send', [
            'to' => $deviceToken,
            'notification' => [
                'title' => $notification->title,
                'body' => $notification->body,
            ],
            'data' => [
                'target_type' => $notification->target_type,
                'target_id' => $notification->target_id,
                'notification_id' => $notification->id,
            ],
        ]);

        if (! $response->successful()) {
            Log::warning("Push FCM échoué pour notification #{$notification->id}", [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
        }
    }
}
