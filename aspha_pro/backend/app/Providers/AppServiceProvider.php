<?php

namespace App\Providers;

use App\Models\Client;
use App\Models\Contract;
use App\Models\Document;
use App\Models\Employee;
use App\Models\Entity;
use App\Models\ClientRequest;
use App\Models\Intervention;
use App\Models\Invoice;
use App\Models\Quote;
use App\Models\StockProduct;
use App\Observers\ClientRequestObserver;
use App\Observers\InterventionObserver;
use App\Observers\StockProductObserver;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        /**
         * Morph map — aligne `owner_type` sur des strings courtes
         * cohérentes avec le DBML, plutôt que les FQCN Laravel.
         *
         * Utilisé par :
         * - addresses.owner_type → 'client' | 'employee' | 'entity'
         * - documents.owner_type → 'client' | 'employee' | 'contract' | 'invoice' | 'quote'
         */
        Relation::morphMap([
            'client' => Client::class,
            'employee' => Employee::class,
            'entity' => Entity::class,
            'contract' => Contract::class,
            'invoice' => Invoice::class,
            'quote' => Quote::class,
            // Ajout pour target_type des notifications → permet le deep-link
            // côté frontend via `client_request` au lieu du FQCN.
            'client_request' => ClientRequest::class,
            'intervention' => Intervention::class,
            'message_thread' => \App\Models\MessageThread::class,
        ]);

        // Observers pour déclencher les notifications applicatives
        Intervention::observe(InterventionObserver::class);
        ClientRequest::observe(ClientRequestObserver::class);
        StockProduct::observe(StockProductObserver::class);

        // Rate limiters — défis brute-force / DoS basique.
        // Les vars RATE_LIMIT_* étaient déclarées dans .env mais jamais
        // utilisées (cf. audit 2026-05-19 HIGH).
        RateLimiter::for('login', function (Request $request) {
            $max = (int) env('RATE_LIMIT_LOGIN', 5);
            return [
                // Limite par IP ET par email (un attaquant change d'IP toutes
                // les requêtes mais cible souvent le même user → double clé).
                Limit::perMinute($max)->by($request->ip()),
                Limit::perMinute($max)->by((string) $request->input('email', '')),
            ];
        });

        RateLimiter::for('api', function (Request $request) {
            $max = (int) env('RATE_LIMIT_API', 60);
            return Limit::perMinute($max)
                ->by(optional($request->user())->id ?: $request->ip());
        });
    }
}
