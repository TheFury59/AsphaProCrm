<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('matching_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('recurrence_id')->constrained('interventions')->restrictOnDelete();
            $table->foreignId('intervention_id')->nullable()->constrained('interventions')->restrictOnDelete();
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('assignment_type')->nullable(); // 'definitive', 'temporary'
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->string('status'); // 'pending', 'assigned', 'cancelled'
            $table->foreignId('selected_employee_id')->nullable()->constrained('employees')->restrictOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('matching_requests');
    }
};
