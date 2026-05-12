<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ClientAddressResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'client_id' => $this->client_id,
            'label' => $this->label,
            'line1' => $this->address_line1,
            'line2' => $this->address_line2,
            'postal_code' => $this->postal_code,
            'city' => $this->city,
            'country' => $this->country,
            'lat' => $this->geo_lat ? (float) $this->geo_lat : null,
            'lng' => $this->geo_lng ? (float) $this->geo_lng : null,
            'access_notes' => $this->access_notes,
            'is_default' => $this->is_default,
        ];
    }
}
