<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stock_product_id')->nullable()->constrained('stock_products')->restrictOnDelete();
            $table->string('movement_type')->nullable(); // 'in', 'out', 'adjustment'
            $table->unsignedBigInteger('quantity')->nullable();
            $table->string('reason')->nullable(); // 'reorder', 'usage', 'loss', 'inventory_adjustment'
            $table->unsignedBigInteger('reference_id'); // FK optionnelle vers consumable_reorders si réassort
            $table->foreignId('done_by')->nullable()->constrained('users')->nullOnDelete(); // user_id
            $table->dateTime('movement_date');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
    }
};
