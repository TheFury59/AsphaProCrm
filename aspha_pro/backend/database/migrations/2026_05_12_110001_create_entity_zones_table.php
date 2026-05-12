<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('entity_zones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('entity_id')->nullable()->constrained('entities')->restrictOnDelete();
            $table->string('label'); // e.g. "Zone Nord", "Zone Centre-ville"
            $table->float('center_latitude')->nullable(); // centre de la zone
            $table->float('center_longitude')->nullable();
            $table->float('radius_km')->nullable(); // rayon de couverture en km
            $table->string('status'); // 'active', 'inactive'
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('entity_zones');
    }
};
