<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 2026-05-21 — Produits de stock dans les devis et les factures.
 *
 * Ajoute une FK nullable `stock_product_id` sur `quote_items` et
 * `invoice_items`. Un item de devis/facture peut désormais référencer un
 * produit du catalogue stock (consommable/matériel), à côté des prestations
 * (`product_id`) et des lignes libres (les deux FK à null).
 *
 *  - `item_type = 'produit'` matérialise déjà une ligne « produit » ;
 *    `stock_product_id` précise DE QUEL produit du stock il s'agit.
 *  - `nullOnDelete` : si le produit du stock est supprimé, la ligne du
 *    devis/facture historique reste mais perd sa référence.
 *  - RÈGLE MÉTIER : un devis ne déclenche AUCUN mouvement de stock. La FK
 *    sert uniquement de traçabilité de chiffrage.
 *
 * Idempotent (`Schema::hasColumn`) + compatible PostgreSQL/SQLite.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('quote_items') && ! Schema::hasColumn('quote_items', 'stock_product_id')) {
            Schema::table('quote_items', function (Blueprint $table) {
                $table->foreignId('stock_product_id')->nullable()->after('product_id')
                    ->constrained('stock_products')->nullOnDelete();
            });
        }

        if (Schema::hasTable('invoice_items') && ! Schema::hasColumn('invoice_items', 'stock_product_id')) {
            Schema::table('invoice_items', function (Blueprint $table) {
                $table->foreignId('stock_product_id')->nullable()->after('product_id')
                    ->constrained('stock_products')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('quote_items', 'stock_product_id')) {
            Schema::table('quote_items', function (Blueprint $table) {
                $table->dropConstrainedForeignId('stock_product_id');
            });
        }
        if (Schema::hasColumn('invoice_items', 'stock_product_id')) {
            Schema::table('invoice_items', function (Blueprint $table) {
                $table->dropConstrainedForeignId('stock_product_id');
            });
        }
    }
};
