<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('creditor_contacts', function (Blueprint $table) {
            $table->id();
            $table->string('first_name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('type');
            $table->string('office_phone')->nullable();
            $table->string('mobile_phone')->nullable();
            $table->string('home_phone')->nullable();
            $table->string('email')->nullable();
            $table->boolean('newsletter_subscribed')->default(false);
            $table->string('postal_code')->nullable();
            $table->string('city')->nullable();
            $table->string('company')->nullable();
            $table->string('role')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('creditor_contacts');
    }
};
