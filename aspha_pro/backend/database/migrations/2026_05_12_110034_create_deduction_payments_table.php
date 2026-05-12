<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('deduction_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('salary_deduction_id')->constrained('salary_deductions')->cascadeOnDelete();
            $table->decimal('amount', 12, 2)->nullable();
            $table->dateTime('paid_at')->nullable();
            $table->string('method')->nullable();
            $table->text('note')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('deduction_payments');
    }
};
