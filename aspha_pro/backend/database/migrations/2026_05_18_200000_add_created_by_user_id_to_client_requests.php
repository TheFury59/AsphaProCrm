<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Permet de tracker qui a créé un ticket (client, intervenant, admin).
 *
 * Avant cette migration, on ne savait pas qui était à l'origine de la
 * demande — les tickets pouvaient venir de l'admin (via /tickets), du
 * client (via /extranet/client/tickets), ou de l'intervenant (à venir
 * via /extranet/intervenant/tickets).
 *
 * `created_by_user_id` nullable car les tickets existants n'ont pas
 * cette info (créés avant la traçabilité).
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('client_requests', function (Blueprint $table) {
            $table->foreignId('created_by_user_id')
                ->nullable()
                ->after('assigned_to')
                ->constrained('users')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('client_requests', function (Blueprint $table) {
            $table->dropConstrainedForeignId('created_by_user_id');
        });
    }
};
