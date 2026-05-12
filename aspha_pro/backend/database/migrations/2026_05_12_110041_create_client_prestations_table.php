<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('client_prestations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->nullable()->constrained('clients')->cascadeOnDelete();
            $table->foreignId('mission_id')->nullable()->constrained('missions')->restrictOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->restrictOnDelete(); // Produit du catalogue
            $table->foreignId('quote_id')->nullable()->constrained('quotes')->restrictOnDelete();
            $table->string('label');
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->string('billing_type')->nullable(); // 'hourly', 'forfait', 'frais', 'remise', 'carte', 'exceptional'
            $table->string('pricing_type')->nullable(); // 'default', 'custom'
            $table->decimal('custom_price', 12, 2)->nullable();
            $table->decimal('base_price', 12, 2)->nullable();
            $table->boolean('no_intervention_no_bill')->default(false);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_prestations');
    }
};
