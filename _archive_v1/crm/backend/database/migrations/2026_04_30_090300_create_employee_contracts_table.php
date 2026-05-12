<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('employee_contracts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->string('position');
            $table->decimal('weekly_hours', 5, 2);
            $table->unsignedSmallInteger('vacation_days_per_year')->default(25);
            $table->decimal('hourly_gross_rate', 8, 2)->nullable();
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->boolean('is_current')->default(true);
            $table->enum('contract_type', ['cdi', 'cdd', 'interim', 'other'])->default('cdi');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['employee_id', 'is_current']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_contracts');
    }
};
