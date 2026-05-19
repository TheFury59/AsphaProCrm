<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration audit 2026-05-19 — Matching skills.
 *
 * Crée la table pivot `product_skill` qui matérialise les compétences requises
 * pour une prestation (Product). Permet au InterventionMatchingService de
 * scorer la composante "skills" (40 pts) correctement, au lieu du fallback
 * neutre à 25/40 utilisé jusqu'ici.
 *
 * Table vide au déploiement — à enrichir par l'admin via UI/seeder selon le
 * catalogue de prestations.
 */
return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('product_skill')) {
            Schema::create('product_skill', function (Blueprint $table) {
                $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
                $table->foreignId('skill_id')->constrained('skills')->cascadeOnDelete();
                $table->primary(['product_id', 'skill_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('product_skill');
    }
};
