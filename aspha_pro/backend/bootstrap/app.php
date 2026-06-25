<?php

use Illuminate\Database\QueryException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        // routes/web.php sert le SPA React buildé (catch-all). Indispensable
        // en déploiement : sans `web`, `/` et les routes du SPA tombent en
        // 404. En dev le front tourne sur Vite à part, mais le fichier est
        // inoffensif (il retombe sur la vue welcome si pas de build).
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        apiPrefix: 'api/v1',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // SPA auth via cookie Sanctum sur toutes les routes API
        $middleware->statefulApi();

        // 2026-06-24 — headers HTTP défensifs sur toutes les réponses
        // (X-Frame-Options, X-Content-Type-Options, Referrer-Policy,
        // Permissions-Policy, HSTS). Défense en profondeur contre
        // clickjacking, MIME confusion, fuites referer.
        $middleware->append(\App\Http\Middleware\SecurityHeaders::class);

        // Alias middleware Spatie Permission (utilisable via ->middleware('role:admin'))
        $middleware->alias([
            'role' => \Spatie\Permission\Middleware\RoleMiddleware::class,
            'permission' => \Spatie\Permission\Middleware\PermissionMiddleware::class,
            'role_or_permission' => \Spatie\Permission\Middleware\RoleOrPermissionMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        /**
         * Bloque les erreurs SQL/techniques de fuiter vers le frontend.
         *
         * Quand une QueryException se déclenche (colonne manquante, FK
         * violée, contrainte unique, etc.), Laravel renvoie par défaut le
         * SQL brut + driver message dans la réponse JSON. Cela :
         *  1. Affiche un message incompréhensible à l'utilisateur final
         *  2. Expose la structure interne de la BDD (sécurité)
         *
         * Politique : on logge le détail complet côté serveur (suivi dev)
         * mais on renvoie au frontend uniquement un message générique
         * humain + un code de référence pour le support.
         *
         * Décision du 2026-05-18 — UX globale.
         */
        $exceptions->render(function (QueryException $e, Request $request) {
            if (! $request->expectsJson() && ! $request->is('api/*')) {
                return null;  // laisser le rendu HTML par défaut pour les pages web
            }

            // Référence courte pour qu'on retrouve l'erreur dans les logs
            $ref = strtoupper(substr(bin2hex(random_bytes(4)), 0, 8));

            Log::error("[SQL #{$ref}] ".$e->getMessage(), [
                'sql' => $e->getSql() ?? null,
                'bindings' => $e->getBindings() ?? [],
                'user_id' => $request->user()?->id,
                'route' => $request->path(),
            ]);

            return response()->json([
                'message' => "Une erreur technique est survenue lors de l'enregistrement. "
                    ."Réessaye dans un instant. Si le problème persiste, "
                    ."contacte le support en mentionnant la référence #{$ref}.",
                'error_ref' => $ref,
            ], 500);
        });
    })->create();
