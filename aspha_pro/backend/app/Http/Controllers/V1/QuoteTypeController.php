<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\QuoteType;
use Illuminate\Http\Request;

/**
 * CRUD des types de devis (table `quote_types`).
 *
 * Un type de devis est un modèle pré-paramétré : modalité, nature
 * (régulier/ponctuel), mode et rythme de facturation, durée d'engagement,
 * acompte. Il est sélectionnable à la création d'un devis pour pré-remplir
 * ces réglages. Géré par les admins.
 *
 * 2026-05-20 — ajouté suite à la refonte du flux de création de devis.
 */
class QuoteTypeController extends Controller
{
    public function index(Request $request)
    {
        // Lecture : accessible à quiconque peut éditer un devis (il en a
        // besoin pour le sélecteur du formulaire de création).
        abort_unless($request->user()?->can('sales.quotes.view'), 403);

        $query = QuoteType::query()->orderBy('label');
        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }
        if ($request->filled('entity_id')) {
            $query->where('entity_id', $request->integer('entity_id'));
        }

        return ['data' => $query->with('entity:id,name')->get()];
    }

    public function show(Request $request, QuoteType $quoteType)
    {
        abort_unless($request->user()?->can('sales.quotes.view'), 403);
        return ['data' => $quoteType->load('entity:id,name')];
    }

    public function store(Request $request)
    {
        $this->authorizeManage($request);
        $data = $this->validatePayload($request, isUpdate: false);
        $quoteType = QuoteType::create($data);
        return response()->json(['data' => $quoteType->load('entity:id,name')], 201);
    }

    public function update(Request $request, QuoteType $quoteType)
    {
        $this->authorizeManage($request);
        $data = $this->validatePayload($request, isUpdate: true);
        $quoteType->update($data);
        return ['data' => $quoteType->fresh('entity:id,name')];
    }

    public function destroy(Request $request, QuoteType $quoteType)
    {
        $this->authorizeManage($request);
        // Soft "delete" métier : on désactive. La FK quotes.quote_type_id est
        // restrictOnDelete — on ne supprime jamais physiquement un type
        // référencé par des devis. Réactivable via update(status).
        $quoteType->update(['status' => 'inactive']);
        return response()->noContent();
    }

    private function authorizeManage(Request $request): void
    {
        $user = $request->user();
        abort_unless(
            $user && ($user->hasRole('super_admin') || $user->hasRole('admin')),
            403,
            'Seuls les administrateurs peuvent gérer les types de devis.',
        );
    }

    private function validatePayload(Request $request, bool $isUpdate): array
    {
        $req = fn () => $isUpdate ? 'sometimes' : 'required';

        return $request->validate([
            'entity_id' => ['nullable', 'exists:entities,id'],
            'label' => [$req(), 'string', 'max:255'],
            'modality' => ['nullable', 'string', 'max:64'],
            'nature' => ['nullable', 'in:regular,punctual'],
            'billing_mode' => ['nullable', 'string', 'max:64'],
            'quote_calculation' => ['nullable', 'in:per_week,per_month,per_unit'],
            'commitment_duration' => ['nullable', 'string', 'max:32'],
            'billing_rhythm' => ['nullable', 'string', 'max:64'],
            'deposit_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'status' => ['nullable', 'in:active,inactive'],
        ]);
    }
}
