<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Refonte 2026-05-21 — la « nature » (régulier/ponctuel) d'une prestation
 * dépend du CONTRAT CLIENT, pas du catalogue produit.
 *
 * On déplace la nature sur `client_prestations` et on y stocke aussi la
 * configuration de récurrence : ainsi le formulaire de mission saisit, par
 * prestation, soit "ponctuelle" soit "récurrente + paramètres", et le
 * MissionController génère automatiquement l'intervention récurrente modèle.
 *
 * Ces champs miroir ceux de la table `interventions` (frequency, interval,
 * days_of_week, start/end time, end_type, etc.) pour permettre de regénérer
 * proprement l'intervention modèle si la mission est mise à jour.
 *
 * Idempotent + compatible PostgreSQL/SQLite (pas de SQL spécifique).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('client_prestations', function (Blueprint $table) {
            if (! Schema::hasColumn('client_prestations', 'nature')) {
                // 'regular' = récurrente, 'punctual' = ponctuelle. Défaut prudent.
                $table->string('nature')->default('punctual')->after('billing_type');
            }
            // --- Paramètres de récurrence (renseignés si nature = 'regular') ---
            if (! Schema::hasColumn('client_prestations', 'recurrence_frequency')) {
                $table->string('recurrence_frequency')->nullable()->after('nature'); // daily|weekly|monthly|yearly
            }
            if (! Schema::hasColumn('client_prestations', 'recurrence_interval')) {
                $table->unsignedInteger('recurrence_interval')->nullable()->after('recurrence_frequency');
            }
            if (! Schema::hasColumn('client_prestations', 'recurrence_days_of_week')) {
                $table->string('recurrence_days_of_week')->nullable()->after('recurrence_interval'); // 'mon,tue,...'
            }
            if (! Schema::hasColumn('client_prestations', 'recurrence_start_time')) {
                $table->time('recurrence_start_time')->nullable()->after('recurrence_days_of_week');
            }
            if (! Schema::hasColumn('client_prestations', 'recurrence_end_time')) {
                $table->time('recurrence_end_time')->nullable()->after('recurrence_start_time');
            }
            if (! Schema::hasColumn('client_prestations', 'recurrence_end_type')) {
                $table->string('recurrence_end_type')->nullable()->after('recurrence_end_time'); // never|on_date|after_occurrences
            }
            if (! Schema::hasColumn('client_prestations', 'recurrence_occurrences_count')) {
                $table->unsignedInteger('recurrence_occurrences_count')->nullable()->after('recurrence_end_type');
            }
        });
    }

    public function down(): void
    {
        Schema::table('client_prestations', function (Blueprint $table) {
            foreach ([
                'nature',
                'recurrence_frequency',
                'recurrence_interval',
                'recurrence_days_of_week',
                'recurrence_start_time',
                'recurrence_end_time',
                'recurrence_end_type',
                'recurrence_occurrences_count',
            ] as $col) {
                if (Schema::hasColumn('client_prestations', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
