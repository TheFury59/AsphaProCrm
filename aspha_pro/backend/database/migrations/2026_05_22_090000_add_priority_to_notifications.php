<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ajoute une colonne `priority` aux notifications.
 * Valeurs : 'normal' (défaut) / 'high' / 'critical'.
 *
 * Permet de mettre en évidence les alertes urgentes côté cloche (bordure/fond
 * marqués + bip sonore) et, à terme, de prioriser le push mobile.
 * Idempotent : vérifie l'absence de la colonne avant de l'ajouter.
 */
return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasColumn('notifications', 'priority')) {
            Schema::table('notifications', function (Blueprint $table) {
                $table->string('priority')->default('normal')->after('channel');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('notifications', 'priority')) {
            Schema::table('notifications', function (Blueprint $table) {
                $table->dropColumn('priority');
            });
        }
    }
};
