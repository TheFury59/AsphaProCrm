<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('client_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->nullable()->constrained('clients')->cascadeOnDelete();
            $table->string('type'); // 'complaint', 'problem_report', 'consumable_reorder'
            $table->string('subject')->nullable();
            $table->text('body')->nullable();
            $table->string('status'); // 'open', 'in_progress', 'resolved', 'closed'
            $table->string('priority')->nullable(); // 'low', 'normal', 'high', 'urgent'
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete(); // user_id du gestionnaire
            $table->dateTime('resolved_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_requests');
    }
};
