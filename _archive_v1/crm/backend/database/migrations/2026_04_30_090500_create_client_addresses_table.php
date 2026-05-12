<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('client_addresses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained('clients')->cascadeOnDelete();
            $table->string('label')->default('Adresse principale');
            $table->string('address_line1');
            $table->string('address_line2')->nullable();
            $table->string('postal_code', 16);
            $table->string('city');
            $table->string('country', 2)->default('FR');
            $table->decimal('geo_lat', 10, 7)->nullable();
            $table->decimal('geo_lng', 10, 7)->nullable();
            $table->text('access_notes')->nullable();
            $table->boolean('is_default')->default(false);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['client_id', 'is_default']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_addresses');
    }
};
