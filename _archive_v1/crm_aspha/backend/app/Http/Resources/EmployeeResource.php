<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EmployeeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'site_id' => $this->site_id,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'full_name' => $this->fullName(),
            'phone' => $this->phone,
            'mobile' => $this->mobile,
            'address' => [
                'line1' => $this->address_line1,
                'postal_code' => $this->postal_code,
                'city' => $this->city,
                'lat' => $this->geo_lat ? (float) $this->geo_lat : null,
                'lng' => $this->geo_lng ? (float) $this->geo_lng : null,
            ],
            'status' => $this->status,
            'current_contract' => $this->whenLoaded('currentContract', fn () => $this->currentContract ? [
                'id' => $this->currentContract->id,
                'position' => $this->currentContract->position,
                'weekly_hours' => (float) $this->currentContract->weekly_hours,
                'contract_type' => $this->currentContract->contract_type,
            ] : null),
        ];
    }
}
