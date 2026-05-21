<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Pivot user × thread, mais avec last_read_at → on en fait un Model standard
 * (non Pivot) car on a besoin d'updater last_read_at indépendamment.
 */
class MessageThreadParticipant extends Model
{
    protected $table = 'message_thread_participants';

    // Depuis la migration 2026_05_19_100000_security_fixes_audit la table a
    // un vrai `id` auto-increment et timestamps. Avant : `primaryKey=null`
    // sur table sans id → `create()` non déterministe, `find()` impossible.
    // Cf. audit 2026-05-19 (CRIT).
    //
    // ⚠️ 2026-05-21 — `joined_at` retiré : la table recréée par la migration
    // de sécurité ne possède PAS cette colonne. L'insérer cassait toute
    // création de conversation (erreur SQL colonne inconnue). `created_at`
    // (timestamps) tient déjà lieu de date d'arrivée du participant.
    protected $fillable = [
        'thread_id',
        'user_id',
        'last_read_at',
    ];

    protected function casts(): array
    {
        return [
            'last_read_at' => 'datetime',
        ];
    }

    public function thread(): BelongsTo
    {
        return $this->belongsTo(MessageThread::class, 'thread_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
