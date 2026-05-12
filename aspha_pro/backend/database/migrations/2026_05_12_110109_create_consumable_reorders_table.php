<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('consumable_reorders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->nullable()->constrained('clients')->cascadeOnDelete();
            $table->foreignId('stock_product_id')->nullable()->constrained('stock_products')->restrictOnDelete(); // Produit demandé
            $table->unsignedBigInteger('quantity_requested')->nullable();
            $table->text('comment')->nullable();
            $table->string('status'); // 'pending', 'approved', 'delivered'
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('consumable_reorders');
    }
};
