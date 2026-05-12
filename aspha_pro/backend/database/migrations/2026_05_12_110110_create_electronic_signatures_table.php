<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('electronic_signatures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained('documents')->restrictOnDelete(); // Document à signer
            $table->string('signer_type')->nullable(); // 'client', 'employee'
            $table->unsignedBigInteger('signer_id');
            $table->dateTime('signed_at')->nullable();
            $table->string('signature_token')->nullable(); // Token unique de validation
            $table->string('ip_address')->nullable();
            $table->string('status'); // 'pending', 'signed', 'refused', 'expired'
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('electronic_signatures');
    }
};
