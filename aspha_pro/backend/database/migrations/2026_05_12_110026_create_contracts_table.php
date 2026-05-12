<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('contracts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->nullable()->constrained('employees')->restrictOnDelete();
            $table->foreignId('entity_id')->nullable()->constrained('entities')->restrictOnDelete();
            $table->string('position')->nullable(); // Poste
            $table->string('intervention_zone')->nullable(); // Zone d'intervention
            $table->string('contract_type')->nullable(); // 'cdi', 'cdd', 'stage'
            $table->string('activity_modality')->nullable();
            $table->boolean('is_cdi_inclusion')->default(false);
            $table->string('cdd_reason')->nullable();
            $table->boolean('cdd_imprecise_term')->default(false);
            $table->date('end_date')->nullable();
            $table->boolean('precarity_payment')->default(false);
            $table->string('tutor_name')->nullable();
            $table->boolean('is_mandatory_internship')->default(false);
            $table->date('start_date')->nullable();
            $table->boolean('trial_period')->default(false);
            $table->date('trial_start')->nullable();
            $table->date('trial_end')->nullable();
            $table->boolean('trial_renewed')->default(false);
            $table->date('first_intervention_date')->nullable();
            $table->date('sent_date')->nullable();
            $table->date('signed_date')->nullable();
            $table->date('dpae_date')->nullable();
            $table->boolean('is_non_salarie')->default(false);
            $table->string('medical_visit_address_type')->nullable(); // 'entity', 'other'
            $table->foreignId('medical_visit_address_id')->nullable()->constrained('addresses')->restrictOnDelete();
            $table->string('work_time_type')->nullable(); // 'full_time', 'part_time'
            $table->float('monthly_duration')->nullable(); // Durée mensuelle (heures)
            $table->float('weekly_duration')->nullable(); // Durée hebdomadaire (heures)
            $table->string('pay_mode')->nullable(); // 'monthly_salary', 'hourly_salary'
            $table->decimal('monthly_salary', 12, 2)->nullable();
            $table->decimal('hourly_rate', 12, 2)->nullable();
            $table->decimal('km_rate_inter_vacation', 12, 2)->nullable(); // Taux €/km entre clients (inter-vacation)
            $table->decimal('km_rate_intervention', 12, 2)->nullable(); // Taux €/km pendant l'intervention (courses, etc.)
            $table->string('qualification')->nullable();
            $table->string('employee_status')->nullable(); // 'non_cadre', 'cadre'
            $table->date('seniority_date')->nullable();
            $table->string('profession_code')->nullable();
            $table->string('socio_professional_category')->nullable();
            $table->string('conventional_categorical_status')->nullable();
            $table->string('conventional_classification')->nullable();
            $table->boolean('non_compete_clause')->default(false);
            $table->boolean('is_accre_beneficiary')->default(false);
            $table->boolean('is_mandatory_internship_school')->default(false); // stage only
            $table->string('geographic_zone')->nullable(); // 'france_metro', 'alsace_moselle', 'dom'
            $table->tinyInteger('working_days_mask')->nullable(); // bitmask lun→dim (bit0=lun … bit6=dim)
            $table->boolean('is_night_worker')->default(false);
            $table->boolean('is_office_staff')->default(false);
            $table->boolean('subject_to_mobility_contribution')->default(false);
            $table->string('public_holidays_worked')->nullable(); // 'never', 'always', 'sometimes'
            $table->boolean('real_payment')->default(false);
            $table->boolean('multiple_employers')->default(false);
            $table->boolean('rural_territory_exemption')->default(false);
            $table->boolean('part_time_full_contribution')->default(false);
            $table->string('cp_payment_mode')->nullable();
            $table->decimal('cp_days_current_month', 12, 2)->nullable();
            $table->string('population_code')->nullable();
            $table->string('prudhommal_code')->nullable();
            $table->smallInteger('penibility_exposure_mask')->nullable();
            $table->string('health_insurance')->nullable(); // 'none', etc.
            $table->string('health_insurance_reason')->nullable();
            $table->text('comment')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contracts');
    }
};
