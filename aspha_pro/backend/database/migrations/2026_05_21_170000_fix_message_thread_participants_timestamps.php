<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Correctif messagerie (2026-05-21).
 *
 * La migration 2026_05_19_100000_security_fixes_audit recréait la table
 * `message_thread_participants` pour lui ajouter une clé primaire `id`.
 * Mais elle le faisait DIFFÉREMMENT selon le driver :
 *  - SQLite  : table entièrement recréée AVEC `timestamps()` → OK
 *  - MariaDB/PostgreSQL : seul `id` (+ unique) ajouté → les colonnes
 *    `created_at` / `updated_at` MANQUAIENT.
 *
 * Le modèle `MessageThreadParticipant` a `$timestamps = true` (défaut) :
 * chaque `create()` tente d'écrire `created_at`/`updated_at`. En production
 * (PostgreSQL) ces colonnes étant absentes → QueryException → toute
 * création de conversation échouait.
 *
 * Cette migration ajoute les colonnes manquantes, de façon idempotente
 * (no-op si elles existent déjà, ex. en SQLite).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('message_thread_participants')) {
            return;
        }

        Schema::table('message_thread_participants', function (Blueprint $table) {
            if (! Schema::hasColumn('message_thread_participants', 'created_at')) {
                $table->timestamp('created_at')->nullable();
            }
            if (! Schema::hasColumn('message_thread_participants', 'updated_at')) {
                $table->timestamp('updated_at')->nullable();
            }
        });
    }

    public function down(): void
    {
        // On ne retire pas ces colonnes : elles sont nécessaires au modèle.
    }
};
