<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('client_event_types', function (Blueprint $table) {
            $table->id();
            $table->string('label');
            $table->string('status'); // 'active', 'inactive'
            $table->string('planning_color')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_event_types');
    }
};
