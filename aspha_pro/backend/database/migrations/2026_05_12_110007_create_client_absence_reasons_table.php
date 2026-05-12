<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('client_absence_reasons', function (Blueprint $table) {
            $table->id();
            $table->string('label'); // e.g. 'Hospitalisation', 'Congé', 'Autre'
            $table->string('status'); // 'active', 'inactive'
            $table->boolean('allow_indefinite_duration')->default(false);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_absence_reasons');
    }
};
