<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Bug fix : la migration 2026_05_15_110920 declarait
 *   foreign key("contact_id") references "contacts"("id")
 * alors que la table s'appelle `client_contacts`. Resultat sous SQLite avec
 * PRAGMA foreign_keys=ON (defaut Laravel 11+) : tout INSERT sur interventions
 * echouait avec "no such table: main.contacts".
 *
 * Symptome utilisateur : bouton "Creer l'intervention" silencieux, le dialog
 * ne se ferme jamais (cf. session du 2026-05-18 18:00).
 *
 * Fix SQLite : on patche directement sqlite_master via PRAGMA writable_schema.
 * SQLite refuse `dropColumn` quand une FK fantome existe — la seule solution
 * sans recreer la table entiere est de modifier la definition stockee.
 *
 * Fix MySQL/Postgres : `Schema::dropConstrainedForeignId + foreignId+constrained`
 * passe sans probleme sur ces moteurs (drop column avec FK = trivial).
 *
 * On detecte le driver et on adapte. Sur SQLite on touche directement le
 * schema. Sur les autres on fait un ALTER classique.
 */
return new class extends Migration {
    public function up(): void
    {
        $driver = DB::connection()->getDriverName();

        if ($driver === 'sqlite') {
            // Hack SQLite : modification du schema stocke
            DB::statement('PRAGMA writable_schema = ON');
            DB::statement(
                "UPDATE sqlite_master
                 SET sql = REPLACE(sql, 'references \"contacts\"', 'references \"client_contacts\"')
                 WHERE type = 'table' AND name = 'interventions'"
            );
            DB::statement('PRAGMA writable_schema = OFF');

            // Force SQLite a relire le schema. Sans ca, certaines connexions
            // gardent en cache l'ancienne definition.
            DB::statement('PRAGMA integrity_check');
        } else {
            Schema::table('interventions', function (Blueprint $table) {
                $table->dropConstrainedForeignId('contact_id');
            });
            Schema::table('interventions', function (Blueprint $table) {
                $table->foreignId('contact_id')
                    ->nullable()
                    ->after('address_id')
                    ->constrained('client_contacts')
                    ->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        // Pas de down : c'est un fix de bug, on ne re-introduit pas une FK
        // qui pointe vers une table inexistante.
    }
};
