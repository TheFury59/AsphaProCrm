<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Decision produit du 2026-05-18 : pas de SMS, uniquement notifs in-app + push + email.
 * On retire la colonne via_sms de notification_preferences.
 *
 * Le job SendSmsNotificationJob et le case 'sms' dans NotificationDispatcher
 * sont supprimes dans le meme commit.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('notification_preferences', function (Blueprint $table) {
            $table->dropColumn('via_sms');
        });
    }

    public function down(): void
    {
        Schema::table('notification_preferences', function (Blueprint $table) {
            $table->boolean('via_sms')->default(false)->after('via_email');
        });
    }
};
