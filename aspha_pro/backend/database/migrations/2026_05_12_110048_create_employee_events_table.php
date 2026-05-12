<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('employee_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->nullable()->constrained('employees')->cascadeOnDelete();
            $table->foreignId('contract_id')->constrained('contracts')->restrictOnDelete();
            $table->foreignId('event_type_id')->nullable()->constrained('employee_event_types')->restrictOnDelete();
            $table->date('event_date')->nullable();
            $table->unsignedBigInteger('duration_minutes')->nullable();
            $table->boolean('is_employee_paid')->default(false);
            $table->boolean('impacts_modulation')->default(false);
            $table->string('address_type')->nullable(); // 'entity', 'other'
            $table->foreignId('custom_address_id')->nullable()->constrained('addresses')->restrictOnDelete();
            $table->text('comment')->nullable();
            $table->text('employee_comment')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_events');
    }
};
