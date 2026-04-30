<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AppointmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $sa = $this->whenLoaded('serviceAssignment');
        $service = $sa && $sa->relationLoaded('service') ? $sa->service : null;
        $client = $sa && $sa->relationLoaded('client') ? $sa->client : null;
        $address = $this->whenLoaded('clientAddress');
        $employee = $this->whenLoaded('employee');

        $clientDisplay = null;
        if ($client) {
            $clientDisplay = $client->type === 'company'
                ? ($client->company_name ?? '')
                : trim(($client->first_name ?? '') . ' ' . ($client->last_name ?? ''));
        }

        return [
            'id' => $this->id,
            'service_assignment_id' => $this->service_assignment_id,
            'employee_id' => $this->employee_id,
            'client_address_id' => $this->client_address_id,
            'scheduled_start' => $this->scheduled_start?->toIso8601String(),
            'scheduled_end' => $this->scheduled_end?->toIso8601String(),
            'actual_start' => $this->actual_start?->toIso8601String(),
            'actual_end' => $this->actual_end?->toIso8601String(),
            'status' => $this->status,
            'paid_to_employee' => $this->paid_to_employee,
            'invoiced_to_client' => $this->invoiced_to_client,
            'admin_notes' => $this->admin_notes,
            // Données dénormalisées pour l'affichage planning (évite N+1 côté front)
            'service' => $service ? [
                'id' => $service->id,
                'name' => $service->name,
                'color' => $service->color,
                'hourly_rate' => (float) ($sa->hourly_rate ?? $service->default_hourly_rate),
            ] : null,
            'client' => $client ? [
                'id' => $client->id,
                'display_name' => $clientDisplay,
                'phone' => $client->phone,
            ] : null,
            'address' => $address && $address->resource ? [
                'line1' => $address->address_line1,
                'postal_code' => $address->postal_code,
                'city' => $address->city,
            ] : null,
            'employee' => $employee && $employee->resource ? [
                'id' => $employee->id,
                'full_name' => $employee->fullName(),
            ] : null,
            'recurrence' => $sa ? [
                'type' => $sa->type,
                'rule' => $sa->recurrence_rule,
                'time' => $sa->recurrence_time,
            ] : null,
        ];
    }
}
