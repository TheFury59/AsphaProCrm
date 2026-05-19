<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ajoute une colonne `email` (email personnel) sur employees.
 *
 * Avant : aucun email stocké sur l'intervenant — seul le téléphone et
 * l'éventuel `user.email` (compte de connexion) étaient disponibles.
 *
 * Cas d'usage : pré-remplir l'adresse email lors de la création de
 * l'accès extranet intervenant, et permettre à l'admin de saisir
 * l'email perso (différent du email de connexion si voulu).
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->string('email')->nullable()->after('phone');
        });
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumn('email');
        });
    }
};
