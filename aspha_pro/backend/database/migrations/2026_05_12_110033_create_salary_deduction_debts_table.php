<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('salary_deduction_debts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('salary_deduction_id')->constrained('salary_deductions')->cascadeOnDelete();
            $table->string('type');
            $table->boolean('is_alimony_calculated')->default(false);
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->unsignedBigInteger('priority')->nullable();
            $table->decimal('total_due', 12, 2)->nullable();
            $table->decimal('partial_release_amount', 12, 2)->nullable();
            $table->decimal('amount_paid', 12, 2)->nullable();
            $table->decimal('balance', 12, 2)->nullable();
            $table->date('full_release_date')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('salary_deduction_debts');
    }
};
