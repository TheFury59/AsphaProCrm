<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 2026-05-21 — Produits de stock rattachés à une mission.
 *
 * Table de liaison `mission_stock_items` : les consommables/matériel
 * consommés dans le cadre d'une mission, à côté des prestations
 * contractualisées (`client_prestations`).
 *
 * RÈGLE MÉTIER (tranchée avec le client) :
 *  - Ajouter un produit du stock à une mission décompte IMMÉDIATEMENT le
 *    stock (mouvement de sortie). Le retirer ré-incrémente (mouvement
 *    inverse). Modifier la quantité ajuste par la différence.
 *  - `stock_product_id` nullable : null = ligne libre (produit hors
 *    catalogue stock, juste label + prix + quantité) → AUCUN mouvement.
 *  - `nullOnDelete` : si le produit du stock disparaît, la ligne mission
 *    historique subsiste mais devient une ligne libre.
 *
 * Idempotent (`Schema::hasTable`) + compatible PostgreSQL/SQLite.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('mission_stock_items')) {
            return;
        }

        Schema::create('mission_stock_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mission_id')->constrained('missions')->cascadeOnDelete();
            $table->foreignId('stock_product_id')->nullable()
                ->constrained('stock_products')->nullOnDelete();
            $table->string('label');
            $table->decimal('quantity', 12, 2)->default(1);
            $table->decimal('unit_price', 12, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mission_stock_items');
    }
};
