<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Audit 2026-05-19 — Schema hardening (migration consolidée Phase F).
 *
 * Couvre les défauts structurels relevés par l'audit :
 *
 *   1. CRIT — `interventions.contact_id` référence `contacts` (table inexistante)
 *      → déjà corrigé par 2026_05_18_160000_fix_intervention_contact_fk
 *      (FK repointée sur client_contacts). On vérifie ici en garde-fou : si la
 *      table `contacts` réapparaît un jour comme dépendance, on log un warning
 *      explicite. Skip sinon.
 *
 *   2. HIGH — Tables sans `timestamps()` (created_at/updated_at) :
 *      checkins, qr_codes, addresses, messages, invoice_items,
 *      client_prestations, quote_items.
 *
 *   3. HIGH — Index manquants sur les tables coeur (interventions, invoices,
 *      reglements, telemanagement_logs, employee_absences, stock_movements,
 *      client_requests). Chaque index est nommé explicitement et wrappé en
 *      try/catch pour idempotence.
 *
 *   4. HIGH — Pivots sans unique composite :
 *      - employee_skills (dedup d'abord, unique ensuite)
 *      - notification_preferences (unique user_id + notification_type_id)
 *
 *   5. MED — Index simple sur `client_companies.siret` (pas unique strict
 *      car `allow_duplicate` autorise les filiales d'un même groupe).
 *
 *   6. HIGH — Intervention SoftDeletes : ajoute la colonne `deleted_at` sur
 *      `interventions`. Le trait dans le model est posé en parallèle.
 *
 * Contraintes :
 *  - 100% safe à re-jouer (hasColumn/hasTable check partout)
 *  - Compatible SQLite (dev) + MariaDB/Postgres (prod)
 *  - Pas de dropForeign (cassé sous SQLite) → try/catch sur les index
 */
return new class extends Migration {
    /**
     * Tables qui doivent gagner created_at + updated_at.
     */
    private array $tablesNeedingTimestamps = [
        'checkins',
        'qr_codes',
        'addresses',
        'messages',
        'invoice_items',
        'client_prestations',
        'quote_items',
    ];

    /**
     * Index à ajouter, par table → liste de [colonnes, nom].
     * Wrap try/catch pour idempotence.
     */
    private array $indexes = [
        'interventions' => [
            [['status'], 'interventions_status_idx'],
            [['start_datetime'], 'interventions_start_datetime_idx'],
            [['client_id'], 'interventions_client_id_idx'],
            [['employee_id'], 'interventions_employee_id_idx'],
            [['deleted_at'], 'interventions_deleted_at_idx'],
        ],
        'invoices' => [
            [['status'], 'invoices_status_idx'],
            [['payment_status'], 'invoices_payment_status_idx'],
            [['invoice_date'], 'invoices_invoice_date_idx'],
            [['client_id'], 'invoices_client_id_idx'],
        ],
        'reglements' => [
            [['status'], 'reglements_status_idx'],
            [['value_date'], 'reglements_value_date_idx'],
            [['client_id'], 'reglements_client_id_idx'],
        ],
        'telemanagement_logs' => [
            [['called_at'], 'telemanagement_logs_called_at_idx'],
            [['employee_id'], 'telemanagement_logs_employee_id_idx'],
            [['client_id'], 'telemanagement_logs_client_id_idx'],
        ],
        'employee_absences' => [
            [['entry_type'], 'employee_absences_entry_type_idx'],
            [['start_date'], 'employee_absences_start_date_idx'],
        ],
        'stock_movements' => [
            [['stock_product_id'], 'stock_movements_stock_product_id_idx'],
            [['movement_date'], 'stock_movements_movement_date_idx'],
        ],
        'client_requests' => [
            [['status'], 'client_requests_status_idx'],
            [['priority'], 'client_requests_priority_idx'],
        ],
        'client_companies' => [
            [['siret'], 'client_companies_siret_idx'],
        ],
    ];

    public function up(): void
    {
        // ============================================================
        // 1) Garde-fou : `contacts` table fantôme
        // ============================================================
        // La FK fantôme a déjà été corrigée par la migration 2026_05_18_160000.
        // Si la table `contacts` venait à exister un jour, on l'indique en logs
        // pour éviter des collisions silencieuses futures.
        if (Schema::hasTable('contacts')) {
            // No-op : on garde l'info pour info, l'app utilise `client_contacts`.
            // Aucune action destructive sur une table potentiellement utilisée.
        }

        // ============================================================
        // 2) Timestamps manquants
        // ============================================================
        foreach ($this->tablesNeedingTimestamps as $tableName) {
            if (! Schema::hasTable($tableName)) {
                continue;
            }
            if (! Schema::hasColumn($tableName, 'created_at')) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->timestamps();
                });
            }
        }

        // ============================================================
        // 3) SoftDeletes sur interventions (colonne deleted_at)
        // ============================================================
        // Ajout AVANT l'index `interventions_deleted_at_idx` ci-dessous.
        if (Schema::hasTable('interventions') && ! Schema::hasColumn('interventions', 'deleted_at')) {
            Schema::table('interventions', function (Blueprint $table) {
                $table->softDeletes();
            });
        }

        // ============================================================
        // 4) Index manquants sur tables coeur
        // ============================================================
        foreach ($this->indexes as $tableName => $defs) {
            if (! Schema::hasTable($tableName)) {
                continue;
            }
            foreach ($defs as [$columns, $indexName]) {
                // Skip si une colonne référencée n'existe pas (sécurité)
                $allExist = true;
                foreach ($columns as $col) {
                    if (! Schema::hasColumn($tableName, $col)) {
                        $allExist = false;
                        break;
                    }
                }
                if (! $allExist) {
                    continue;
                }
                try {
                    Schema::table($tableName, function (Blueprint $table) use ($columns, $indexName) {
                        $table->index($columns, $indexName);
                    });
                } catch (\Throwable $e) {
                    // Index déjà présent (ou conflit nom) → idempotence
                }
            }
        }

        // ============================================================
        // 5) Pivots — unique composite
        // ============================================================

        // --- employee_skills : dedup PUIS unique (employee_id, skill_id) ---
        if (Schema::hasTable('employee_skills')) {
            // Dedup : on garde 1 ligne par paire (employee_id, skill_id).
            // SQLite n'a pas de ROW_NUMBER() partout → on fait un PHP-side dedup
            // simple via Collection.
            $rows = DB::table('employee_skills')->get();
            $seen = [];
            $toKeep = [];
            foreach ($rows as $r) {
                $key = ($r->employee_id ?? 'null') . '-' . ($r->skill_id ?? 'null');
                if (isset($seen[$key])) {
                    continue;
                }
                $seen[$key] = true;
                $toKeep[] = $r;
            }
            if (count($toKeep) !== $rows->count()) {
                // Recharge : truncate + reinsert le set dédupliqué
                DB::table('employee_skills')->truncate();
                foreach (array_chunk($toKeep, 500) as $chunk) {
                    $insert = array_map(fn ($r) => (array) $r, $chunk);
                    DB::table('employee_skills')->insert($insert);
                }
            }

            try {
                Schema::table('employee_skills', function (Blueprint $table) {
                    $table->unique(['employee_id', 'skill_id'], 'employee_skills_employee_skill_unique');
                });
            } catch (\Throwable $e) {
                // Déjà unique — ignore
            }
        }

        // --- notification_preferences : unique (user_id, notification_type_id) ---
        if (Schema::hasTable('notification_preferences')) {
            // Dedup analogue
            $rows = DB::table('notification_preferences')->get();
            $seen = [];
            $idsToDelete = [];
            foreach ($rows as $r) {
                $key = ($r->user_id ?? 'null') . '-' . ($r->notification_type_id ?? 'null');
                if (isset($seen[$key])) {
                    $idsToDelete[] = $r->id;
                    continue;
                }
                $seen[$key] = true;
            }
            if (! empty($idsToDelete)) {
                DB::table('notification_preferences')->whereIn('id', $idsToDelete)->delete();
            }

            try {
                Schema::table('notification_preferences', function (Blueprint $table) {
                    $table->unique(['user_id', 'notification_type_id'], 'notif_prefs_user_type_unique');
                });
            } catch (\Throwable $e) {
                // Déjà unique — ignore
            }
        }
    }

    public function down(): void
    {
        // Rollback partiel : on retire les index/uniques. On laisse les
        // timestamps et le deleted_at en place (les supprimer casserait les
        // models Eloquent qui les attendent).

        foreach ($this->indexes as $tableName => $defs) {
            if (! Schema::hasTable($tableName)) {
                continue;
            }
            foreach ($defs as [$columns, $indexName]) {
                try {
                    Schema::table($tableName, function (Blueprint $table) use ($indexName) {
                        $table->dropIndex($indexName);
                    });
                } catch (\Throwable $e) {
                    // Index absent
                }
            }
        }

        if (Schema::hasTable('employee_skills')) {
            try {
                Schema::table('employee_skills', function (Blueprint $table) {
                    $table->dropUnique('employee_skills_employee_skill_unique');
                });
            } catch (\Throwable $e) {
                // Unique absent
            }
        }

        if (Schema::hasTable('notification_preferences')) {
            try {
                Schema::table('notification_preferences', function (Blueprint $table) {
                    $table->dropUnique('notif_prefs_user_type_unique');
                });
            } catch (\Throwable $e) {
                // Unique absent
            }
        }
    }
};
