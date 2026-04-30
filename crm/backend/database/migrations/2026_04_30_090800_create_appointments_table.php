<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('appointments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('service_assignment_id')->constrained('service_assignments')->cascadeOnDelete();
            $table->foreignId('employee_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->foreignId('client_address_id')->constrained('client_addresses')->restrictOnDelete();

            $table->dateTime('scheduled_start');
            $table->dateTime('scheduled_end');
            $table->dateTime('actual_start')->nullable(); // rempli par QR scan check_in
            $table->dateTime('actual_end')->nullable();   // rempli par QR scan check_out

            $table->enum('status', ['planned', 'done', 'cancelled', 'no_show'])->default('planned');
            $table->boolean('paid_to_employee')->default(true);
            $table->boolean('invoiced_to_client')->default(true);
            $table->text('admin_notes')->nullable();

            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('last_modified_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['scheduled_start', 'scheduled_end']);
            $table->index(['employee_id', 'scheduled_start']);
            $table->index(['service_assignment_id']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('appointments');
    }
};
