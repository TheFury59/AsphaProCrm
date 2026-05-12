<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('quotes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->nullable()->constrained('clients')->restrictOnDelete();
            $table->foreignId('quote_type_id')->constrained('quote_types')->restrictOnDelete();
            $table->foreignId('address_id')->nullable()->constrained('addresses')->restrictOnDelete();
            $table->foreignId('entity_id')->nullable()->constrained('entities')->restrictOnDelete();
            $table->foreignId('owner_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('nature')->nullable(); // 'regular', 'punctual'
            $table->date('quote_date')->nullable();
            $table->date('validity_date')->nullable();
            $table->string('billing_mode')->nullable();
            $table->string('quote_calculation')->nullable(); // 'per_week', 'per_month', 'per_unit'
            $table->date('consideration_date')->nullable();
            $table->string('commitment_duration')->nullable();
            $table->string('billing_rhythm')->nullable();
            $table->decimal('deposit_percent', 12, 2)->nullable();
            $table->boolean('has_pec')->default(false);
            $table->foreignId('pec_third_party_payer_id')->nullable()->constrained('third_party_payers')->restrictOnDelete();
            $table->string('pec_file_number')->nullable();
            $table->string('pec_status')->nullable(); // 'active', 'inactive'
            $table->string('pec_mode')->nullable();
            $table->string('pec_billing_rhythm')->nullable();
            $table->date('pec_validity_end')->nullable();
            $table->decimal('pec_base_rate', 12, 2)->nullable();
            $table->decimal('pec_coverage_percent', 12, 2)->nullable();
            $table->string('pec_ceiling_scope')->nullable(); // 'monthly', 'weekly'
            $table->decimal('pec_client_base_rate', 12, 2)->nullable();
            $table->string('pec_beyond_ceiling')->nullable(); // 'allowed', 'forbidden'
            $table->boolean('pec_detail_surcharges')->default(false);
            $table->string('pec_ceiling_type')->nullable(); // 'global', 'per_week'
            $table->decimal('pec_ceiling_hours', 12, 2)->nullable();
            $table->decimal('success_rate', 12, 2)->nullable();
            $table->date('desired_start_date')->nullable();
            $table->boolean('immediate_start')->default(false);
            $table->boolean('meeting_done')->default(false);
            $table->boolean('has_calendar_surcharges')->default(false);
            $table->boolean('has_night_surcharge')->default(false);
            $table->text('comment')->nullable();
            $table->string('status'); // 'draft', 'sent', 'accepted', 'refused', 'expired'
            $table->string('pennylane_id'); // ID du devis côté Pennylane (nullable)
            $table->dateTime('pennylane_synced_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quotes');
    }
};
