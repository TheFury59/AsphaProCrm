<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('bank_accounts', function (Blueprint $table) {
            $table->id();
            $table->string('iban')->nullable();
            $table->string('bic')->nullable();
            $table->string('owner_name')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bank_accounts');
    }
};
