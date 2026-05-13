<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\RequiredDocumentType;
use Illuminate\Http\Request;

/**
 * CRUD des types de documents requis (référentiel paramétrable) +
 * endpoint qui retourne la checklist (manquants vs présents) pour un intervenant.
 */
class RequiredDocumentTypesController extends Controller
{
    public function index()
    {
        return ['data' => RequiredDocumentType::orderBy('display_order')->orderBy('label')->get()];
    }

    public function store(Request $request)
    {
        abort_unless($request->user()?->hasRole('super_admin'), 403);
        $data = $request->validate([
            'label' => ['required', 'string', 'max:128'],
            'category_match' => ['nullable', 'string', 'max:64'],
            'applies_to' => ['nullable', 'in:all,cadre,non_cadre'],
            'is_mandatory' => ['nullable', 'boolean'],
            'description' => ['nullable', 'string'],
            'display_order' => ['nullable', 'integer'],
        ]);
        $type = RequiredDocumentType::create($data);
        return response()->json(['data' => $type], 201);
    }

    public function update(Request $request, RequiredDocumentType $requiredDocumentType)
    {
        abort_unless($request->user()?->hasRole('super_admin'), 403);
        $requiredDocumentType->update($request->validate([
            'label' => ['sometimes', 'string'],
            'category_match' => ['sometimes', 'nullable', 'string'],
            'applies_to' => ['sometimes', 'in:all,cadre,non_cadre'],
            'is_mandatory' => ['sometimes', 'boolean'],
            'description' => ['sometimes', 'nullable', 'string'],
            'display_order' => ['sometimes', 'integer'],
        ]));
        return ['data' => $requiredDocumentType->fresh()];
    }

    public function destroy(Request $request, RequiredDocumentType $requiredDocumentType)
    {
        abort_unless($request->user()?->hasRole('super_admin'), 403);
        $requiredDocumentType->delete();
        return response()->noContent();
    }

    /**
     * Checklist d'un intervenant : pour chaque type requis, indique s'il a un doc associé.
     */
    public function checklist(Request $request, Employee $employee)
    {
        $applicable = RequiredDocumentType::query()
            ->where(function ($q) use ($employee) {
                $q->where('applies_to', 'all')
                  ->orWhere('applies_to', $employee->classification);
            })
            ->orderBy('display_order')->orderBy('label')->get();

        $docs = $employee->documents ?? collect();  // assume Employee a une relation documents

        return ['data' => $applicable->map(function ($type) use ($docs) {
            $matched = $type->category_match
                ? $docs->first(fn ($d) => ($d->category ?? null) === $type->category_match)
                : null;
            return [
                'type' => $type,
                'present' => (bool) $matched,
                'document_id' => $matched?->id,
            ];
        })];
    }
}
