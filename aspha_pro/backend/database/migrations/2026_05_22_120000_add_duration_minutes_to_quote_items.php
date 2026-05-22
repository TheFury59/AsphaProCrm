<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 2026-05-22 (C4) — Durée standard saisie sur le devis.
 *
 * La « durée standard » d'une prestation n'est plus une propriété du
 * catalogue (`products.default_duration_minutes`) : elle se décide au moment
 * du chiffrage. On ajoute donc une colonne `duration_minutes` nullable sur
 * chaque ligne de devis (`quote_items`) — l'utilisateur la saisit en
 * sélectionnant la prestation.
 *
 *  - Nullable : les lignes de devis existantes n'ont pas de durée.
 *  - `unsignedInteger` : une durée en minutes est toujours positive.
 *
 * Idempotent (`Schema::hasColumn`) — aucun SQL spécifique driver
 * (compatible PostgreSQL / MySQL / MariaDB).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('quote_items') && ! Schema::hasColumn('quote_items', 'duration_minutes')) {
            Schema::table('quote_items', function (Blueprint $table) {
                $table->unsignedInteger('duration_minutes')->nullable()->after('quantity');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('quote_items', 'duration_minutes')) {
            Schema::table('quote_items', function (Blueprint $table) {
                $table->dropColumn('duration_minutes');
            });
        }
    }
};
