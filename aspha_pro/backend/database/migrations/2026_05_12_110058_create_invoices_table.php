<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->string('reference')->unique()->nullable(); // never deleted — incremental accounting ref
            $table->string('type'); // 'client', 'third_party', 'credit_note', 'manual'
            $table->foreignId('client_id')->nullable()->constrained('clients')->restrictOnDelete();
            $table->foreignId('mission_id')->nullable()->constrained('missions')->restrictOnDelete(); // for separate billing per mission
            $table->foreignId('third_party_payer_id')->nullable()->constrained('third_party_payers')->restrictOnDelete();
            $table->foreignId('entity_id')->nullable()->constrained('entities')->restrictOnDelete();
            $table->foreignId('billing_cycle_id')->nullable()->constrained('billing_cycles')->restrictOnDelete();
            $table->foreignId('intervention_address_id')->nullable()->constrained('addresses')->restrictOnDelete();
            $table->string('payment_mode')->nullable();
            $table->string('payment_status')->nullable(); // 'unpaid', 'partial', 'paid', 'loss'
            $table->string('send_mode')->nullable(); // 'email', 'mail', 'portal'
            $table->date('invoice_date')->nullable();
            $table->date('due_date')->nullable();
            $table->decimal('total', 12, 2)->nullable();
            $table->boolean('needs_recalculation')->default(false);
            $table->text('comment')->nullable();
            $table->string('status'); // 'draft', 'sent', 'cancelled', 'loss'
            $table->string('e_invoice_format')->nullable(); // 'factur-x', 'ubl', 'cii'
            $table->dateTime('e_invoice_sent_at')->nullable();
            $table->string('e_invoice_status')->nullable(); // 'pending', 'sent', 'acknowledged', 'rejected'
            $table->string('pennylane_id'); // ID de la facture côté Pennylane (nullable)
            $table->dateTime('pennylane_synced_at')->nullable(); // Dernière synchronisation Pennylane
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoices');
    }
};
