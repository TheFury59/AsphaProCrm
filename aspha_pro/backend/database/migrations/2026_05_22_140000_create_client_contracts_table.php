<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 2026-05-22 — Tâche B4 : contrats côté CLIENT.
 *
 * Jusqu'ici les contrats n'existaient que pour les intervenants (table
 * `contracts`, modèle RH lourd, non polymorphe). Le contrat client est une
 * notion bien plus simple (référence, type, dates, engagement, facturation).
 *
 * DÉCISION : entité SÉPARÉE `client_contracts`, table dédiée, AUCUN
 * polymorphisme — bien plus sûr que de tordre la table `contracts` RH.
 *
 * Idempotent (`Schema::hasTable`) + aucun SQL spécifique driver
 * → compatible PostgreSQL (prod) puis MySQL/MariaDB.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('client_contracts')) {
            return;
        }

        Schema::create('client_contracts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained('clients')->cascadeOnDelete();
            // Référence auto-générée (CTR-0001) si laissée vide à la création.
            $table->string('reference')->nullable();
            // Nature / type du contrat (texte libre).
            $table->string('type')->nullable();
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            // Durée d'engagement (ex. « 12 mois »).
            $table->string('commitment_duration')->nullable();
            // Rythme de facturation (ex. « mensuel »).
            $table->string('billing_rhythm')->nullable();
            // Reconduction tacite.
            $table->boolean('tacit_renewal')->default(false);
            $table->string('status')->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_contracts');
    }
};
