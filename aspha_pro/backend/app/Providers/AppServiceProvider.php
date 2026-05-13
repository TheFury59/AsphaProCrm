<?php

namespace App\Providers;

use App\Models\Client;
use App\Models\Contract;
use App\Models\Document;
use App\Models\Employee;
use App\Models\Entity;
use App\Models\Intervention;
use App\Models\Invoice;
use App\Models\Quote;
use App\Models\StockProduct;
use App\Observers\InterventionObserver;
use App\Observers\StockProductObserver;
use Illuminate\Database\Eloquent\Relations\Relation;
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
        ]);

        // Observers pour déclencher les notifications applicatives
        Intervention::observe(InterventionObserver::class);
        StockProduct::observe(StockProductObserver::class);
    }
}
