<?php

namespace App\Http\Requests\V1;

use Illuminate\Foundation\Http\FormRequest;

class StoreEmployeeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('employees.create') ?? false;
    }

    public function rules(): array
    {
        return [
            'entity_id' => ['required', 'exists:entities,id'],
            'owner_user_id' => ['nullable', 'exists:users,id'],
            'user_id' => ['nullable', 'exists:users,id', 'unique:employees,user_id'],
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:32'],
            'classification' => ['required', 'in:non_cadre,cadre'],
            'transport_mode' => ['nullable', 'string', 'max:32'],
            'has_company_vehicle' => ['nullable', 'boolean'],
            'diploma' => ['nullable', 'string'],
            'job_reference_free' => ['nullable', 'string'],
            'skill_ids' => ['nullable', 'array'],
            'skill_ids.*' => ['integer', 'exists:skills,id'],
        ];
    }
}
