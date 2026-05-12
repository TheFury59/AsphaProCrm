<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ServiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'code' => $this->code,
            'description' => $this->description,
            'default_hourly_rate' => (float) $this->default_hourly_rate,
            'default_duration_minutes' => $this->default_duration_minutes,
            'color' => $this->color,
            'is_active' => $this->is_active,
        ];
    }
}
