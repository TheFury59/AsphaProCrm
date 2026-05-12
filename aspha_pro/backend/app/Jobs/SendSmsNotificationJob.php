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
 * Envoi SMS — drivers supportés :
 *   - twilio (par défaut)
 *   - ovh
 *   - mock (si rien de configuré → log)
 *
 * Lit le téléphone depuis user.phone (qu'on a sur la table users via employee.phone si lié).
 * Pour le MVP, on logue ce qu'on enverrait si pas de clé SMS configurée.
 */
class SendSmsNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 3;
    public $backoff = [30, 120, 600];

    public function __construct(public int $notificationId) {}

    public function handle(): void
    {
        $notification = Notification::with('user')->find($this->notificationId);
        if (! $notification) return;

        // Récupère le téléphone depuis l'employee lié au user (s'il existe)
        $phone = $notification->user?->employee?->phone ?? null;
        if (! $phone) {
            Log::info("SMS: pas de téléphone pour user #{$notification->user_id}");
            return;
        }

        $driver = config('services.sms.driver', 'mock');
        $text = trim(($notification->title ?? '') . ' — ' . ($notification->body ?? ''));

        match ($driver) {
            'twilio' => $this->sendViaTwilio($phone, $text, $notification->id),
            'ovh' => $this->sendViaOvh($phone, $text, $notification->id),
            default => Log::info('[SMS MOCK] notification #' . $notification->id, [
                'to' => $phone, 'body' => $text,
            ]),
        };
    }

    private function sendViaTwilio(string $to, string $text, int $notifId): void
    {
        $sid = config('services.sms.twilio_sid');
        $token = config('services.sms.twilio_token');
        $from = config('services.sms.twilio_from');
        if (! $sid || ! $token || ! $from) {
            Log::warning("Twilio incomplet (sid/token/from manquant)");
            return;
        }
        $response = Http::withBasicAuth($sid, $token)
            ->asForm()
            ->post("https://api.twilio.com/2010-04-01/Accounts/{$sid}/Messages.json", [
                'From' => $from, 'To' => $to, 'Body' => $text,
            ]);
        if (! $response->successful()) {
            Log::warning("Twilio SMS échoué notif #{$notifId}", ['status' => $response->status()]);
            throw new \RuntimeException('Twilio SMS failed');
        }
    }

    private function sendViaOvh(string $to, string $text, int $notifId): void
    {
        // À implémenter quand on aura les credentials OVH
        Log::info("[SMS OVH placeholder] notif #{$notifId}", ['to' => $to, 'body' => $text]);
    }
}
