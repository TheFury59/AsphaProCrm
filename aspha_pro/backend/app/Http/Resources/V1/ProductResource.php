<?php

namespace App\Http\Resources\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'status' => $this->status,
            'name' => $this->name,
            'entity_id' => $this->entity_id,
            'type' => $this->type,
            'nature' => $this->nature,
            'billing_mode' => $this->billing_mode,
            'category_id' => $this->category_id,
            'default_duration_minutes' => $this->default_duration_minutes,
            'has_degressive_pricing' => (bool) $this->has_degressive_pricing,
            'price' => (float) $this->price,
            'cost' => (float) $this->cost,
            'vat_rate_id' => $this->vat_rate_id,
            'amount_incl_tax' => (bool) $this->amount_incl_tax,
            'specific_rates_forbidden' => (bool) $this->specific_rates_forbidden,
            'accounting_code' => $this->accounting_code,
            'chapter' => $this->chapter,
            'description' => $this->description,
            'created_at' => $this->created_at?->toIso8601String(),

            'category' => $this->whenLoaded('category', fn () => $this->category ? [
                'id' => $this->category->id,
                'label' => $this->category->label,
            ] : null),

            'vat_rate' => $this->whenLoaded('vatRate', fn () => $this->vatRate ? [
                'id' => $this->vatRate->id,
                'label' => $this->vatRate->label,
                'rate' => (float) $this->vatRate->rate,
            ] : null),

            'price_tiers' => $this->whenLoaded('productPriceTiers', fn () => $this->productPriceTiers->map(fn ($t) => [
                'id' => $t->id,
                'from_quantity' => (float) $t->from_quantity,
                'price' => (float) $t->price,
            ])),
        ];
    }
}
