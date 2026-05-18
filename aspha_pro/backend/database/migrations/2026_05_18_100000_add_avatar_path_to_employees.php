<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ajoute une colonne `avatar_path` à la table employees (chemin Storage::disk('public')).
 *
 * On stocke le chemin relatif uniquement (ex: "avatars/123_abc.jpg") ;
 * l'URL absolue est calculée à la sérialisation via un accessor sur le model.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->string('avatar_path')->nullable()->after('name');
        });
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumn('avatar_path');
        });
    }
};
