<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('qr_scans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('appointment_id')->constrained('appointments')->cascadeOnDelete();
            $table->foreignId('qr_code_id')->constrained('qr_codes')->restrictOnDelete();
            $table->foreignId('employee_id')->constrained('employees')->restrictOnDelete();
            $table->dateTime('scanned_at');
            $table->enum('scan_type', ['check_in', 'check_out']);
            $table->decimal('geo_lat', 10, 7)->nullable();
            $table->decimal('geo_lng', 10, 7)->nullable();
            $table->dateTime('offline_synced_at')->nullable();
            $table->json('raw_payload')->nullable();
            $table->timestamps();

            $table->index(['appointment_id', 'scan_type']);
            $table->index(['employee_id', 'scanned_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('qr_scans');
    }
};
