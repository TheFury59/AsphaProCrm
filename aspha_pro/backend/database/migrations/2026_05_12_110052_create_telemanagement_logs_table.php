<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('telemanagement_logs', function (Blueprint $table) {
            $table->id();
            $table->string('origin')->nullable(); // 'manual', 'mobile', 'landline'
            $table->string('event_type')->nullable(); // 'arrival', 'departure', 'unrecognized'
            $table->boolean('is_unrecognized')->default(false);
            $table->dateTime('called_at')->nullable();
            $table->foreignId('employee_id')->nullable()->constrained('employees')->restrictOnDelete();
            $table->foreignId('client_id')->nullable()->constrained('clients')->restrictOnDelete();
            $table->foreignId('intervention_id')->nullable()->constrained('interventions')->restrictOnDelete(); // Intervention liée au badgeage
            $table->string('intervention_quality')->nullable(); // 'good', 'average', 'bad'
            $table->text('comment')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('telemanagement_logs');
    }
};
