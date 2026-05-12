<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Les champs pennylane_id / pennylane_synced_at sur invoices et quotes
 * étaient générés en NOT NULL par défaut. Ils doivent être nullable car
 * l'intégration Pennylane est optionnelle (déclenchée seulement à l'envoi).
 */
return new class extends Migration {
    public function up(): void
    {
        // SQLite ne supporte pas ALTER COLUMN nullable directement
        // → on doit utiliser change() via doctrine/dbal OU recréer
        // Stratégie SQLite-safe : utiliser Schema::table avec change()
        Schema::table('invoices', function (Blueprint $table) {
            $table->string('pennylane_id')->nullable()->change();
            $table->dateTime('pennylane_synced_at')->nullable()->change();
        });
        Schema::table('quotes', function (Blueprint $table) {
            $table->string('pennylane_id')->nullable()->change();
            $table->dateTime('pennylane_synced_at')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Pas de rollback strict (les NULL existants empêcheraient la conversion)
    }
};
