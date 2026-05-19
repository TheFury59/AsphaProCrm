<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

/**
 * Service de numérotation atomique pour les documents commerciaux
 * (factures, devis, règlements).
 *
 * audit 2026-05-19 — remplace les `count() + 1` race-prone qui pouvaient
 * générer deux fois la même référence si deux requêtes concurrentes
 * tombaient au même moment (cas typique : import batch ou clic double).
 *
 * Chaque (type, year) est un compteur indépendant — réinitialisation
 * automatique en début d'année civile.
 *
 * Format renvoyé : `{type}-{YYYYMM}-{XXXX}` (ex : INV-202605-0042)
 *   - YYYYMM : mois courant (pour cohérence avec l'ancien format)
 *   - XXXX : numéro séquentiel padded 4 chars, scope = année calendaire
 */
class DocumentSequenceService
{
    /**
     * Génère la prochaine référence atomiquement.
     *
     * Utilise une transaction + lockForUpdate pour garantir l'unicité même
     * sous charge. Compatible SQLite (qui sérialise les writes) et
     * MariaDB/Postgres (row-level lock).
     *
     * @param  string  $type  Préfixe document : 'INV', 'QUO', 'PAY', etc.
     * @return string Référence formatée
     */
    public function next(string $type): string
    {
        $type = strtoupper($type);
        $year = (int) date('Y');
        $yearMonth = date('Ym');

        $number = DB::transaction(function () use ($type, $year) {
            // Lock atomique sur la ligne (type, year). On utilise updateOrInsert
            // car le premier appel de l'année doit créer la ligne.
            $row = DB::table('document_sequences')
                ->where('type', $type)
                ->where('year', $year)
                ->lockForUpdate()
                ->first();

            if ($row) {
                $next = ((int) $row->current_number) + 1;
                DB::table('document_sequences')
                    ->where('id', $row->id)
                    ->update([
                        'current_number' => $next,
                        'updated_at' => now(),
                    ]);
            } else {
                $next = 1;
                DB::table('document_sequences')->insert([
                    'type' => $type,
                    'year' => $year,
                    'current_number' => $next,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            return $next;
        });

        return $type . '-' . $yearMonth . '-' . str_pad((string) $number, 4, '0', STR_PAD_LEFT);
    }
}
