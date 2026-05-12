<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Flotte de véhicules (Phase 9).
 *
 * 4 tables :
 *  - vehicles : fiche véhicule (immatriculation, marque/modèle, dates d'achat, kilométrage)
 *  - vehicle_assignments : attribution à un intervenant sur une période
 *  - vehicle_maintenances : entretiens (révision, contrôle technique, etc.)
 *  - vehicle_incidents : sinistres (accident, vol, panne)
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('vehicles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('entity_id')->nullable()->constrained('entities')->restrictOnDelete();
            $table->string('license_plate')->unique();
            $table->string('brand')->nullable();
            $table->string('model')->nullable();
            $table->year('year')->nullable();
            $table->string('fuel_type')->nullable();  // gasoline | diesel | electric | hybrid
            $table->date('purchase_date')->nullable();
            $table->date('insurance_expires_at')->nullable();
            $table->date('next_inspection_at')->nullable();
            $table->unsignedInteger('current_mileage')->default(0);
            $table->string('status')->default('active');  // active | maintenance | sold | scrapped
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('vehicle_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_id')->constrained('vehicles')->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->date('start_date');
            $table->date('end_date')->nullable();  // null = en cours
            $table->unsignedInteger('start_mileage')->nullable();
            $table->unsignedInteger('end_mileage')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('vehicle_maintenances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_id')->constrained('vehicles')->cascadeOnDelete();
            $table->string('type');  // revision | inspection | tire | oil_change | repair | other
            $table->date('performed_at');
            $table->unsignedInteger('mileage')->nullable();
            $table->decimal('cost', 10, 2)->nullable();
            $table->string('provider')->nullable();  // garagiste / centre auto
            $table->text('description')->nullable();
            $table->date('next_due_at')->nullable();
            $table->timestamps();
        });

        Schema::create('vehicle_incidents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_id')->constrained('vehicles')->cascadeOnDelete();
            $table->foreignId('employee_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->dateTime('incident_at');
            $table->string('type');  // accident | breakdown | theft | vandalism | other
            $table->string('severity')->default('minor');  // minor | moderate | major
            $table->text('description');
            $table->decimal('repair_cost', 10, 2)->nullable();
            $table->string('insurance_claim_ref')->nullable();
            $table->string('status')->default('open');  // open | in_repair | resolved | written_off
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_incidents');
        Schema::dropIfExists('vehicle_maintenances');
        Schema::dropIfExists('vehicle_assignments');
        Schema::dropIfExists('vehicles');
    }
};
