<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->morphs('owner');
            $table->string('file_path')->nullable();
            $table->string('label');
            $table->string('document_type')->nullable(); // 'contract', 'invoice', 'insurance', 'product_sheet', 'protocol', 'other'
            $table->boolean('is_client_visible')->default(false); // Visible dans le portail client
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('documents');
    }
};
