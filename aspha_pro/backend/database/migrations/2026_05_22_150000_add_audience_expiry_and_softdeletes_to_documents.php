<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 2026-05-22 — Refonte du système de documents (chantier H).
 *
 * Trois ajouts sur la table `documents` :
 *  - `audience` : public destinataire du document. Valeurs applicatives
 *    `client` / `intervenant` / `encadrement`. Nullable pour les lignes
 *    historiques (avant ce chantier) — le backend traite NULL comme interne.
 *  - `expiry_date` : date de fin de validité / renouvellement, saisie
 *    manuellement à la création. Nullable. Alimente la notification de
 *    renouvellement (`app:notify-document-renewals`).
 *  - `deleted_at` : ⚠️ CORRECTION DE BUG. Le modèle `Document` utilise le
 *    trait `SoftDeletes` depuis sa création, mais la migration initiale
 *    `2026_05_12_110107_create_documents_table` n'a JAMAIS créé la colonne.
 *    Toute suppression provoquait donc une erreur SQL (`deleted_at` inconnue).
 *
 * Idempotente (`Schema::hasColumn`) — pas de SQL spécifique à un driver
 * (portable PostgreSQL / MySQL / MariaDB). Colonnes ajoutées nullable.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            if (! Schema::hasColumn('documents', 'audience')) {
                // client / intervenant / encadrement — voir DocumentController.
                $table->string('audience')->nullable()->after('document_type');
            }
            if (! Schema::hasColumn('documents', 'expiry_date')) {
                $table->date('expiry_date')->nullable()->after('is_client_visible');
            }
            if (! Schema::hasColumn('documents', 'deleted_at')) {
                // Corrige le bug SoftDeletes : la colonne manquait depuis l'origine.
                $table->softDeletes();
            }
        });
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            if (Schema::hasColumn('documents', 'audience')) {
                $table->dropColumn('audience');
            }
            if (Schema::hasColumn('documents', 'expiry_date')) {
                $table->dropColumn('expiry_date');
            }
            if (Schema::hasColumn('documents', 'deleted_at')) {
                $table->dropSoftDeletes();
            }
        });
    }
};
