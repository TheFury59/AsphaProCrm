<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('related_contacts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->nullable()->constrained('clients')->cascadeOnDelete();
            $table->string('type'); // 'family', 'doctor', 'emergency'
            $table->string('name');
            $table->string('phone')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('related_contacts');
    }
};
