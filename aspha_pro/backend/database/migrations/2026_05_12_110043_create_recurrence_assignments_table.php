<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('recurrence_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('recurrence_id')->constrained('interventions')->cascadeOnDelete();
            $table->foreignId('employee_id')->nullable()->constrained('employees')->restrictOnDelete();
            $table->string('assignment_type')->nullable(); // 'definitive', 'temporary'
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable(); // NULL for definitive
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recurrence_assignments');
    }
};
