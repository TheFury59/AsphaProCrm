<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('job_references', function (Blueprint $table) {
            $table->id();
            $table->string('label');
            $table->string('classification')->nullable(); // 'non_cadre', 'cadre'
            $table->unsignedBigInteger('level')->nullable();
            $table->string('status'); // 'active', 'inactive'
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('job_references');
    }
};
