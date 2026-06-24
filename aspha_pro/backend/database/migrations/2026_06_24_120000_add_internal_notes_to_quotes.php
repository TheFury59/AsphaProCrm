<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ajoute `internal_notes` à la table `quotes`.
 *
 * Contexte : aujourd'hui la colonne `comment` sert à la fois pour les
 * notes internes (admins) et la description visible sur le PDF envoyé au
 * client → confusion + risque de fuite d'info. Refonte : 2 champs séparés.
 *  - `comment`        → reste = description visible côté client (PDF)
 *  - `internal_notes` → NOUVEAU = notes internes admin, jamais sur le PDF
 *
 * Idempotent (`hasColumn`).
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('quotes', function (Blueprint $table) {
            if (! Schema::hasColumn('quotes', 'internal_notes')) {
                $table->text('internal_notes')->nullable()->after('comment');
            }
        });
    }

    public function down(): void
    {
        Schema::table('quotes', function (Blueprint $table) {
            if (Schema::hasColumn('quotes', 'internal_notes')) {
                $table->dropColumn('internal_notes');
            }
        });
    }
};
