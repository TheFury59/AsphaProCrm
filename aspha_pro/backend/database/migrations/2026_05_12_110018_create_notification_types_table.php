<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('notification_types', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique(); // e.g. 'intervention_assigned', 'absence_created', 'stock_alert'
            $table->string('label');
            $table->string('module')->nullable(); // 'planning', 'rh', 'stock', 'portal', 'telemanagement'
            $table->string('default_channels')->nullable(); // 'push,email,sms' — canaux par défaut
            $table->string('status'); // 'active', 'inactive'
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_types');
    }
};
