<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('qr_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_address_id')->unique()->constrained('client_addresses')->cascadeOnDelete();
            $table->string('code', 64)->unique(); // token URL-safe
            $table->boolean('is_active')->default(true);
            $table->dateTime('generated_at');
            $table->dateTime('last_scanned_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('qr_codes');
    }
};
