<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('stock_inventories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('entity_id')->nullable()->constrained('entities')->restrictOnDelete();
            $table->foreignId('done_by')->nullable()->constrained('users')->nullOnDelete(); // user_id
            $table->date('inventory_date')->nullable();
            $table->text('comment')->nullable();
            $table->string('status'); // 'draft', 'validated'
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_inventories');
    }
};
