<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('absence_reasons', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('label');
            $table->string('acronym')->nullable();
            $table->boolean('is_paid')->default(false);
            $table->boolean('is_secondary')->default(false);
            $table->string('status'); // 'active', 'inactive'
            $table->string('color')->nullable();
            $table->text('description')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('absence_reasons');
    }
};
