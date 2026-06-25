<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Ajoute les headers HTTP de sécurité défensive sur toutes les réponses.
 *
 * Défense en profondeur — ces headers ne corrigent pas une faille XSS / IDOR
 * derrière, ils empêchent juste l'exploitation côté navigateur si une faille
 * existe.
 *
 * - X-Frame-Options: DENY → empêche d'iframer l'app (clickjacking)
 * - X-Content-Type-Options: nosniff → empêche le browser de "deviner"
 *   un MIME type qu'on n'a pas envoyé (MIME confusion attacks)
 * - Referrer-Policy: strict-origin-when-cross-origin → ne fuite pas les
 *   path/query du referer vers les tiers
 * - Strict-Transport-Security: 1 an, sous-domaines inclus, preload — force
 *   HTTPS définitif côté navigateur (uniquement quand on est servi en HTTPS,
 *   sinon ignoré). Idempotent en local (HTTP) car le browser ne mémorise pas.
 * - Permissions-Policy: désactive caméra/mic/géoloc/payment au niveau page
 *   web. L'app mobile ne passe pas par cette policy. Le portail web n'a pas
 *   besoin d'accès caméra côté admin.
 *
 * Volontairement PAS de Content-Security-Policy ici : un CSP qui casse
 * l'app est pire qu'un CSP absent. À tuner dans un sprint dédié.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set(
            'Permissions-Policy',
            'camera=(), microphone=(), geolocation=(self), payment=()',
        );

        // HSTS uniquement quand la requête arrive en HTTPS (sinon le header
        // est ignoré par le navigateur ; on l'envoie quand même pour ne pas
        // gérer deux chemins).
        if ($request->isSecure() || app()->environment('production')) {
            $response->headers->set(
                'Strict-Transport-Security',
                'max-age=31536000; includeSubDomains',
            );
        }

        return $response;
    }
}
