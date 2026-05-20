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
            // `contact_id` : pas de `->constrained()` inline. La declaration
            // d'origine pointait vers une table `contacts` qui n'existe pas
            // (la vraie table est `client_contacts`, cf. 2026_05_18_160000).
            // Sous PostgreSQL, `constrained('contacts')` casse immediatement.
            // La FK correcte (-> client_contacts) est posee par
            // 2026_05_20_999000_add_deferred_foreign_keys.php.
            $table->unsignedBigInteger('contact_id')
                ->nullable()
                ->after('address_id');
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
