<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ajoute `internal_notes` à la table `invoices` (symétrique de `quotes`).
 *
 *  - `comment`        → description visible sur le PDF envoyé au client
 *  - `internal_notes` → NOUVEAU = notes internes admin, jamais sur le PDF
 *
 * Idempotent (`hasColumn`).
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            if (! Schema::hasColumn('invoices', 'internal_notes')) {
                $table->text('internal_notes')->nullable()->after('comment');
            }
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            if (Schema::hasColumn('invoices', 'internal_notes')) {
                $table->dropColumn('internal_notes');
            }
        });
    }
};
