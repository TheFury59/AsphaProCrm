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
| ⚠️ Déclenchement du scheduler : Laravel a besoin d'un tick externe.
|    En production (o2switch), un cron exécute `php artisan schedule:run`
|    chaque minute — toutes les commandes ci-dessous sont alors actives.
|    Sinon, elles peuvent être lancées manuellement.
|
*/

// Récap quotidien des RDV à pourvoir (sans intervenant) sur 7 jours glissants.
Schedule::command('app:notify-unassigned-interventions')
    ->dailyAt('08:00')
    ->withoutOverlapping();

// Récap des heures travaillées — hebdomadaire (semaine précédente), lundi 07:00.
Schedule::command('app:notify-worked-hours week')
    ->weeklyOn(1, '07:00')
    ->withoutOverlapping();

// Récap des heures travaillées — mensuel (mois précédent), le 1er à 07:00.
Schedule::command('app:notify-worked-hours month')
    ->monthlyOn(1, '07:00')
    ->withoutOverlapping();

// Alerte RDV non pointé 30 min après le début — vérification toutes les 10 min.
Schedule::command('app:notify-overdue-checkins')
    ->everyTenMinutes()
    ->withoutOverlapping();
