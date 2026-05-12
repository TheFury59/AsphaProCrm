<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('quote_types', function (Blueprint $table) {
            $table->id();
            $table->foreignId('entity_id')->nullable()->constrained('entities')->restrictOnDelete();
            $table->string('label');
            $table->string('modality')->nullable();
            $table->string('nature')->nullable(); // 'regular', 'punctual'
            $table->string('billing_mode')->nullable();
            $table->string('quote_calculation')->nullable(); // 'per_week', 'per_month', 'per_unit'
            $table->string('commitment_duration')->nullable(); // '1_month', '2_months', 'indefinite'
            $table->string('billing_rhythm')->nullable();
            $table->decimal('deposit_percent', 12, 2)->nullable();
            $table->string('status'); // 'active', 'inactive'
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quote_types');
    }
};
