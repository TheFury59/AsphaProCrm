<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('notification_preferences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->cascadeOnDelete();
            $table->foreignId('notification_type_id')->constrained('notification_types')->restrictOnDelete();
            $table->boolean('via_push')->default(false); // Notification in-app / mobile
            $table->boolean('via_email')->default(false);
            $table->boolean('via_sms')->default(false);
            $table->boolean('is_enabled')->default(false); // Peut désactiver ce type entièrement
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_preferences');
    }
};
