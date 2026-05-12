<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('surcharge_rules', function (Blueprint $table) {
            $table->id();
            $table->string('label');
            $table->string('type'); // 'night', 'weekend', 'holiday', 'calendar'
            $table->decimal('rate', 12, 2)->nullable();
            $table->string('rate_type')->nullable(); // 'percentage', 'flat'
            $table->time('applies_from')->nullable();
            $table->time('applies_to')->nullable();
            $table->string('status'); // 'active', 'inactive'
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('surcharge_rules');
    }
};
