<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('service_assignments', function (Blueprint $table) {
            $table->id(); // ⭐ ID stable de la "période de service"
            $table->foreignId('client_id')->constrained('clients')->restrictOnDelete();
            $table->foreignId('client_address_id')->constrained('client_addresses')->restrictOnDelete();
            $table->foreignId('service_id')->constrained('services')->restrictOnDelete();
            $table->foreignId('default_employee_id')->nullable()->constrained('employees')->nullOnDelete();

            $table->enum('type', ['punctual', 'recurring']);
            $table->decimal('hourly_rate', 8, 2)->nullable(); // override sinon services.default
            $table->unsignedSmallInteger('duration_minutes');

            // Ponctuel
            $table->date('scheduled_date')->nullable();
            $table->time('scheduled_time')->nullable();

            // Récurrent
            $table->date('recurrence_start')->nullable();
            $table->date('recurrence_end')->nullable();
            $table->time('recurrence_time')->nullable();
            $table->text('recurrence_rule')->nullable(); // RRULE iCal: FREQ=WEEKLY;BYDAY=MO,WE

            $table->enum('status', ['active', 'paused', 'ended'])->default('active');
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['client_id', 'status']);
            $table->index(['default_employee_id', 'status']);
            $table->index('type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_assignments');
    }
};
