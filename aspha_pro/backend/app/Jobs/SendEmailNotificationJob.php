<?php

namespace App\Jobs;

use App\Models\Notification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Envoi email via le driver Mail configuré (smtp, mailgun, sendgrid, postmark…).
 *
 * Si MAIL_MAILER=log → écrit dans storage/logs/laravel.log (dev mode).
 * Sinon, dépend de la config dans config/mail.php + .env.
 *
 * Pour le MVP, on envoie un mail texte brut depuis NoReply@aspha.local.
 * À terme : utiliser un Mailable + template Blade markdown pour mise en forme.
 */
class SendEmailNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 3;
    public $backoff = [30, 120, 600];

    public function __construct(public int $notificationId) {}

    public function handle(): void
    {
        $notification = Notification::with('user')->find($this->notificationId);
        if (! $notification || ! $notification->user?->email) return;

        try {
            Mail::raw(
                ($notification->body ?? $notification->title ?? '') . "\n\n— Aspha Pro",
                function ($m) use ($notification) {
                    $m->to($notification->user->email)
                      ->subject($notification->title ?? 'Notification Aspha');
                },
            );
        } catch (\Throwable $e) {
            Log::warning("Email notification #{$notification->id} échouée", ['error' => $e->getMessage()]);
            throw $e;  // laisse la queue retry
        }
    }
}
