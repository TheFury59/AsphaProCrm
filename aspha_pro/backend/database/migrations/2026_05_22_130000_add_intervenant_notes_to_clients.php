<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 2026-05-22 — Champ « consignes intervenants » sur la fiche client (B6/F2).
 *
 * Le `Client` ne portait aucun champ de note libre. On ajoute `intervenant_notes`
 * (texte libre, nullable) : des consignes/infos rédigées côté admin sur la fiche
 * client et exposées telles quelles à l'intervenant dans son extranet (tooltip
 * du planning).
 *
 * Idempotente : `Schema::hasColumn` garde l'ajout/suppression de la colonne.
 * Aucun SQL spécifique à un driver (portable PostgreSQL/MySQL/MariaDB).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            if (! Schema::hasColumn('clients', 'intervenant_notes')) {
                $table->text('intervenant_notes')->nullable()->after('print_intervention_detail');
            }
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            if (Schema::hasColumn('clients', 'intervenant_notes')) {
                $table->dropColumn('intervenant_notes');
            }
        });
    }
};
