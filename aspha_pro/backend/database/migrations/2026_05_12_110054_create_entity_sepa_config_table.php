<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('entity_sepa_config', function (Blueprint $table) {
            $table->id();
            $table->foreignId('entity_id')->nullable()->unique()->constrained('entities')->restrictOnDelete();
            $table->string('bank_norm')->nullable(); // 'sepa', 'cfonb', 'mixed'
            $table->boolean('show_contract_info_on_mandate')->default(false);
            $table->boolean('show_entity_address_on_mandate')->default(false);
            $table->boolean('omit_bic')->default(false);
            $table->boolean('use_smnda_on_bank_change')->default(false);
            $table->boolean('has_intermediate_creditor')->default(false);
            $table->string('intermediate_creditor_name')->nullable();
            $table->string('intermediate_creditor_iban')->nullable();
            $table->boolean('use_due_date_as_operation_date')->default(false);
            $table->boolean('use_ddfip_format')->default(false);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('entity_sepa_config');
    }
};
