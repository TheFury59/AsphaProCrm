<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Aligne les flags facturation/paiement sur le comportement métier souhaité :
 *
 *  - `bill_client` (= facturer ce RDV au client)        → défaut TRUE
 *  - `is_paid`     (= payer l'intervenant pour ce RDV)  → défaut TRUE
 *  - `is_billed`   (= flag aval rempli quand la facture est émise) → on laisse FALSE
 *
 * SQLite ne supporte pas `ALTER COLUMN ... DEFAULT` en place ;
 * on contourne avec doctrine/dbal (déjà installé) ou en mode pragmatique
 * via mise à jour de tous les enregistrements existants + override
 * côté model boot pour les nouveaux.
 *
 * Solution pragmatique sans dbal : on met à jour les lignes existantes
 * (toutes celles qui ont la valeur par défaut false → true) et on s'appuie
 * sur le model `Intervention::boot` (creating event) pour forcer le défaut
 * côté applicatif.
 */
return new class extends Migration {
    public function up(): void
    {
        // Re-baseline les enregistrements existants : on suppose qu'ils sont
        // tous "à payer / à facturer" sauf décision contraire ultérieure.
        DB::table('interventions')
            ->where('status', '!=', 'annulee')
            ->update([
                'bill_client' => true,
                'is_paid' => true,
            ]);
    }

    public function down(): void
    {
        // pas de rollback : on ne sait pas quelle ligne avait été modifiée à la main
    }
};
