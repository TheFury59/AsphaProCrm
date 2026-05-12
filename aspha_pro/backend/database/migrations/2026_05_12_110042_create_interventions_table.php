<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('interventions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->nullable()->constrained('clients')->restrictOnDelete();
            $table->foreignId('mission_id')->nullable()->constrained('missions')->restrictOnDelete();
            $table->foreignId('client_prestation_id')->nullable()->constrained('client_prestations')->restrictOnDelete();
            $table->foreignId('employee_id')->nullable()->constrained('employees')->restrictOnDelete();
            $table->boolean('is_recurring')->default(false); // false = ponctuelle, true = périodique
            $table->string('status'); // 'a_pourvoir', 'planifiee', 'realisee', 'annulee', 'draft', 'terminated'
            $table->boolean('is_group')->default(false); // intervention groupée
            $table->dateTime('start_datetime')->nullable();
            $table->dateTime('end_datetime')->nullable();
            $table->date('recurrence_start_date')->nullable();
            $table->time('start_time')->nullable();
            $table->time('end_time')->nullable();
            $table->string('frequency')->nullable(); // 'daily', 'weekly', 'monthly', 'yearly'
            $table->unsignedBigInteger('interval')->nullable();
            $table->string('days_of_week')->nullable(); // 'mon,tue,wed...'
            $table->boolean('exclude_holidays')->default(false);
            $table->boolean('exclude_school_holidays')->default(false);
            $table->string('end_type')->nullable(); // 'never', 'on_date', 'after_occurrences'
            $table->date('recurrence_end_date')->nullable();
            $table->unsignedBigInteger('occurrences_count')->nullable();
            $table->foreignId('next_intervention_id')->nullable()->constrained('interventions')->nullOnDelete(); // self-ref: nouvelle règle après modif périodicité
            $table->foreignId('parent_id')->nullable()->constrained('interventions')->nullOnDelete(); // FK to parent recurring intervention
            $table->boolean('is_exception')->default(false);
            $table->date('exception_date')->nullable(); // date de l'occurrence remplacée
            $table->foreignId('replacement_employee_id')->nullable()->constrained('employees')->restrictOnDelete(); // Intervenant remplaçant (badge à la place de employee_id)
            $table->string('replacement_reason')->nullable(); // Raison du remplacement (délai trop juste, absence, etc.)
            $table->boolean('is_paid')->default(false);
            $table->boolean('is_billed')->default(false);
            $table->boolean('bill_client')->default(false); // Facturer client
            $table->foreignId('adjustment_of_id')->nullable()->constrained('interventions')->nullOnDelete(); // self-ref for adjustment lines
            $table->text('comment')->nullable();
            $table->text('internal_comment')->nullable();
            $table->text('client_comment')->nullable();
            $table->text('employee_comment')->nullable();
            $table->string('transport_mode')->nullable();
            $table->string('vehicle_type')->nullable(); // 'personal', 'company' — renseigné après coup, pas à la création
            $table->boolean('is_transport_fixed')->default(false);
            $table->float('kms_done')->nullable();
            $table->float('kms_paid')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('interventions');
    }
};
