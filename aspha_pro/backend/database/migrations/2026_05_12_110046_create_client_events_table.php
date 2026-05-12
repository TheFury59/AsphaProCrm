<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('client_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->nullable()->constrained('clients')->cascadeOnDelete();
            $table->foreignId('event_type_id')->nullable()->constrained('client_event_types')->restrictOnDelete();
            $table->foreignId('contact_id')->nullable()->constrained('related_contacts')->restrictOnDelete();
            $table->dateTime('date')->nullable();
            $table->unsignedBigInteger('duration_minutes')->nullable();
            $table->boolean('is_cancelled')->default(false); // keep trace even if cancelled
            $table->boolean('is_remote')->default(false); // A distance
            $table->string('address_type')->nullable(); // 'client', 'other'
            $table->foreignId('custom_address_id')->nullable()->constrained('addresses')->restrictOnDelete();
            $table->text('comment')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_events');
    }
};
