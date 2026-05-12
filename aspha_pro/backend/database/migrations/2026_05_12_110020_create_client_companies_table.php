<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('client_companies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->nullable()->unique()->constrained('clients')->cascadeOnDelete();
            $table->string('company_name')->nullable(); // Nom de l'entreprise (remplace nom de famille)
            $table->string('legal_form')->nullable(); // Forme juridique
            $table->string('siret')->nullable(); // N° SIRET (remplace N° sécurité sociale)
            $table->string('vat_number')->nullable(); // N° TVA
            $table->string('manager_civility')->nullable(); // Civilité du gérant
            $table->string('manager_first_name')->nullable(); // Prénom du gérant
            $table->string('manager_last_name')->nullable(); // Nom du gérant
            $table->string('manager_role')->nullable(); // Rôle du gérant
            $table->string('phone_landline')->nullable(); // Téléphone fixe
            $table->string('phone_mobile')->nullable(); // Téléphone portable
            $table->string('primary_email')->nullable(); // Email prioritaire de la société
            $table->string('photo')->nullable(); // Photo (facilite reconnaissance des lieux)
            $table->boolean('allow_duplicate')->default(false); // Autoriser doublon (client avec plusieurs SIRET)
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_companies');
    }
};
