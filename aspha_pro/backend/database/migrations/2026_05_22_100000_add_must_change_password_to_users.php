<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tâche A2 — force le changement de mot de passe à la première connexion
 * d'un compte créé par un admin (mot de passe temporaire généré).
 *
 * Le flag passe à `true` à chaque pose d'un mot de passe temporaire
 * (création / reset d'accès) et retombe à `false` quand l'utilisateur
 * change effectivement son mot de passe via PATCH /me.
 */
return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'must_change_password')) {
            Schema::table('users', function (Blueprint $table) {
                $table->boolean('must_change_password')->default(false)->after('status');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('users', 'must_change_password')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('must_change_password');
            });
        }
    }
};
