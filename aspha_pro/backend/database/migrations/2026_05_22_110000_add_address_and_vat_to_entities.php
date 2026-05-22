<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * 2026-05-22 — Bloc adresse + n° TVA intracommunautaire sur les entités.
 *
 * L'`Entity` ne portait que name/phone/email/siret. On lui ajoute :
 *   - un bloc adresse (`address_line`, `postal_code`, `city`) pour le siège,
 *   - le `vat_number` (TVA intra), affiché en pied de page des PDF devis/factures.
 *
 * Puis une mise à jour de DONNÉES : la ligne entité de démo déjà déployée
 * (clé SIRET '00000000000000') est renommée « Aspha Service » → « Aspha Pro »
 * et recentrée sur Douai. Le `firstOrCreate` du `CatalogSeeder` ne renomme
 * jamais une ligne existante : cette mise à jour est donc indispensable pour
 * les bases déjà en service.
 *
 * Idempotente : `Schema::hasColumn` garde l'ajout de colonnes ; l'`UPDATE`
 * filtré sur le SIRET réapplique simplement le même état à chaque re-run.
 * Aucun SQL spécifique à un driver (portable PostgreSQL/MySQL/MariaDB).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('entities', function (Blueprint $table) {
            if (! Schema::hasColumn('entities', 'address_line')) {
                $table->string('address_line')->nullable()->after('siret');
            }
            if (! Schema::hasColumn('entities', 'postal_code')) {
                $table->string('postal_code')->nullable()->after('address_line');
            }
            if (! Schema::hasColumn('entities', 'city')) {
                $table->string('city')->nullable()->after('postal_code');
            }
            if (! Schema::hasColumn('entities', 'vat_number')) {
                $table->string('vat_number')->nullable()->after('city');
            }
        });

        // === Mise à jour de données — entité de démo déjà en base ===
        // « Aspha Service — Siège » (Paris) → « Aspha Pro » (Douai).
        DB::table('entities')
            ->where('siret', '00000000000000')
            ->update([
                'name' => 'Aspha Pro',
                'postal_code' => '59500',
                'city' => 'Douai',
                'latitude' => 50.3714,
                'longitude' => 3.0800,
            ]);
    }

    public function down(): void
    {
        Schema::table('entities', function (Blueprint $table) {
            foreach (['vat_number', 'city', 'postal_code', 'address_line'] as $column) {
                if (Schema::hasColumn('entities', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
