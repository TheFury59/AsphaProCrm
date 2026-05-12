<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('employee_event_types', function (Blueprint $table) {
            $table->id();
            $table->string('label');
            $table->string('status'); // 'active', 'inactive'
            $table->boolean('is_payable')->default(false);
            $table->boolean('impacts_modulation')->default(false); // default for events created with this type
            $table->string('base_type')->nullable(); // 'absence', 'event', 'training', 'rest'
            $table->boolean('exported_to_payroll')->default(false);
            $table->unsignedBigInteger('export_position')->nullable();
            $table->string('planning_color')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_event_types');
    }
};
