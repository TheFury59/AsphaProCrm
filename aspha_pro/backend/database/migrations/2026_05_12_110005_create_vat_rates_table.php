<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('vat_rates', function (Blueprint $table) {
            $table->id();
            $table->string('label'); // e.g. "TVA 20%", "TVA 5.5%"
            $table->decimal('rate', 12, 2)->nullable(); // e.g. 20.00
            $table->string('status'); // 'active', 'inactive'
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vat_rates');
    }
};
