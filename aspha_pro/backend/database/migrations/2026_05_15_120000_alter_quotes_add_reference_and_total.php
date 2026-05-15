<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('quotes', function (Blueprint $table) {
            $table->string('reference')->nullable()->after('id');
            $table->decimal('total', 12, 2)->default(0)->after('comment');
        });

        // Backfill references for existing rows so we can later add unique index
        $existing = DB::table('quotes')->orderBy('id')->get(['id', 'created_at']);
        $counters = [];
        foreach ($existing as $row) {
            $createdAt = $row->created_at ? date('Ym', strtotime($row->created_at)) : date('Ym');
            $counters[$createdAt] = ($counters[$createdAt] ?? 0) + 1;
            $ref = 'QUO-' . $createdAt . '-' . str_pad((string) $counters[$createdAt], 4, '0', STR_PAD_LEFT);
            DB::table('quotes')->where('id', $row->id)->update(['reference' => $ref]);
        }

        Schema::table('quotes', function (Blueprint $table) {
            $table->unique('reference');
        });
    }

    public function down(): void
    {
        Schema::table('quotes', function (Blueprint $table) {
            $table->dropUnique(['reference']);
            $table->dropColumn(['reference', 'total']);
        });
    }
};
