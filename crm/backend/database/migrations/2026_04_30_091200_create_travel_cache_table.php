<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('travel_cache', function (Blueprint $table) {
            $table->id();
            $table->foreignId('from_address_id')->constrained('client_addresses')->cascadeOnDelete();
            $table->foreignId('to_address_id')->constrained('client_addresses')->cascadeOnDelete();
            $table->unsignedInteger('duration_seconds');
            $table->unsignedInteger('distance_meters');
            $table->enum('mode', ['driving', 'walking', 'transit'])->default('driving');
            $table->dateTime('cached_at');
            $table->timestamps();

            $table->unique(['from_address_id', 'to_address_id', 'mode'], 'travel_cache_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('travel_cache');
    }
};
