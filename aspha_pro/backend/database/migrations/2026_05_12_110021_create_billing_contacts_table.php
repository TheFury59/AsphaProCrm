<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('billing_contacts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->nullable()->unique()->constrained('clients')->cascadeOnDelete(); // un seul contact de facturation par client
            $table->string('civility')->nullable();
            $table->string('first_name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('billing_contacts');
    }
};
