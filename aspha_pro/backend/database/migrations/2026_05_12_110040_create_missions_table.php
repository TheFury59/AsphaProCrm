<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('missions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->nullable()->constrained('clients')->restrictOnDelete();
            $table->foreignId('quote_id')->nullable()->constrained('quotes')->restrictOnDelete();
            $table->string('name');
            $table->string('status'); // 'active', 'suspended', 'cancelled'
            $table->boolean('no_intervention_no_bill')->default(false);
            $table->string('payment_methods')->nullable();
            $table->boolean('online_payment_enabled')->default(false); // Intégration CB en ligne (module futur)
            $table->string('billing_rhythm')->nullable(); // Rythme de facturation
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('missions');
    }
};
