<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration audit 2026-05-19 — Télégestion + Push notifications.
 *
 * Changements :
 *   1. `qr_codes.expires_at` (nullable timestamp) — permet expiration optionnelle
 *      des QR codes (cf. TelemanagementController::badge → 410 Gone si dépassé).
 *   2. `checkins.flag_no_gps` (boolean, default false) — flag levé quand un
 *      checkin mobile arrive sans latitude/longitude (mode dégradé, badge UI
 *      "⚠ Sans GPS" en LogsTab).
 *   3. `device_tokens` (table) — stockage des tokens FCM par user (table vide
 *      au déploiement, prête pour intégration mobile future). Job
 *      SendPushNotificationJob lit le 1er token actif de l'user.
 *
 * Toutes les modifs sont idempotentes (hasColumn / hasTable).
 */
return new class extends Migration {
    public function up(): void
    {
        // 1. qr_codes.expires_at
        if (Schema::hasTable('qr_codes') && ! Schema::hasColumn('qr_codes', 'expires_at')) {
            Schema::table('qr_codes', function (Blueprint $table) {
                $table->timestamp('expires_at')->nullable()->after('status');
            });
        }

        // 2. checkins.flag_no_gps
        if (Schema::hasTable('checkins') && ! Schema::hasColumn('checkins', 'flag_no_gps')) {
            Schema::table('checkins', function (Blueprint $table) {
                $table->boolean('flag_no_gps')->default(false)->after('longitude');
            });
        }

        // 3. device_tokens
        if (! Schema::hasTable('device_tokens')) {
            Schema::create('device_tokens', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->string('token');
                $table->string('device_type')->nullable(); // 'ios', 'android', 'web'
                $table->timestamps();

                $table->index('user_id');
                $table->unique(['user_id', 'token']);
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('qr_codes') && Schema::hasColumn('qr_codes', 'expires_at')) {
            Schema::table('qr_codes', fn (Blueprint $t) => $t->dropColumn('expires_at'));
        }

        if (Schema::hasTable('checkins') && Schema::hasColumn('checkins', 'flag_no_gps')) {
            Schema::table('checkins', fn (Blueprint $t) => $t->dropColumn('flag_no_gps'));
        }

        Schema::dropIfExists('device_tokens');
    }
};
