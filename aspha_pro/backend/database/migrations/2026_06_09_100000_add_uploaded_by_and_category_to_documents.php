<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 2026-06-09 — Sprint mobile Documents intervenant.
 *
 * Self-service mobile : l'intervenant peut uploader ses propres documents
 * (justificatifs, certificats…) depuis l'app. On a besoin de :
 *  - `uploaded_by_user_id` : tracer QUI a uploadé (= soit l'admin RH, soit
 *    l'intervenant lui-même). Sert au delete extranet (ownership : un
 *    intervenant ne peut effacer que SES propres uploads, pas les docs RH).
 *  - `category` : étiquette libre (ex. `uploaded_by_employee` par défaut côté
 *    extranet, `payslip`, `contract`, etc. côté admin). Champ string libre,
 *    pas d'énumération stricte — c'est purement informatif côté UI.
 *
 * Les deux colonnes sont nullable pour la rétro-compat des lignes historiques
 * (avant ce chantier — créées par les admins via l'ERP avant l'app mobile).
 *
 * Idempotente (`Schema::hasColumn`) — portable PostgreSQL/MySQL/SQLite.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            if (! Schema::hasColumn('documents', 'uploaded_by_user_id')) {
                // FK vers users.id, nullable, nullOnDelete : si l'user est
                // supprimé on garde le document orphelin (info historique).
                $table->foreignId('uploaded_by_user_id')
                    ->nullable()
                    ->after('audience')
                    ->constrained('users')
                    ->nullOnDelete();
            }
            if (! Schema::hasColumn('documents', 'category')) {
                // Catégorie libre (ex. 'uploaded_by_employee', 'payslip', …).
                $table->string('category')->nullable()->after('document_type');
            }
        });
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            if (Schema::hasColumn('documents', 'uploaded_by_user_id')) {
                $table->dropConstrainedForeignId('uploaded_by_user_id');
            }
            if (Schema::hasColumn('documents', 'category')) {
                $table->dropColumn('category');
            }
        });
    }
};
