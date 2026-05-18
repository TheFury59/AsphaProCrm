<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ajoute une vraie colonne `portal_user_id` sur clients pour distinguer
 * proprement :
 *  - owner_user_id  : le GESTIONNAIRE Aspha du dossier client (interne)
 *  - portal_user_id : le USER cree pour ce client final pour son extranet
 *
 * Avant cette migration, ExtranetController utilisait `owner_user_id` pour
 * identifier le client connecte -> bug semantique (un admin qui gere 50
 * clients devenait "le client" de 50 extranets).
 *
 * Aucune retro-affectation n'est faite (clients pre-existants n'ont pas
 * de portal_user_id tant qu'on ne leur cree pas explicitement l'acces
 * depuis l'UI admin).
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->foreignId('portal_user_id')
                ->nullable()
                ->after('owner_user_id')
                ->unique()  // 1 user porte 1 seul client extranet
                ->constrained('users')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->dropForeign(['portal_user_id']);
            $table->dropUnique(['portal_user_id']);
            $table->dropColumn('portal_user_id');
        });
    }
};
