<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('employee_event_recurrences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->nullable()->constrained('employees')->cascadeOnDelete();
            $table->foreignId('contract_id')->constrained('contracts')->restrictOnDelete();
            $table->foreignId('event_type_id')->nullable()->constrained('employee_event_types')->restrictOnDelete();
            $table->boolean('is_employee_paid')->default(false);
            $table->string('address_type')->nullable(); // 'entity', 'other'
            $table->foreignId('custom_address_id')->nullable()->constrained('addresses')->restrictOnDelete();
            $table->text('comment')->nullable();
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
            $table->string('transport_mode')->nullable();
            $table->boolean('is_transport_fixed')->default(false);
            $table->float('kms_done')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_event_recurrences');
    }
};
