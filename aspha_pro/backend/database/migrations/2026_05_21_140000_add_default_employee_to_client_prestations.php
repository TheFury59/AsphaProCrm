<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Refonte 2026-05-21 (P2) — assignation d'un intervenant depuis la mission.
 *
 * Chaque prestation contractualisée récurrente peut désormais référencer un
 * intervenant « par défaut » : il sera affecté automatiquement à l'intervention
 * récurrente modèle générée (au lieu de la laisser « à pourvoir »).
 *
 * Nullable + nullOnDelete : si l'intervenant est archivé/supprimé, la prestation
 * retombe simplement sur « à pourvoir » à la prochaine resynchronisation.
 *
 * Idempotent + compatible PostgreSQL/SQLite.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('client_prestations', function (Blueprint $table) {
            if (! Schema::hasColumn('client_prestations', 'default_employee_id')) {
                $table->foreignId('default_employee_id')
                    ->nullable()
                    ->after('recurrence_occurrences_count')
                    ->constrained('employees')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('client_prestations', function (Blueprint $table) {
            if (Schema::hasColumn('client_prestations', 'default_employee_id')) {
                // dropConstrainedForeignId gère la FK + la colonne ; on garde un
                // try/catch implicite via hasColumn pour rester idempotent.
                $table->dropConstrainedForeignId('default_employee_id');
            }
        });
    }
};
