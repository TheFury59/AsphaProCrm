<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('quote_surcharge_rules', function (Blueprint $table) {
            $table->foreignId('quote_id')->nullable()->constrained('quotes')->cascadeOnDelete();
            $table->foreignId('surcharge_rule_id')->constrained('surcharge_rules')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quote_surcharge_rules');
    }
};
