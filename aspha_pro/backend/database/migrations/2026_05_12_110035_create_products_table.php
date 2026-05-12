<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('status'); // 'active', 'inactive'
            $table->string('name');
            $table->foreignId('entity_id')->nullable()->constrained('entities')->restrictOnDelete(); // entité propriétaire (nullable = global)
            $table->string('type'); // 'hourly', 'forfait', 'frais', 'remise', 'carte', 'exceptional'
            $table->string('nature')->nullable(); // 'regular', 'punctual'
            $table->string('billing_mode')->nullable(); // 'per_intervention', 'per_month', 'per_week', 'per_unit'
            $table->foreignId('category_id')->nullable()->constrained('product_categories')->restrictOnDelete();
            $table->unsignedBigInteger('default_duration_minutes')->nullable(); // Durée standard
            $table->boolean('has_degressive_pricing')->default(false); // Tarif dégressif
            $table->decimal('price', 12, 2)->nullable(); // Prix HT
            $table->decimal('cost', 12, 2)->nullable(); // Coût
            $table->foreignId('vat_rate_id')->nullable()->constrained('vat_rates')->restrictOnDelete();
            $table->boolean('amount_incl_tax')->default(false); // true = TTC, false = HT
            $table->boolean('specific_rates_forbidden')->default(false); // Tarifs spécifiques interdits
            $table->string('accounting_code')->nullable(); // Code comptable
            $table->string('chapter')->nullable(); // Chapitre
            $table->text('description')->nullable();
            $table->foreignId('medical_visit_address_id')->nullable()->constrained('addresses')->restrictOnDelete(); // Adresse des visites médicales (nullable)
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
