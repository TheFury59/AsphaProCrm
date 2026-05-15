<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ajoute `key_id` sur interventions : permet d'assigner une clé spécifique du
 * client à une intervention donnée (l'intervenant sait qu'il doit récupérer
 * cette clé pour ce RDV précis).
 *
 * Nullable car la majorité des RDV n'ont pas besoin de clé.
 * restrictOnDelete pour éviter de casser un planning si on supprime une clé
 * encore référencée.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('interventions', function (Blueprint $table) {
            $table->foreignId('key_id')
                ->nullable()
                ->after('client_prestation_id')
                ->constrained('keys')
                ->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('interventions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('key_id');
        });
    }
};
