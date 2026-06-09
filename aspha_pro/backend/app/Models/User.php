<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, HasRoles, Notifiable;

    public const STATUS_ACTIVE = 'active';
    public const STATUS_INACTIVE = 'inactive';

    protected $fillable = [
        'name',
        'email',
        'password',
        'status',
        'must_change_password',
        'expo_push_token',
        'avatar_path',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    /** Auto-appendé sur toString JSON pour exposer l'URL absolue de l'avatar. */
    protected $appends = ['avatar_url'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
            'must_change_password' => 'boolean',
        ];
    }

    /**
     * URL absolue de l'avatar User (PERSONNEL, pas RH).
     *
     * Le chemin relatif est stocké dans `avatar_path` (ex. `avatars/u12_a1b2.jpg`).
     * Le `?v=` cache-bust force le refresh quand on remplace une photo.
     * Returns null si aucun avatar défini.
     */
    public function getAvatarUrlAttribute(): ?string
    {
        if (! $this->avatar_path) {
            return null;
        }
        $base = \Illuminate\Support\Facades\Storage::disk('public')->url($this->avatar_path);
        $bust = $this->updated_at?->timestamp ?? 0;
        return "{$base}?v={$bust}";
    }

    /**
     * Employé Aspha lié à ce user (si compte intervenant).
     * Utilisé notamment par TelemanagementController::badge() pour
     * dériver `employee_id` à partir du user authentifié quand l'app
     * mobile badge sans le passer explicitement.
     */
    public function employee(): HasOne
    {
        return $this->hasOne(Employee::class, 'user_id');
    }
}
