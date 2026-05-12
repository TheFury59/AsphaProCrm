<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('document_templates', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('type', 64); // contract, attestation, letter, …
            $table->string('file_path');
            $table->json('variables')->nullable(); // ex. {"client_name", "amount"}
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->morphs('documentable'); // documentable_type + documentable_id (auto-indexed)
            $table->string('name');
            $table->string('file_path');
            $table->string('mime_type', 128)->nullable();
            $table->unsignedInteger('size_bytes')->nullable();
            $table->foreignId('generated_from_template_id')->nullable()->constrained('document_templates')->nullOnDelete();
            $table->dateTime('expires_at')->nullable();
            $table->foreignId('uploaded_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index('expires_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('documents');
        Schema::dropIfExists('document_templates');
    }
};
