<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('km_indemnity_rates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('entity_id')->nullable()->constrained('entities')->restrictOnDelete(); // nullable = global
            $table->string('label'); // e.g. "Barème voiture 0.25€/km"
            $table->string('transport_mode')->nullable(); // 'car', 'bike', 'moto', 'other'
            $table->decimal('rate_per_km', 12, 2)->nullable();
            $table->string('status'); // 'active', 'inactive'
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('km_indemnity_rates');
    }
};
