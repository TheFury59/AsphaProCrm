<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 2026-05-21 — Enrichissement des produits de stock.
 *
 * Ajoute 3 informations aux produits de stock (`stock_products`) :
 *   - `purchase_price` — prix d'achat unitaire (HT, nullable)
 *   - `selling_price`  — prix de vente / facturation unitaire (nullable)
 *   - `supplier_id`    — fournisseur de référence (FK nullable vers `suppliers`,
 *                        `nullOnDelete` : si le fournisseur est supprimé, le
 *                        produit retombe simplement « sans fournisseur »).
 *
 * Idempotente (`Schema::hasColumn`) + compatible PostgreSQL/SQLite (aucun SQL
 * spécifique, decimal standard).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stock_products', function (Blueprint $table) {
            if (! Schema::hasColumn('stock_products', 'purchase_price')) {
                $table->decimal('purchase_price', 12, 2)->nullable()->after('current_quantity');
            }
            if (! Schema::hasColumn('stock_products', 'selling_price')) {
                $table->decimal('selling_price', 12, 2)->nullable()->after('purchase_price');
            }
            if (! Schema::hasColumn('stock_products', 'supplier_id')) {
                $table->foreignId('supplier_id')
                    ->nullable()
                    ->after('selling_price')
                    ->constrained('suppliers')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('stock_products', function (Blueprint $table) {
            if (Schema::hasColumn('stock_products', 'supplier_id')) {
                $table->dropConstrainedForeignId('supplier_id');
            }
            if (Schema::hasColumn('stock_products', 'selling_price')) {
                $table->dropColumn('selling_price');
            }
            if (Schema::hasColumn('stock_products', 'purchase_price')) {
                $table->dropColumn('purchase_price');
            }
        });
    }
};
