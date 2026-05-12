<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * CORS dev — totalement permissif.
 *
 * En dev, on miroite l'Origin reçue dans Access-Control-Allow-Origin
 * pour que le navigateur accepte les credentials (cookies Sanctum).
 *
 * Le package fruitcake/laravel-cors fait déjà ça via config/cors.php.
 * Ce middleware existe comme filet de sécurité / hook personnalisable.
 *
 * EN PROD : durcir (whitelist d'origines) ou retirer ce middleware.
 */
class CorsMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $origin = $request->headers->get('Origin');

        if ($origin) {
            $response->headers->set('Access-Control-Allow-Origin', $origin);
            $response->headers->set('Access-Control-Allow-Credentials', 'true');
        }

        $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-XSRF-TOKEN, Accept, Origin');

        return $response;
    }
}
