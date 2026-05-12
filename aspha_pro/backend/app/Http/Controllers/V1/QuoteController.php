<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\Quote;
use App\Services\PennylaneSyncService;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class QuoteController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()?->can('sales.quotes.view'), 403);
        $perPage = min((int) $request->query('per_page', 25), 100);

        $query = QueryBuilder::for(Quote::class)
            ->allowedFilters([
                'status', 'client_id', 'entity_id',
                AllowedFilter::callback('search', fn ($q, $v) =>
                    $q->whereHas('client.company', fn ($c) => $c->where('company_name', 'like', "%$v%"))
                ),
            ])
            ->allowedSorts(['quote_date', 'created_at', 'status'])
            ->defaultSort('-quote_date')
            ->with(['client.company:id,client_id,company_name']);

        return ['data' => $query->paginate($perPage)];
    }

    public function show(Request $request, Quote $quote)
    {
        abort_unless($request->user()?->can('sales.quotes.view'), 403);
        $quote->load(['client.company', 'quoteType', 'address', 'ownerUser:id,name']);
        return ['data' => $quote];
    }

    public function store(Request $request)
    {
        abort_unless($request->user()?->can('sales.quotes.edit'), 403);
        $data = $request->validate([
            'client_id' => ['required', 'exists:clients,id'],
            'entity_id' => ['required', 'exists:entities,id'],
            'quote_date' => ['required', 'date'],
            'validity_date' => ['nullable', 'date'],
            'nature' => ['nullable', 'in:regular,punctual'],
            'billing_mode' => ['nullable', 'string', 'max:64'],
            'status' => ['nullable', 'in:draft,sent,accepted,refused,expired'],
            'comment' => ['nullable', 'string'],
        ]);
        $data['status'] = $data['status'] ?? 'draft';
        $data['owner_user_id'] = $request->user()->id;
        $quote = Quote::create($data);
        return response()->json(['data' => $quote], 201);
    }

    public function update(Request $request, Quote $quote)
    {
        abort_unless($request->user()?->can('sales.quotes.edit'), 403);
        $quote->update($request->validate([
            'quote_date' => ['sometimes', 'date'],
            'validity_date' => ['sometimes', 'nullable', 'date'],
            'status' => ['sometimes', 'in:draft,sent,accepted,refused,expired'],
            'comment' => ['sometimes', 'nullable', 'string'],
            'success_rate' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:100'],
        ]));
        return ['data' => $quote->fresh()];
    }

    public function destroy(Request $request, Quote $quote)
    {
        abort_unless($request->user()?->can('sales.quotes.edit'), 403);
        $quote->delete();
        return response()->noContent();
    }

    public function syncPennylane(Request $request, Quote $quote, PennylaneSyncService $sync)
    {
        abort_unless($request->user()?->can('sales.quotes.edit'), 403);
        $quote = $sync->syncQuote($quote);
        return ['data' => [
            'id' => $quote->id,
            'pennylane_id' => $quote->pennylane_id,
            'pennylane_synced_at' => $quote->pennylane_synced_at?->toIso8601String(),
            'mock' => ! $sync->isConfigured(),
        ]];
    }
}
