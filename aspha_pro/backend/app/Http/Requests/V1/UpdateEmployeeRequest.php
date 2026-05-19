<?php

namespace App\Http\Requests\V1;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateEmployeeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('employees.edit') ?? false;
    }

    public function rules(): array
    {
        $employeeId = $this->route('employee')?->id;

        return [
            'entity_id' => ['sometimes', 'exists:entities,id'],
            'owner_user_id' => ['sometimes', 'nullable', 'exists:users,id'],
            'user_id' => ['sometimes', 'nullable', 'exists:users,id', Rule::unique('employees', 'user_id')->ignore($employeeId)],
            'name' => ['sometimes', 'string', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:32'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'classification' => ['sometimes', 'in:non_cadre,cadre'],
            'transport_mode' => ['sometimes', 'nullable', 'string', 'max:32'],
            'has_company_vehicle' => ['sometimes', 'boolean'],
            'diploma' => ['sometimes', 'nullable', 'string'],
            'job_reference_free' => ['sometimes', 'nullable', 'string'],
            'skill_ids' => ['sometimes', 'array'],
            'skill_ids.*' => ['integer', 'exists:skills,id'],
        ];
    }
}
