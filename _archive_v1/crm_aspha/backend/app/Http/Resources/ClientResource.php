<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ClientResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $displayName = $this->type === 'company'
            ? ($this->company_name ?? '')
            : trim(($this->first_name ?? '') . ' ' . ($this->last_name ?? ''));

        return [
            'id' => $this->id,
            'type' => $this->type,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'company_name' => $this->company_name,
            'display_name' => $displayName,
            'email' => $this->email,
            'phone' => $this->phone,
            'mobile' => $this->mobile,
            'addresses' => ClientAddressResource::collection($this->whenLoaded('addresses')),
        ];
    }
}
