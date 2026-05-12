<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('product_price_tiers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->nullable()->constrained('products')->cascadeOnDelete();
            $table->decimal('from_quantity', 12, 2)->nullable(); // seuil à partir duquel ce tarif s'applique
            $table->decimal('price', 12, 2)->nullable(); // prix à ce palier
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_price_tiers');
    }
};
