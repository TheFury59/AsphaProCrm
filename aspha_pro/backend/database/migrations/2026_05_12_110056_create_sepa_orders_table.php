<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('sepa_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('entity_id')->nullable()->constrained('entities')->restrictOnDelete();
            $table->foreignId('entity_bank_account_id')->nullable()->constrained('entity_bank_accounts')->restrictOnDelete();
            $table->string('lot_number')->unique()->nullable();
            $table->date('operation_date')->nullable();
            $table->decimal('total_amount', 12, 2)->nullable();
            $table->string('format')->nullable(); // 'sepa', 'cfonb', 'ddfip'
            $table->string('status'); // 'generated', 'sent', 'cancelled'
            $table->string('file_path')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sepa_orders');
    }
};
