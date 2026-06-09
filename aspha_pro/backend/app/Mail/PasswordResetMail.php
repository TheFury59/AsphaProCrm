<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Email envoyé lors d'une demande de réinitialisation de mot de passe.
 *
 * Contient le lien `<frontend>/reset-password?token=X&email=Y`. Le lien est
 * valable `expiresInMinutes` minutes (config `auth.passwords.users.expire`,
 * défaut 60 min). Une fois utilisé, le token est consommé et ne peut plus
 * servir.
 *
 * En dev sans SMTP : `MAIL_MAILER=log` → mail écrit dans
 * `storage/logs/laravel.log` (suffit pour tester le flow).
 */
class PasswordResetMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $userName,
        public string $resetUrl,
        public int $expiresInMinutes,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Réinitialisation de votre mot de passe — Aspha Pro',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.password-reset',
            with: [
                'userName' => $this->userName,
                'resetUrl' => $this->resetUrl,
                'expiresInMinutes' => $this->expiresInMinutes,
            ],
        );
    }
}
