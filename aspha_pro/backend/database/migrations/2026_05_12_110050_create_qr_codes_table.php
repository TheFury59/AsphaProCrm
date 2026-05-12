<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('qr_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('address_id')->nullable()->constrained('addresses')->restrictOnDelete();
            $table->foreignId('event_type_id')->nullable()->constrained('employee_event_types')->restrictOnDelete();
            $table->string('type'); // 'qrcode', 'nfc'
            $table->string('code')->unique();
            $table->string('status'); // 'valid', 'obsolete', 'invalid', 'to_validate'
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('qr_codes');
    }
};
