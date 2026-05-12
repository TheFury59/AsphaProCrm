<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('contract_blocked_slots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('contract_id')->constrained('contracts')->cascadeOnDelete();
            $table->tinyInteger('day_of_week')->nullable(); // 0=lun, 1=mar, 2=mer, 3=jeu, 4=ven, 5=sam, 6=dim
            $table->time('slot_start')->nullable(); // début du créneau bloqué
            $table->time('slot_end')->nullable(); // fin du créneau bloqué
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contract_blocked_slots');
    }
};
