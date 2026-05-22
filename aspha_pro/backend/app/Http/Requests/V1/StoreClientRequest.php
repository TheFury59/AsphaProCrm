<?php

namespace App\Http\Requests\V1;

use Illuminate\Foundation\Http\FormRequest;

class StoreClientRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('clients.create') ?? false;
    }

    public function rules(): array
    {
        return [
            // Client
            // `code` optionnel : généré automatiquement (CLI-XXXX) après l'insert
            // si non fourni. L'unicité reste validée quand un code est saisi.
            'code' => ['nullable', 'string', 'max:64', 'unique:clients,code'],
            'status' => ['required', 'in:active,inactive,suspended'],
            'entity_id' => ['required', 'exists:entities,id'],
            'owner_user_id' => ['nullable', 'exists:users,id'],
            'print_intervention_detail' => ['nullable', 'in:always,never,except_forfait'],
            'intervenant_notes' => ['nullable', 'string'],

            // Company (entreprise — table 1-1)
            'company.company_name' => ['required', 'string', 'max:255'],
            'company.legal_form' => ['nullable', 'string', 'max:64'],
            'company.siret' => ['nullable', 'string', 'max:32'],
            'company.vat_number' => ['nullable', 'string', 'max:32'],
            'company.manager_civility' => ['nullable', 'string', 'max:16'],
            'company.manager_first_name' => ['nullable', 'string', 'max:64'],
            'company.manager_last_name' => ['nullable', 'string', 'max:64'],
            'company.manager_role' => ['nullable', 'string', 'max:64'],
            'company.phone_landline' => ['nullable', 'string', 'max:32'],
            'company.phone_mobile' => ['nullable', 'string', 'max:32'],
            'company.primary_email' => ['nullable', 'email', 'max:255'],
            'company.photo' => ['nullable', 'string', 'max:512'],
            'company.allow_duplicate' => ['nullable', 'boolean'],

            // Billing contact (1-1 optionnel)
            'billing_contact' => ['nullable', 'array'],
            'billing_contact.civility' => ['nullable', 'string', 'max:16'],
            'billing_contact.first_name' => ['nullable', 'string', 'max:64'],
            'billing_contact.last_name' => ['nullable', 'string', 'max:64'],
            'billing_contact.email' => ['nullable', 'email', 'max:255'],
            'billing_contact.phone' => ['nullable', 'string', 'max:32'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->filled('code')) {
            $this->merge(['code' => strtoupper(trim((string) $this->input('code')))]);
        }
        if (! $this->filled('status')) {
            $this->merge(['status' => 'active']);
        }
        if (! $this->filled('owner_user_id')) {
            $this->merge(['owner_user_id' => $this->user()?->id]);
        }
    }
}
