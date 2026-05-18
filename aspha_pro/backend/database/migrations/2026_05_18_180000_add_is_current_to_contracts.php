<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ajoute la colonne `is_current` sur contracts.
 *
 * Le ContractController et Employee::currentContract() l'utilisent depuis
 * le debut, mais la colonne avait ete oubliee dans la migration initiale
 * (cf. bug du 2026-05-18 18:30 sur creation contrat -> SQLite "no such column").
 *
 * Convention : 1 seul contrat actif par employee. Quand on cree un contrat
 * is_current=true, les autres passent automatiquement a false via la
 * logique du controller.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('contracts', function (Blueprint $table) {
            $table->boolean('is_current')->default(false)->after('employee_id');
        });
    }

    public function down(): void
    {
        Schema::table('contracts', function (Blueprint $table) {
            $table->dropColumn('is_current');
        });
    }
};
