<?php

namespace App\Http\Requests\V1;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateClientRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('clients.edit') ?? false;
    }

    public function rules(): array
    {
        $clientId = $this->route('client')?->id;

        return [
            'code' => ['sometimes', 'string', 'max:64', Rule::unique('clients', 'code')->ignore($clientId)],
            'status' => ['sometimes', 'in:active,inactive,suspended'],
            'entity_id' => ['sometimes', 'exists:entities,id'],
            'owner_user_id' => ['sometimes', 'nullable', 'exists:users,id'],
            'print_intervention_detail' => ['sometimes', 'nullable', 'in:always,never,except_forfait'],
            'intervenant_notes' => ['sometimes', 'nullable', 'string'],

            'company.company_name' => ['sometimes', 'string', 'max:255'],
            'company.legal_form' => ['sometimes', 'nullable', 'string', 'max:64'],
            'company.siret' => ['sometimes', 'nullable', 'string', 'max:32'],
            'company.vat_number' => ['sometimes', 'nullable', 'string', 'max:32'],
            'company.manager_civility' => ['sometimes', 'nullable', 'string', 'max:16'],
            'company.manager_first_name' => ['sometimes', 'nullable', 'string', 'max:64'],
            'company.manager_last_name' => ['sometimes', 'nullable', 'string', 'max:64'],
            'company.manager_role' => ['sometimes', 'nullable', 'string', 'max:64'],
            'company.phone_landline' => ['sometimes', 'nullable', 'string', 'max:32'],
            'company.phone_mobile' => ['sometimes', 'nullable', 'string', 'max:32'],
            'company.primary_email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'company.photo' => ['sometimes', 'nullable', 'string', 'max:512'],
            'company.allow_duplicate' => ['sometimes', 'nullable', 'boolean'],

            'billing_contact.civility' => ['sometimes', 'nullable', 'string', 'max:16'],
            'billing_contact.first_name' => ['sometimes', 'nullable', 'string', 'max:64'],
            'billing_contact.last_name' => ['sometimes', 'nullable', 'string', 'max:64'],
            'billing_contact.email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'billing_contact.phone' => ['sometimes', 'nullable', 'string', 'max:32'],

            // 2026-06-24 audit M4 — flag explicite de purge du contact
            // facturation. Avant : la purge était inférée d'un payload
            // "tous champs vides" (fragile, PATCH partiel pouvait casser).
            'billing_contact_purge' => ['sometimes', 'boolean'],
        ];
    }
}
