<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 2026-05-21 — Fil de discussion des tickets (`client_requests`).
 *
 * Table `client_request_messages` : chaque entrée est un message posté dans
 * le fil d'un ticket par un des participants (admin, client propriétaire,
 * intervenant affecté ou créateur du ticket).
 *
 *  - `client_request_id` : FK ticket, cascade (supprimer le ticket purge le fil).
 *  - `sender_id`         : FK users — l'auteur du message. `nullOnDelete` pour
 *                          ne pas perdre l'historique si le user est supprimé.
 *  - `body`              : texte du message.
 *
 * Idempotent (`Schema::hasTable`) + compatible PostgreSQL/SQLite.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('client_request_messages')) {
            return;
        }

        Schema::create('client_request_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_request_id')
                ->constrained('client_requests')->cascadeOnDelete();
            $table->foreignId('sender_id')->nullable()
                ->constrained('users')->nullOnDelete();
            $table->text('body');
            $table->timestamps();

            $table->index(['client_request_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_request_messages');
    }
};
