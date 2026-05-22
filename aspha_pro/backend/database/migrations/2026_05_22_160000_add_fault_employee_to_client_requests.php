<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Système de notation des intervenants (2026-05-22) — levier « faute ».
 *
 * Sur un ticket (`client_requests`), l'admin peut désigner un intervenant
 * comme responsable du problème :
 *   - `fault_employee_id` : FK nullable → employees (null = aucune faute imputée)
 *   - `fault_comment`     : commentaire libre justifiant l'imputation
 *
 * Chaque ticket fautif retranche des points au critère « relation » de la
 * note de l'intervenant (cf. EmployeeScoringService).
 *
 * `nullOnDelete` : si l'intervenant est supprimé, le ticket conserve son
 * commentaire mais perd l'imputation (cohérent — la note ne pénalise plus).
 *
 * Idempotent (`Schema::hasColumn`), colonnes nullable, aucun SQL spécifique
 * driver → compatible PostgreSQL (prod) puis MySQL/MariaDB.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('client_requests', function (Blueprint $table) {
            if (! Schema::hasColumn('client_requests', 'fault_employee_id')) {
                $table->foreignId('fault_employee_id')
                    ->nullable()
                    ->after('assigned_to')
                    ->constrained('employees')
                    ->nullOnDelete();
            }
            if (! Schema::hasColumn('client_requests', 'fault_comment')) {
                $table->text('fault_comment')->nullable()->after('fault_employee_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('client_requests', function (Blueprint $table) {
            if (Schema::hasColumn('client_requests', 'fault_employee_id')) {
                $table->dropConstrainedForeignId('fault_employee_id');
            }
            if (Schema::hasColumn('client_requests', 'fault_comment')) {
                $table->dropColumn('fault_comment');
            }
        });
    }
};
