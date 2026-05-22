<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * 2026-05-22 — Ne garder que la TVA 20 % active.
 *
 * Décision cliente : seul le taux de TVA à 20 % doit être proposé dans les
 * sélecteurs (produits, lignes de devis/facture). On passe TOUS les autres
 * taux (`rate != 20`) en `status = 'inactive'`.
 *
 * On ne SUPPRIME aucune ligne : des produits / quote_items / invoice_items
 * peuvent encore référencer ces taux (FK `restrictOnDelete`) ; les masquer
 * suffit car le référentiel `GET /referentials/vat-rates` ne renvoie que les
 * taux `active`.
 *
 * Idempotente (un re-run réapplique le même état). Aucun SQL spécifique à un
 * driver : `UPDATE ... WHERE` standard, portable PostgreSQL/MySQL/SQLite.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('vat_rates')
            ->where('rate', '!=', 20)
            ->update(['status' => 'inactive']);
    }

    public function down(): void
    {
        // Réactivation des taux non-20 % en cas de rollback.
        DB::table('vat_rates')
            ->where('rate', '!=', 20)
            ->update(['status' => 'active']);
    }
};
