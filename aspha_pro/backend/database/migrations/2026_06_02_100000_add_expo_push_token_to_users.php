<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 2026-06-02 — Push token Expo pour l'app mobile.
 *
 * On stocke directement le token Expo Push sur `users` (1 token = 1 user
 * actif) plutôt que via l'ancienne table `device_tokens` (qui était prévue
 * pour FCM brut). Pour V1 c'est suffisant : un intervenant a typiquement un
 * seul téléphone actif. Si on veut multi-device plus tard, on basculera
 * sur une table dédiée.
 *
 * Le format attendu est ExponentPushToken[xxx...] (généré par
 * expo-notifications côté app).
 *
 * Idempotente + portable (string nullable, aucun SQL spécifique driver).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'expo_push_token')) {
                $table->string('expo_push_token')->nullable()->after('status');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'expo_push_token')) {
                $table->dropColumn('expo_push_token');
            }
        });
    }
};
