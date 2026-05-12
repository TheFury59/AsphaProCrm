<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ajout de la colonne deleted_at sur les 9 tables sensibles qui utilisent
 * le trait SoftDeletes dans leurs models Eloquent. Le générateur DBML
 * ne le savait pas (info portée par les models).
 */
return new class extends Migration {
    private array $tables = [
        'clients', 'employees', 'contracts',
        'invoices', 'quotes', 'missions', 'client_prestations',
        'documents', 'keys',
    ];

    public function up(): void
    {
        foreach ($this->tables as $t) {
            Schema::table($t, function (Blueprint $table) {
                $table->softDeletes();
            });
        }
    }

    public function down(): void
    {
        foreach ($this->tables as $t) {
            Schema::table($t, function (Blueprint $table) {
                $table->dropSoftDeletes();
            });
        }
    }
};
