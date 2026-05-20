<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Corrections du flux de création des devis (2026-05-20).
 *
 *  1. `quotes.quote_type_id` devient NULLABLE.
 *     Avant : `foreignId(...)->constrained()` => NOT NULL. Or il peut n'y
 *     avoir aucun quote_type en base => toute création de devis cassait en
 *     SQL (contrainte NOT NULL violée) => 500 "Échec de la création".
 *     Un devis peut exister sans type prédéfini.
 *
 *  2. `quote_items.product_id` + `invoice_items.product_id` : FK nullable
 *     vers `products`. Permet de tracer de quelle prestation du catalogue
 *     provient une ligne (les lignes "libres" gardent product_id = null).
 */
return new class extends Migration
{
    public function up(): void
    {
        // 1) quote_type_id nullable
        if (Schema::hasColumn('quotes', 'quote_type_id')) {
            Schema::table('quotes', function (Blueprint $table) {
                $table->unsignedBigInteger('quote_type_id')->nullable()->change();
            });
        }

        // 2) product_id sur quote_items
        if (Schema::hasTable('quote_items') && ! Schema::hasColumn('quote_items', 'product_id')) {
            Schema::table('quote_items', function (Blueprint $table) {
                $table->foreignId('product_id')->nullable()->after('quote_id')
                    ->constrained('products')->nullOnDelete();
            });
        }

        // 3) product_id sur invoice_items
        if (Schema::hasTable('invoice_items') && ! Schema::hasColumn('invoice_items', 'product_id')) {
            Schema::table('invoice_items', function (Blueprint $table) {
                $table->foreignId('product_id')->nullable()->after('invoice_id')
                    ->constrained('products')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('quote_items', 'product_id')) {
            Schema::table('quote_items', function (Blueprint $table) {
                $table->dropConstrainedForeignId('product_id');
            });
        }
        if (Schema::hasColumn('invoice_items', 'product_id')) {
            Schema::table('invoice_items', function (Blueprint $table) {
                $table->dropConstrainedForeignId('product_id');
            });
        }
        // quote_type_id : on ne le re-passe pas NOT NULL (des devis sans type
        // peuvent désormais exister).
    }
};
