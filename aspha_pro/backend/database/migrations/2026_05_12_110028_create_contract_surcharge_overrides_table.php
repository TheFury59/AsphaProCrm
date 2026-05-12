<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('contract_surcharge_overrides', function (Blueprint $table) {
            $table->id();
            $table->foreignId('contract_id')->constrained('contracts')->cascadeOnDelete();
            $table->foreignId('surcharge_rule_id')->constrained('surcharge_rules')->restrictOnDelete();
            $table->decimal('custom_rate', 12, 2)->nullable();
            $table->string('custom_rate_type')->nullable(); // 'percentage', 'flat'
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contract_surcharge_overrides');
    }
};
