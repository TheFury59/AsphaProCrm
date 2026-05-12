<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('stock_inventory_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventory_id')->constrained('stock_inventories')->cascadeOnDelete();
            $table->foreignId('stock_product_id')->nullable()->constrained('stock_products')->restrictOnDelete();
            $table->unsignedBigInteger('expected_quantity')->nullable(); // Quantité théorique
            $table->unsignedBigInteger('actual_quantity')->nullable(); // Quantité comptée
            $table->unsignedBigInteger('gap')->nullable(); // Écart (calculé)
            $table->text('comment')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_inventory_lines');
    }
};
