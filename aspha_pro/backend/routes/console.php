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

// Rappels de badgeage à l'intervenant (4/RDV : arrivée due/late, départ due/late).
// Précision ±1 min : on tourne chaque minute, anti-spam interne par code.
Schedule::command('app:notify-checkin-reminders')
    ->everyMinute()
    ->withoutOverlapping();

// Alerte de renouvellement des documents (expiry_date proche/dépassée).
// Tourne chaque jour ; un anti-spam interne (7 jours) évite le rappel
// quotidien pour un même document.
Schedule::command('app:notify-document-renewals')
    ->dailyAt('07:30')
    ->withoutOverlapping();
