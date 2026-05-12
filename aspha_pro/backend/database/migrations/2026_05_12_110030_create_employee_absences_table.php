<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('employee_absences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->nullable()->constrained('employees')->cascadeOnDelete();
            $table->foreignId('reason_id')->nullable()->constrained('absence_reasons')->restrictOnDelete();
            $table->string('entry_type')->nullable(); // 'absence', 'availability', 'unavailability', 'weekly_rest'
            $table->boolean('is_hourly')->default(false);
            $table->string('planning_action')->nullable(); // 'none', 'flag', 'reassign'
            $table->string('justification_status')->nullable(); // 'pending', 'justified', 'unjustified'
            $table->dateTime('start_datetime')->nullable();
            $table->float('duration_hours')->nullable();
            $table->boolean('is_periodic')->default(false);
            $table->date('start_date')->nullable();
            $table->boolean('is_full_day')->default(false);
            $table->time('start_time')->nullable();
            $table->time('end_time')->nullable();
            $table->string('frequency')->nullable(); // 'daily', 'weekly', 'monthly', 'yearly'
            $table->unsignedBigInteger('interval')->nullable();
            $table->string('days_of_week')->nullable();
            $table->boolean('exclude_school_holidays')->default(false);
            $table->boolean('exclude_public_holidays')->default(false);
            $table->string('end_type')->nullable(); // 'never', 'on_date', 'after_occurrences'
            $table->date('end_date')->nullable();
            $table->unsignedBigInteger('occurrences_count')->nullable();
            $table->boolean('transfer_prestation')->default(false);
            $table->text('comment')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_absences');
    }
};
