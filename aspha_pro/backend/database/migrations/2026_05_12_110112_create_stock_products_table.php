<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('stock_products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('entity_id')->nullable()->constrained('entities')->restrictOnDelete(); // Chaque entité a son propre stock
            $table->foreignId('category_id')->nullable()->constrained('stock_categories')->restrictOnDelete();
            $table->string('name');
            $table->string('reference')->nullable();
            $table->string('unit')->nullable(); // 'unit', 'liter', 'kg', 'pack'
            $table->unsignedBigInteger('alert_threshold')->nullable(); // Seuil d'alerte commande
            $table->unsignedBigInteger('current_quantity')->nullable(); // Quantité actuelle
            $table->string('status'); // 'active', 'inactive'
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_products');
    }
};
