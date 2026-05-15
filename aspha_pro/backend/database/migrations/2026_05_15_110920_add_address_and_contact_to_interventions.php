<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Permet d'assigner une ADRESSE et un CONTACT spécifiques à un RDV.
 *
 * Un client peut avoir plusieurs adresses (siège, facturation, intervention,
 * autre) et plusieurs contacts (entreprise + liés famille/médecin/urgence).
 * Sans ces FK, le RDV utilise la première adresse trouvée et le contact
 * entreprise par défaut — ce qui peut être incorrect quand le client a une
 * vraie multiplicité.
 *
 * Nullable + restrictOnDelete : on ne casse pas le planning si une adresse
 * ou un contact est supprimé.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('interventions', function (Blueprint $table) {
            $table->foreignId('address_id')
                ->nullable()
                ->after('key_id')
                ->constrained('addresses')
                ->restrictOnDelete();
            $table->foreignId('contact_id')
                ->nullable()
                ->after('address_id')
                ->constrained('contacts')
                ->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('interventions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('address_id');
            $table->dropConstrainedForeignId('contact_id');
        });
    }
};
