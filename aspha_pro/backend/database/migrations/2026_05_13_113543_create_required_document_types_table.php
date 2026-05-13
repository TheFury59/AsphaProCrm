<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Référentiel paramétrable des types de documents requis sur fiche intervenant.
 *
 *  - label : ex "Carte d'identité recto/verso", "RIB", "Contrat de travail signé"
 *  - applies_to : 'all' | 'cadre' | 'non_cadre' (filtre selon la classification employee)
 *  - is_mandatory : si true, génère une alerte rouge si manquant
 *
 * La détection "manquant" se fait en cherchant si l'employé a un document
 * polymorphique avec category_label correspondant.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('required_document_types', function (Blueprint $table) {
            $table->id();
            $table->string('label');
            $table->string('category_match')->nullable();  // valeur à matcher dans documents.category (ex: 'cni')
            $table->string('applies_to')->default('all');   // all | cadre | non_cadre
            $table->boolean('is_mandatory')->default(true);
            $table->text('description')->nullable();
            $table->integer('display_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('required_document_types');
    }
};
