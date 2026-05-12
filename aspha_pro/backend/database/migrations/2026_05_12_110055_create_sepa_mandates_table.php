<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('sepa_mandates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->nullable()->constrained('clients')->restrictOnDelete();
            $table->foreignId('entity_id')->nullable()->constrained('entities')->restrictOnDelete();
            $table->foreignId('entity_bank_account_id')->nullable()->constrained('entity_bank_accounts')->restrictOnDelete();
            $table->foreignId('debtor_bank_account_id')->nullable()->constrained('bank_accounts')->restrictOnDelete();
            $table->string('mandate_reference')->unique()->nullable(); // RUM
            $table->string('creditor_id'); // ICS
            $table->text('contract_description')->nullable();
            $table->date('signed_at')->nullable();
            $table->string('sequence_type')->nullable(); // 'FRST', 'RCUR', 'OOFF', 'FNAL'
            $table->string('status'); // 'active', 'cancelled', 'expired'
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sepa_mandates');
    }
};
