<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ClientRequest extends Model
{
    protected $fillable = [
        'client_id',
        'type',
        'subject',
        'body',
        'status',
        'priority',
        'assigned_to',
        'created_by_user_id',
        'resolved_at',
        // Levier « faute » du système de notation (2026-05-22) : l'admin
        // désigne l'intervenant responsable d'un ticket — null = aucune faute.
        'fault_employee_id',
        'fault_comment',
    ];

    protected function casts(): array
    {
        return [
            'resolved_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function assignedTo(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    /**
     * User qui a créé ce ticket (admin, intervenant, ou client via extranet).
     * Permet d'afficher dans la UI "créé par X" et d'auditer l'origine.
     */
    public function createdByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    /**
     * Intervenant désigné fautif pour ce ticket (système de notation).
     * Nullable — null signifie qu'aucune faute n'est imputée. Chaque ticket
     * fautif retranche des points au critère « relation » de l'intervenant.
     */
    public function faultEmployee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'fault_employee_id');
    }

    /**
     * Fil de discussion du ticket — messages échangés entre les participants.
     */
    public function messages(): HasMany
    {
        return $this->hasMany(ClientRequestMessage::class, 'client_request_id');
    }

    /**
     * Intervenants affectés au ticket. Un intervenant affecté devient
     * participant du fil : il voit le ticket dans son extranet et peut
     * y répondre. Distinct de `assigned_to` (un seul user, référent admin).
     */
    public function assignedEmployees(): BelongsToMany
    {
        return $this->belongsToMany(Employee::class, 'client_request_employee', 'client_request_id', 'employee_id')
            ->withTimestamps();
    }

    /**
     * Identifiants des `users` participants au ticket — pour l'ownership
     * (qui peut lire/écrire dans le fil) ET les notifications.
     *
     * Un participant est : le client propriétaire (via `client.portal_user_id`),
     * le créateur du ticket (`created_by_user_id`), le user `assigned_to`,
     * tous les admins, et les intervenants affectés (via `employee.user_id`).
     *
     * @return array<int> liste d'IDs `users`, dédupliquée.
     */
    public function participantUserIds(): array
    {
        $ids = [];

        // Client propriétaire (extranet) — via le user de portail.
        $client = $this->relationLoaded('client')
            ? $this->client
            : Client::find($this->client_id);
        if ($client?->portal_user_id) {
            $ids[] = (int) $client->portal_user_id;
        }

        // Créateur + référent admin du ticket.
        if ($this->created_by_user_id) {
            $ids[] = (int) $this->created_by_user_id;
        }
        if ($this->assigned_to) {
            $ids[] = (int) $this->assigned_to;
        }

        // Tous les admins (ils gèrent les tickets).
        foreach (User::role(['super_admin', 'admin'])->pluck('id') as $adminId) {
            $ids[] = (int) $adminId;
        }

        // Intervenants affectés — leur user_id.
        $employees = $this->relationLoaded('assignedEmployees')
            ? $this->assignedEmployees
            : $this->assignedEmployees()->get();
        foreach ($employees as $employee) {
            if ($employee->user_id) {
                $ids[] = (int) $employee->user_id;
            }
        }

        return array_values(array_unique(array_filter($ids)));
    }
}
