<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Email envoyé au client lorsqu'on crée/reset son accès extranet.
 *
 * Contient l'URL de connexion (config app.url + /login), l'identifiant
 * (email) et le mot de passe temporaire. Le client est invité à le
 * changer après la première connexion (à implémenter côté extranet).
 *
 * En dev sans SMTP : MAIL_MAILER=log → le mail est écrit dans
 * storage/logs/laravel.log avec tout le contenu. Suffit pour tester
 * le flow avant d'avoir o2switch.
 */
class PortalCredentialsMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $companyName,
        public string $email,
        public string $password,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Votre accès au portail Aspha — {$this->companyName}",
        );
    }

    public function content(): Content
    {
        $appUrl = rtrim(config('app.url', 'http://localhost'), '/');

        return new Content(
            view: 'emails.portal-credentials',
            with: [
                'companyName' => $this->companyName,
                'email' => $this->email,
                'password' => $this->password,
                'loginUrl' => $appUrl.'/login',
            ],
        );
    }
}
