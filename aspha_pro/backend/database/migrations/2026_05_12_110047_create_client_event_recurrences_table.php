<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('client_event_recurrences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->nullable()->constrained('clients')->cascadeOnDelete();
            $table->foreignId('event_type_id')->nullable()->constrained('client_event_types')->restrictOnDelete();
            $table->foreignId('contact_id')->nullable()->constrained('related_contacts')->restrictOnDelete();
            $table->boolean('is_remote')->default(false);
            $table->string('address_type')->nullable(); // 'client', 'other'
            $table->foreignId('custom_address_id')->nullable()->constrained('addresses')->restrictOnDelete();
            $table->text('comment')->nullable();
            $table->date('start_date')->nullable();
            $table->time('start_time')->nullable();
            $table->time('end_time')->nullable();
            $table->string('frequency')->nullable(); // 'daily', 'weekly', 'monthly', 'yearly'
            $table->unsignedBigInteger('interval')->nullable();
            $table->string('days_of_week')->nullable();
            $table->boolean('exclude_school_holidays')->default(false);
            $table->boolean('exclude_public_holidays')->default(false);
            $table->string('end_type')->nullable(); // 'never', 'on_date', 'after_occurrences'
            $table->date('end_date')->nullable();
            $table->unsignedBigInteger('occurrences_count')->nullable();
            $table->string('status'); // 'draft', 'active', 'terminated'
            $table->foreignId('next_recurrence_id')->nullable()->constrained('client_event_recurrences')->nullOnDelete(); // self-ref after periodicity change
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_event_recurrences');
    }
};
