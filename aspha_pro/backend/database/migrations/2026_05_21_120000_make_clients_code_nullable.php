<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Rend `clients.code` optionnel à la saisie.
 *
 * Le code est désormais généré automatiquement après l'insert
 * (CLI-{id zero-paddé sur 4}) quand l'utilisateur n'en fournit pas.
 * L'index `unique` est conservé : PostgreSQL autorise plusieurs NULL
 * dans un index unique, et chaque code généré dérive de l'id (unique).
 */
return new class extends Migration {
    public function up(): void
    {
        // Idempotent : seulement si la colonne est encore NOT NULL.
        Schema::table('clients', function (Blueprint $table) {
            $table->string('code')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->string('code')->nullable(false)->change();
        });
    }
};
