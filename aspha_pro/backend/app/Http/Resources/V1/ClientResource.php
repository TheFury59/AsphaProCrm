<?php

namespace App\Http\Resources\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ClientResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'status' => $this->status,
            'entity_id' => $this->entity_id,
            'owner_user_id' => $this->owner_user_id,
            'print_intervention_detail' => $this->print_intervention_detail,
            'display_name' => $this->displayName(),
            'created_at' => $this->created_at?->toIso8601String(),

            // Relations (loaded conditionally)
            'company' => $this->whenLoaded('company', fn () => $this->company ? [
                'company_name' => $this->company->company_name,
                'legal_form' => $this->company->legal_form,
                'siret' => $this->company->siret,
                'vat_number' => $this->company->vat_number,
                'manager_civility' => $this->company->manager_civility,
                'manager_first_name' => $this->company->manager_first_name,
                'manager_last_name' => $this->company->manager_last_name,
                'manager_role' => $this->company->manager_role,
                'phone_landline' => $this->company->phone_landline,
                'phone_mobile' => $this->company->phone_mobile,
                'primary_email' => $this->company->primary_email,
                'photo' => $this->company->photo,
                'allow_duplicate' => (bool) $this->company->allow_duplicate,
            ] : null),

            'billing_contact' => $this->whenLoaded('billingContact', fn () => $this->billingContact ? [
                'civility' => $this->billingContact->civility,
                'first_name' => $this->billingContact->first_name,
                'last_name' => $this->billingContact->last_name,
                'email' => $this->billingContact->email,
                'phone' => $this->billingContact->phone,
            ] : null),

            'entity' => $this->whenLoaded('entity', fn () => $this->entity ? [
                'id' => $this->entity->id,
                'name' => $this->entity->name,
            ] : null),

            'owner_user' => $this->whenLoaded('ownerUser', fn () => $this->ownerUser ? [
                'id' => $this->ownerUser->id,
                'name' => $this->ownerUser->name,
            ] : null),

            'addresses' => $this->whenLoaded('addresses', fn () => $this->addresses->map(fn ($a) => [
                'id' => $a->id,
                'type' => $a->type,
                'address' => $a->address,
                'city' => $a->city,
                'postal_code' => $a->postal_code,
                'latitude' => $a->latitude,
                'longitude' => $a->longitude,
            ])),

            'contacts' => $this->whenLoaded('contacts', fn () => $this->contacts->map(fn ($c) => [
                'id' => $c->id,
                'type' => $c->type,
                'value' => $c->value,
                'is_primary' => (bool) $c->is_primary,
            ])),

            'related_contacts' => $this->whenLoaded('relatedContacts', fn () => $this->relatedContacts->map(fn ($c) => [
                'id' => $c->id,
                'type' => $c->type,
                'name' => $c->name,
                'phone' => $c->phone,
            ])),

            // Counts pour la sidebar des onglets
            'counts' => [
                'missions' => $this->whenCounted('missions'),
                'prestations' => $this->whenCounted('prestations'),
                'absences' => $this->whenCounted('absences'),
                'keys' => $this->whenCounted('keys'),
                'invoices' => $this->whenCounted('invoices'),
                'quotes' => $this->whenCounted('quotes'),
            ],
        ];
    }
}
