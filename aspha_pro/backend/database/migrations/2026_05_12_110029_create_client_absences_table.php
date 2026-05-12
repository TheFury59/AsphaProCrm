<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('client_absences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->nullable()->constrained('clients')->cascadeOnDelete();
            $table->foreignId('reason_id')->nullable()->constrained('client_absence_reasons')->restrictOnDelete();
            $table->boolean('is_hourly')->default(false); // TypeHoraireJournalier
            $table->string('planning_action')->nullable(); // 'cancel', 'delete', 'nothing'
            $table->text('comment')->nullable();
            $table->dateTime('start_datetime')->nullable();
            $table->float('duration_hours')->nullable();
            $table->boolean('is_periodic')->default(false);
            $table->date('start_date')->nullable();
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
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_absences');
    }
};
