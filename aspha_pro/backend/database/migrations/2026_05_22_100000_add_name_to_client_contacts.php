<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 2026-05-22 — Nom sur les contacts entreprise.
 *
 * Ajoute une colonne `name` aux contacts entreprise (`client_contacts`).
 * NULLABLE : les contacts déjà saisis n'ont pas de nom. Toute nouvelle
 * création/màj exigera le nom côté validation (ClientSubResourceController).
 *
 * Idempotente (`Schema::hasColumn`) + compatible PostgreSQL/MySQL/SQLite
 * (aucun SQL spécifique à un driver, string standard).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('client_contacts', function (Blueprint $table) {
            if (! Schema::hasColumn('client_contacts', 'name')) {
                $table->string('name')->nullable()->after('client_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('client_contacts', function (Blueprint $table) {
            if (Schema::hasColumn('client_contacts', 'name')) {
                $table->dropColumn('name');
            }
        });
    }
};
