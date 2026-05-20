<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Clés étrangères différées (correction déploiement PostgreSQL — 2026-05-20).
 *
 * Les migrations ont été développées sur SQLite (laxiste sur les FK : une FK
 * vers une table pas encore créée est simplement stockée sans être vérifiée).
 * PostgreSQL est strict : `CREATE TABLE ... REFERENCES table_inexistante`
 * échoue immédiatement avec `relation "X" does not exist`.
 *
 * Deux migrations posaient une FK vers une table créée APRÈS elles (ou
 * inexistante). Le `->constrained(...)` inline y a été retiré :
 *
 *   1. 2026_05_12_110109_create_consumable_reorders_table
 *      `stock_product_id` -> `stock_products`
 *      (stock_products n'est créée qu'en 2026_05_12_110112 — forward ref).
 *      Intention d'origine : restrictOnDelete.
 *
 *   2. 2026_05_15_110920_add_address_and_contact_to_interventions
 *      `contact_id` -> à l'origine `contacts` (table INEXISTANTE).
 *      La vraie table cible est `client_contacts` (cf. le fix
 *      2026_05_18_160000_fix_intervention_contact_fk, qui re-pointait la FK
 *      vers client_contacts avec nullOnDelete).
 *      Intention finale : nullOnDelete vers client_contacts.
 *
 * Cette migration finale, exécutée une fois TOUTES les tables créées, pose
 * ces FK manquantes.
 *
 * IMPORTANT — SQLite : `Schema::table()->foreign()` après-coup ne fonctionne
 * pas (SQLite ne supporte pas `ALTER TABLE ... ADD CONSTRAINT`). On ne pose
 * donc les FK que si le driver n'est PAS sqlite. Sur SQLite, ça reste sans
 * effet — l'environnement de dev était déjà laxiste sur les FK, rien ne
 * change. Sur PostgreSQL (et MySQL), les vraies FK sont posées.
 *
 * Chaque ajout est idempotent (vérification de colonne + try/catch) pour
 * rester sûr en cas de re-jeu.
 */
return new class extends Migration
{
    public function up(): void
    {
        // SQLite ne supporte pas ADD CONSTRAINT après création de table.
        if (DB::connection()->getDriverName() === 'sqlite') {
            return;
        }

        // 1) consumable_reorders.stock_product_id -> stock_products
        if (Schema::hasTable('consumable_reorders')
            && Schema::hasTable('stock_products')
            && Schema::hasColumn('consumable_reorders', 'stock_product_id')) {
            try {
                Schema::table('consumable_reorders', function (Blueprint $table) {
                    $table->foreign('stock_product_id')
                        ->references('id')->on('stock_products')
                        ->restrictOnDelete();
                });
            } catch (\Throwable $e) {
                // FK déjà présente — on ignore (re-jeu)
            }
        }

        // 2) interventions.contact_id -> client_contacts
        if (Schema::hasTable('interventions')
            && Schema::hasTable('client_contacts')
            && Schema::hasColumn('interventions', 'contact_id')) {
            try {
                Schema::table('interventions', function (Blueprint $table) {
                    $table->foreign('contact_id')
                        ->references('id')->on('client_contacts')
                        ->nullOnDelete();
                });
            } catch (\Throwable $e) {
                // FK déjà présente — on ignore (re-jeu)
            }
        }
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            return;
        }

        if (Schema::hasTable('interventions')
            && Schema::hasColumn('interventions', 'contact_id')) {
            try {
                Schema::table('interventions', function (Blueprint $table) {
                    $table->dropForeign(['contact_id']);
                });
            } catch (\Throwable $e) {
                // FK absente
            }
        }

        if (Schema::hasTable('consumable_reorders')
            && Schema::hasColumn('consumable_reorders', 'stock_product_id')) {
            try {
                Schema::table('consumable_reorders', function (Blueprint $table) {
                    $table->dropForeign(['stock_product_id']);
                });
            } catch (\Throwable $e) {
                // FK absente
            }
        }
    }
};
