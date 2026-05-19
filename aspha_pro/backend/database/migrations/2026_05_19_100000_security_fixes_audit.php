<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

/**
 * Migration de correction issue de l'audit 2026-05-19.
 *
 * Regroupe plusieurs petits fixes structurels :
 *  1. `notifications.target_id` nullable + index composite morph
 *  2. `message_thread_participants` : ajout PK auto-incrementée + unique
 *     composite (sans cette PK, le model Eloquent avait `primaryKey=null`
 *     → comportement non déterministe sur `create()` / `find()`).
 *
 * Toutes les migrations sont safe à ré-exécuter (`if (! Schema::hasColumn)`
 * etc.) et compatibles SQLite + MariaDB.
 */
return new class extends Migration
{
    public function up(): void
    {
        // ===== 1) notifications.target_id nullable =====
        // Avant : NOT NULL → le dispatcher insérait 0 pour les notifs sans
        // target (ex: notif système). Le frontend tentait alors un deep-link
        // vers `target_type=null + target_id=0` → cassé.
        if (Schema::hasTable('notifications')) {
            Schema::table('notifications', function (Blueprint $table) {
                $table->unsignedBigInteger('target_id')->nullable()->change();
            });
            // Index composite morph (target_type, target_id) — accélère le
            // lookup "toutes les notifs liées à cette entité" + le filtre
            // dans le deep-link `markRead`.
            try {
                Schema::table('notifications', function (Blueprint $table) {
                    $table->index(['target_type', 'target_id'], 'notifications_target_morph_idx');
                });
            } catch (\Throwable $e) {
                // Index déjà présent — on ignore
            }
        }

        // ===== 2) message_thread_participants : PK + unique composite =====
        if (Schema::hasTable('message_thread_participants')) {
            // SQLite ne supporte pas `ADD PRIMARY KEY` après création → on
            // détecte via les colonnes existantes. Sur MariaDB on ajoute id +
            // unique (thread_id, user_id).
            $driver = DB::connection()->getDriverName();

            if ($driver === 'sqlite') {
                // SQLite : on doit recréer la table. On préserve les données
                // existantes via un swap atomique.
                $rows = DB::table('message_thread_participants')->get();

                Schema::drop('message_thread_participants');
                Schema::create('message_thread_participants', function (Blueprint $table) {
                    $table->id();
                    $table->foreignId('thread_id')->constrained('message_threads')->cascadeOnDelete();
                    $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                    $table->timestamp('last_read_at')->nullable();
                    $table->timestamps();
                    $table->unique(['thread_id', 'user_id'], 'mtp_thread_user_unique');
                });

                // Restauration des données (dédupliquées au passage)
                $seen = [];
                foreach ($rows as $r) {
                    $key = $r->thread_id . '-' . $r->user_id;
                    if (isset($seen[$key])) continue;
                    $seen[$key] = true;
                    DB::table('message_thread_participants')->insert([
                        'thread_id' => $r->thread_id,
                        'user_id' => $r->user_id,
                        'last_read_at' => $r->last_read_at ?? null,
                        'created_at' => $r->created_at ?? now(),
                        'updated_at' => $r->updated_at ?? now(),
                    ]);
                }
            } else {
                // MariaDB / Postgres : on peut ALTER directement
                if (! Schema::hasColumn('message_thread_participants', 'id')) {
                    Schema::table('message_thread_participants', function (Blueprint $table) {
                        $table->id()->first();
                    });
                }
                try {
                    Schema::table('message_thread_participants', function (Blueprint $table) {
                        $table->unique(['thread_id', 'user_id'], 'mtp_thread_user_unique');
                    });
                } catch (\Throwable $e) {
                    // Déjà unique
                }
            }
        }
    }

    public function down(): void
    {
        // Rollback partiel — on ne re-met PAS target_id NOT NULL (sinon les
        // notifs existantes sans target casseraient la contrainte).
        if (Schema::hasTable('notifications')) {
            try {
                Schema::table('notifications', function (Blueprint $table) {
                    $table->dropIndex('notifications_target_morph_idx');
                });
            } catch (\Throwable $e) {
                // Index absent
            }
        }
        if (Schema::hasTable('message_thread_participants')) {
            try {
                Schema::table('message_thread_participants', function (Blueprint $table) {
                    $table->dropUnique('mtp_thread_user_unique');
                });
            } catch (\Throwable $e) {
                // Unique absent
            }
        }
    }
};
