<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('quality_controls', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->nullable()->constrained('clients')->cascadeOnDelete();
            $table->foreignId('controlled_by')->nullable()->constrained('users')->nullOnDelete(); // user_id
            $table->dateTime('control_date')->nullable();
            $table->string('result')->nullable(); // 'satisfactory', 'needs_improvement', 'unsatisfactory'
            $table->text('comment')->nullable();
            $table->date('next_control_date')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quality_controls');
    }
};
