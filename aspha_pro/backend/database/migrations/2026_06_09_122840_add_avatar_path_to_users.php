<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Avatar personnel d'un User (super_admin, admin, intervenant, client).
 *
 * Distinct des avatars métier :
 *   - employees.avatar_path : photo RH (uploadée par admin sur fiche intervenant)
 *   - client_companies.photo : logo entreprise du client
 *
 * Chemin relatif sur disque public (`storage/app/public/avatars/`), exposé en
 * URL absolue par l'accessor User::avatar_url. Uploadé via `POST /me/avatar`
 * (n'importe quel user authentifié peut changer SA propre photo).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'avatar_path')) {
                $table->string('avatar_path')->nullable()->after('status');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'avatar_path')) {
                $table->dropColumn('avatar_path');
            }
        });
    }
};
