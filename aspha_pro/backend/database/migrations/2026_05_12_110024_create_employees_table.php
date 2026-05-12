<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('employees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->unique()->constrained('users')->nullOnDelete();
            $table->foreignId('entity_id')->nullable()->constrained('entities')->restrictOnDelete();
            $table->unsignedBigInteger('owner_user_id'); // gestionnaire du dossier intervenant
            $table->string('name');
            $table->string('phone')->nullable();
            $table->string('classification')->nullable(); // 'non_cadre', 'cadre'
            $table->string('transport_mode')->nullable(); // Mode de déplacement principal
            $table->boolean('has_company_vehicle')->default(false); // Véhicule de service à temps plein (jamais véhicule perso)
            $table->text('diploma')->nullable(); // Diplômes (champ libre)
            $table->text('job_reference_free')->nullable(); // Emploi repère (champ libre)
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employees');
    }
};
