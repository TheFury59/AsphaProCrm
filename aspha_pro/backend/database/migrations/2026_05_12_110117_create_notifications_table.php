<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete(); // Destinataire
            $table->foreignId('notification_type_id')->constrained('notification_types')->restrictOnDelete();
            $table->string('title')->nullable();
            $table->text('body')->nullable();
            $table->string('target_type')->nullable(); // 'intervention', 'absence', 'stock_product', 'client_request', etc.
            $table->unsignedBigInteger('target_id');
            $table->string('channel')->nullable(); // 'push', 'email', 'sms'
            $table->boolean('is_read')->default(false);
            $table->dateTime('read_at')->nullable();
            $table->dateTime('sent_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
