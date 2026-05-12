<?php

namespace App\Http\Resources\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EmployeeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'entity_id' => $this->entity_id,
            'owner_user_id' => $this->owner_user_id,
            'name' => $this->name,
            'full_name' => $this->fullName(),
            'phone' => $this->phone,
            'classification' => $this->classification,
            'transport_mode' => $this->transport_mode,
            'has_company_vehicle' => (bool) $this->has_company_vehicle,
            'diploma' => $this->diploma,
            'job_reference_free' => $this->job_reference_free,
            'created_at' => $this->created_at?->toIso8601String(),

            'user' => $this->whenLoaded('user', fn () => $this->user ? [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'email' => $this->user->email,
                'status' => $this->user->status,
            ] : null),

            'entity' => $this->whenLoaded('entity', fn () => $this->entity ? [
                'id' => $this->entity->id,
                'name' => $this->entity->name,
            ] : null),

            'owner_user' => $this->whenLoaded('ownerUser', fn () => $this->ownerUser ? [
                'id' => $this->ownerUser->id,
                'name' => $this->ownerUser->name,
            ] : null),

            'current_contract' => $this->whenLoaded('currentContract', fn () => $this->currentContract ? [
                'id' => $this->currentContract->id,
                'position' => $this->currentContract->position,
                'intervention_zone' => $this->currentContract->intervention_zone,
                'contract_type' => $this->currentContract->contract_type,
                'work_time_type' => $this->currentContract->work_time_type,
                'monthly_duration' => $this->currentContract->monthly_duration,
                'weekly_duration' => $this->currentContract->weekly_duration,
                'pay_mode' => $this->currentContract->pay_mode,
                'monthly_salary' => $this->currentContract->monthly_salary,
                'hourly_rate' => $this->currentContract->hourly_rate,
                'km_rate_inter_vacation' => $this->currentContract->km_rate_inter_vacation,
                'km_rate_intervention' => $this->currentContract->km_rate_intervention,
                'start_date' => $this->currentContract->start_date,
            ] : null),

            'skills' => $this->whenLoaded('skills', fn () => $this->skills->map(fn ($s) => [
                'id' => $s->id,
                'label' => $s->label,
            ])),

            'addresses' => $this->whenLoaded('addresses', fn () => $this->addresses->map(fn ($a) => [
                'id' => $a->id,
                'type' => $a->type,
                'address' => $a->address,
                'city' => $a->city,
                'postal_code' => $a->postal_code,
                'latitude' => $a->latitude,
                'longitude' => $a->longitude,
            ])),

            'counts' => [
                'contracts' => $this->whenCounted('contracts'),
                'absences' => $this->whenCounted('absences'),
                'trainings' => $this->whenCounted('trainings'),
                'interventions' => $this->whenCounted('interventions'),
                'salary_deductions' => $this->whenCounted('salaryDeductions'),
            ],
        ];
    }
}
