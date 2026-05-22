<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 2026-05-22 (C4) — Durée standard saisie sur la prestation contractualisée.
 *
 * La « durée standard » d'une prestation n'est plus une propriété du
 * catalogue : elle se décide au moment de contractualiser la prestation
 * dans la mission. On ajoute donc une colonne `duration_minutes` nullable
 * sur `client_prestations` — l'utilisateur la saisit dans la carte de
 * prestation, et la conversion devis → mission la propage depuis la ligne
 * de devis.
 *
 *  - Nullable : les prestations existantes n'ont pas de durée.
 *  - `unsignedInteger` : une durée en minutes est toujours positive.
 *
 * Idempotent (`Schema::hasColumn`) — aucun SQL spécifique driver
 * (compatible PostgreSQL / MySQL / MariaDB).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('client_prestations') && ! Schema::hasColumn('client_prestations', 'duration_minutes')) {
            Schema::table('client_prestations', function (Blueprint $table) {
                $table->unsignedInteger('duration_minutes')->nullable()->after('label');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('client_prestations', 'duration_minutes')) {
            Schema::table('client_prestations', function (Blueprint $table) {
                $table->dropColumn('duration_minutes');
            });
        }
    }
};
