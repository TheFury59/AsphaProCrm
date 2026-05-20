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
 * Fix MySQL/Postgres : depuis la correction "deploiement PostgreSQL" du
 * 2026-05-20, la migration 2026_05_15_110920 ne pose plus de FK inline sur
 * `contact_id` (la colonne est un simple unsignedBigInteger). La vraie FK
 * `contact_id -> client_contacts` est posee par la migration differee
 * 2026_05_20_999000_add_deferred_foreign_keys.php. Cette migration-ci n'a
 * donc plus rien a corriger sur MySQL/Postgres : elle devient un no-op pour
 * ces moteurs (l'ancien `dropConstrainedForeignId` echouerait, faute de FK).
 *
 * On detecte le driver et on adapte. Sur SQLite on touche directement le
 * schema (la FK fantome y est bien stockee dans sqlite_master).
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
        }
        // MySQL / PostgreSQL : no-op. La FK correcte est posee par la
        // migration differee 2026_05_20_999000.
    }

    public function down(): void
    {
        // Pas de down : c'est un fix de bug, on ne re-introduit pas une FK
        // qui pointe vers une table inexistante.
    }
};
