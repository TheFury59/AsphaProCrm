<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('reglements', function (Blueprint $table) {
            $table->id();
            $table->string('reference')->unique()->nullable();
            $table->string('type'); // 'reglement', 'prelevement_sepa'
            $table->string('status'); // 'received', 'pending', 'cancelled'
            $table->boolean('is_non_deductible')->default(false);
            $table->foreignId('client_id')->nullable()->constrained('clients')->restrictOnDelete();
            $table->foreignId('third_party_payer_id')->nullable()->constrained('third_party_payers')->restrictOnDelete();
            $table->foreignId('employee_id')->nullable()->constrained('employees')->restrictOnDelete();
            $table->foreignId('supplier_id')->nullable()->constrained('suppliers')->restrictOnDelete();
            $table->string('payment_method')->nullable(); // 'cash', 'check', 'card', 'transfer', 'cesu', 'sepa'
            $table->unsignedBigInteger('cesu_count')->nullable();
            $table->decimal('cesu_unit_price', 12, 2)->nullable();
            $table->foreignId('sepa_order_id')->nullable()->constrained('sepa_orders')->restrictOnDelete();
            $table->foreignId('sepa_mandate_id')->nullable()->constrained('sepa_mandates')->restrictOnDelete();
            $table->decimal('amount', 12, 2)->nullable();
            $table->string('ventilation_status')->nullable(); // 'unallocated', 'partial', 'allocated'
            $table->date('operation_date')->nullable();
            $table->date('value_date')->nullable();
            $table->foreignId('entity_id')->nullable()->constrained('entities')->restrictOnDelete();
            $table->foreignId('entity_bank_account_id')->nullable()->constrained('entity_bank_accounts')->restrictOnDelete();
            $table->text('description')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reglements');
    }
};
