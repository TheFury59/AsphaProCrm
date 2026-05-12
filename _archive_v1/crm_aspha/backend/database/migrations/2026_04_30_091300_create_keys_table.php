<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('keys', function (Blueprint $table) {
            $table->id();
            $table->string('code', 64)->unique();
            $table->foreignId('client_id')->constrained('clients')->restrictOnDelete();
            $table->foreignId('client_address_id')->nullable()->constrained('client_addresses')->nullOnDelete();
            $table->string('label')->nullable();
            $table->text('notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index('client_id');
        });

        Schema::create('key_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('key_id')->constrained('keys')->cascadeOnDelete();
            // Porteur polymorphique : employee / agency / safe / client
            $table->string('from_holder_type', 32)->nullable();
            $table->unsignedBigInteger('from_holder_id')->nullable();
            $table->string('to_holder_type', 32);
            $table->unsignedBigInteger('to_holder_id');
            $table->dateTime('moved_at');
            $table->foreignId('moved_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['key_id', 'moved_at']);
            $table->index(['to_holder_type', 'to_holder_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('key_movements');
        Schema::dropIfExists('keys');
    }
};
