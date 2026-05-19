<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration audit 2026-05-19 — corrections du module Ventes.
 *
 * Trois changements structurels :
 *   1. `invoice_items.vat_rate_id` + `quote_items.vat_rate_id` (nullable FK)
 *      → permet d'avoir un taux de TVA par ligne au lieu du 20% hardcodé.
 *      Fallback silencieux à 20% si null (compat historique).
 *   2. `quotes.invoice_id` (nullable FK) → anti double-conversion devis→facture.
 *      Tracked au moment du convertToInvoice.
 *   3. `document_sequences` (type, year, current_number) → numérotation
 *      atomique avec lockForUpdate(). Remplace les `count()+1` race-prone des
 *      controllers Quote/Invoice/Reglement.
 *
 * Toutes les modifs sont idempotentes (hasColumn / hasTable check).
 */
return new class extends Migration
{
    public function up(): void
    {
        // ===== 1) vat_rate_id sur invoice_items + quote_items =====
        if (Schema::hasTable('invoice_items') && ! Schema::hasColumn('invoice_items', 'vat_rate_id')) {
            Schema::table('invoice_items', function (Blueprint $table) {
                $table->foreignId('vat_rate_id')
                    ->nullable()
                    ->after('item_type')
                    ->constrained('vat_rates')
                    ->nullOnDelete();
            });
        }

        if (Schema::hasTable('quote_items') && ! Schema::hasColumn('quote_items', 'vat_rate_id')) {
            Schema::table('quote_items', function (Blueprint $table) {
                $table->foreignId('vat_rate_id')
                    ->nullable()
                    ->after('item_type')
                    ->constrained('vat_rates')
                    ->nullOnDelete();
            });
        }

        // ===== 2) quotes.invoice_id (anti double-conversion) =====
        if (Schema::hasTable('quotes') && ! Schema::hasColumn('quotes', 'invoice_id')) {
            Schema::table('quotes', function (Blueprint $table) {
                $table->foreignId('invoice_id')
                    ->nullable()
                    ->after('status')
                    ->constrained('invoices')
                    ->nullOnDelete();
            });
        }

        // ===== 3) document_sequences (numérotation atomique) =====
        if (! Schema::hasTable('document_sequences')) {
            Schema::create('document_sequences', function (Blueprint $table) {
                $table->id();
                $table->string('type', 16);       // 'INV' | 'QUO' | 'PAY' | ...
                $table->unsignedSmallInteger('year');
                $table->unsignedInteger('current_number')->default(0);
                $table->timestamps();
                $table->unique(['type', 'year'], 'document_sequences_type_year_unique');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('quotes') && Schema::hasColumn('quotes', 'invoice_id')) {
            Schema::table('quotes', function (Blueprint $table) {
                $table->dropConstrainedForeignId('invoice_id');
            });
        }

        if (Schema::hasTable('quote_items') && Schema::hasColumn('quote_items', 'vat_rate_id')) {
            Schema::table('quote_items', function (Blueprint $table) {
                $table->dropConstrainedForeignId('vat_rate_id');
            });
        }

        if (Schema::hasTable('invoice_items') && Schema::hasColumn('invoice_items', 'vat_rate_id')) {
            Schema::table('invoice_items', function (Blueprint $table) {
                $table->dropConstrainedForeignId('vat_rate_id');
            });
        }

        Schema::dropIfExists('document_sequences');
    }
};
