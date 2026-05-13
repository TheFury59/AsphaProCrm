<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Settings globaux de l'application (clé/valeur typée).
 *
 * Permet au super-admin de paramétrer depuis l'UI :
 *  - long_absence_threshold_days (défaut 5)
 *  - paid_travel_max_minutes (défaut 45)
 *  - stock_alert_default_threshold (défaut 10)
 *  - google_maps_api_key (chiffré côté .env, override BDD optionnel)
 *  - silae_portal_url, silae_api_key
 *  - badge_late_threshold_minutes (défaut 5)
 *  - etc.
 *
 * value est stocké en JSON pour supporter n'importe quel type (int, string,
 * bool, array). category permet de grouper l'UI.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('app_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->string('category')->default('general');  // planning | travel | stock | integrations | etc.
            $table->string('label');
            $table->text('description')->nullable();
            $table->json('value')->nullable();
            $table->string('value_type')->default('string');  // string | integer | boolean | array | secret
            $table->boolean('is_secret')->default(false);  // si true, on masque dans l'UI (clés API…)
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('app_settings');
    }
};
