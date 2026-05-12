<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('invoice_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained('invoices')->cascadeOnDelete();
            $table->foreignId('client_prestation_id')->nullable()->constrained('client_prestations')->restrictOnDelete();
            $table->foreignId('intervention_id')->nullable()->constrained('interventions')->restrictOnDelete();
            $table->string('item_type')->nullable(); // 'hourly', 'forfait', 'frais', 'remise', 'produit', 'carte', 'adjustment'
            $table->string('label');
            $table->decimal('quantity', 12, 2)->nullable(); // decimal to handle fractional hours
            $table->decimal('unit_price', 12, 2)->nullable();
            $table->decimal('total', 12, 2)->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoice_items');
    }
};
