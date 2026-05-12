<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('key_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('key_id')->constrained('keys')->cascadeOnDelete();
            $table->string('from_holder')->nullable();
            $table->string('to_holder')->nullable();
            $table->dateTime('date')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('key_movements');
    }
};
