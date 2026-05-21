<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote')->hourly();

/*
|--------------------------------------------------------------------------
| Tâches planifiées
|--------------------------------------------------------------------------
|
| Récap quotidien des RDV à pourvoir (sans intervenant) sur 7 jours glissants.
|
| ⚠️ Déclenchement Render : le scheduler Laravel a besoin d'un tick externe.
|    Sur Render, câbler un « Cron Job » (ou un ping HTTP) qui exécute
|    `php artisan schedule:run` chaque minute. Tant que ce déclencheur n'est
|    pas configuré côté infra, la commande peut être lancée manuellement :
|    `php artisan app:notify-unassigned-interventions`.
|
*/
Schedule::command('app:notify-unassigned-interventions')
    ->dailyAt('08:00')
    ->withoutOverlapping();
