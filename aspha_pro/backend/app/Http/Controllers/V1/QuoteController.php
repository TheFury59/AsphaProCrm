<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Quote;
use App\Models\QuoteItem;
use App\Services\DocumentSequenceService;
use App\Services\PennylaneSyncService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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
                AllowedFilter::callback('search', function ($q, $v) {
                    $q->where(function ($qq) use ($v) {
                        $qq->where('reference', 'like', "%$v%")
                            ->orWhereHas('client.company', fn ($c) => $c->where('company_name', 'like', "%$v%"));
                    });
                }),
            ])
            ->allowedSorts(['quote_date', 'created_at', 'status', 'reference', 'total'])
            ->defaultSort('-quote_date')
            ->with(['client.company:id,client_id,company_name,photo,updated_at']);

        return ['data' => $query->paginate($perPage)];
    }

    public function show(Request $request, Quote $quote)
    {
        abort_unless($request->user()?->can('sales.quotes.view'), 403);
        $quote->load(['client.company', 'quoteType', 'address', 'ownerUser:id,name', 'items']);
        return ['data' => $quote];
    }

    public function store(Request $request)
    {
        abort_unless($request->user()?->can('sales.quotes.edit'), 403);
        $data = $request->validate([
            'client_id' => ['required', 'exists:clients,id'],
            'entity_id' => ['required', 'exists:entities,id'],
            'quote_type_id' => ['nullable', 'exists:quote_types,id'],
            'quote_date' => ['required', 'date'],
            'validity_date' => ['nullable', 'date'],
            'nature' => ['nullable', 'in:regular,punctual'],
            'billing_mode' => ['nullable', 'string', 'max:64'],
            'status' => ['nullable', 'in:draft,sent,accepted,refused,expired'],
            'comment' => ['nullable', 'string'],
            'items' => ['nullable', 'array'],
            'items.*.label' => ['required_with:items', 'string', 'max:255'],
            'items.*.quantity' => ['required_with:items', 'numeric', 'min:0'],
            'items.*.unit_price' => ['required_with:items', 'numeric', 'min:0'],
            'items.*.item_type' => ['nullable', 'in:hourly,forfait,frais,remise,produit,carte,adjustment'],
            'items.*.vat_rate_id' => ['nullable', 'exists:vat_rates,id'], // audit 2026-05-19 — TVA par ligne
        ]);

        $userId = $request->user()->id;
        $sequences = app(DocumentSequenceService::class);

        $quote = DB::transaction(function () use ($data, $userId, $sequences) {
            // Quote_type fallback : take first available if not provided
            $quoteTypeId = $data['quote_type_id'] ?? optional(\App\Models\QuoteType::query()->first())->id;

            // Référence auto atomique (audit 2026-05-19 — fix race condition count()+1)
            $ref = $sequences->next('QUO');

            $quote = Quote::create([
                'reference' => $ref,
                'client_id' => $data['client_id'],
                'entity_id' => $data['entity_id'],
                'quote_type_id' => $quoteTypeId,
                'owner_user_id' => $userId,
                'quote_date' => $data['quote_date'],
                'validity_date' => $data['validity_date'] ?? null,
                'nature' => $data['nature'] ?? 'regular',
                'billing_mode' => $data['billing_mode'] ?? null,
                'status' => $data['status'] ?? 'draft',
                'comment' => $data['comment'] ?? null,
                'total' => 0,
            ]);

            $total = 0;
            $order = 0;
            foreach ($data['items'] ?? [] as $item) {
                $lineTotal = (float) $item['quantity'] * (float) $item['unit_price'];
                QuoteItem::create([
                    'quote_id' => $quote->id,
                    'label' => $item['label'],
                    'item_type' => $item['item_type'] ?? 'forfait',
                    'vat_rate_id' => $item['vat_rate_id'] ?? null, // audit 2026-05-19
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['unit_price'],
                    'total' => $lineTotal,
                    'order' => $order++,
                ]);
                $total += $lineTotal;
            }
            $quote->update(['total' => $total]);
            return $quote;
        });

        $quote->load(['client.company', 'items']);
        return response()->json(['data' => $quote], 201);
    }

    public function update(Request $request, Quote $quote)
    {
        abort_unless($request->user()?->can('sales.quotes.edit'), 403);

        // audit 2026-05-19 — un devis déjà converti en facture est verrouillé
        // (sinon on pourrait modifier les lignes alors que la facture émise
        // a déjà été générée → incohérence comptable).
        abort_if($quote->invoice_id !== null, 409, 'Devis converti en facture — non modifiable.');

        $data = $request->validate([
            'quote_date' => ['sometimes', 'date'],
            'validity_date' => ['sometimes', 'nullable', 'date'],
            'status' => ['sometimes', 'in:draft,sent,accepted,refused,expired'],
            'comment' => ['sometimes', 'nullable', 'string'],
            'success_rate' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:100'],
            'items' => ['sometimes', 'array'],
            'items.*.label' => ['required_with:items', 'string', 'max:255'],
            'items.*.quantity' => ['required_with:items', 'numeric', 'min:0'],
            'items.*.unit_price' => ['required_with:items', 'numeric', 'min:0'],
            'items.*.item_type' => ['nullable', 'in:hourly,forfait,frais,remise,produit,carte,adjustment'],
            'items.*.vat_rate_id' => ['nullable', 'exists:vat_rates,id'], // audit 2026-05-19
        ]);

        DB::transaction(function () use ($data, $quote) {
            $scalar = collect($data)->except('items')->all();
            if (! empty($scalar)) {
                $quote->update($scalar);
            }
            if (array_key_exists('items', $data)) {
                $quote->items()->delete();
                $total = 0;
                $order = 0;
                foreach ($data['items'] as $item) {
                    $lineTotal = (float) $item['quantity'] * (float) $item['unit_price'];
                    QuoteItem::create([
                        'quote_id' => $quote->id,
                        'label' => $item['label'],
                        'item_type' => $item['item_type'] ?? 'forfait',
                        'vat_rate_id' => $item['vat_rate_id'] ?? null, // audit 2026-05-19
                        'quantity' => $item['quantity'],
                        'unit_price' => $item['unit_price'],
                        'total' => $lineTotal,
                        'order' => $order++,
                    ]);
                    $total += $lineTotal;
                }
                $quote->update(['total' => $total]);
            }
        });

        return ['data' => $quote->fresh(['items', 'client.company'])];
    }

    public function destroy(Request $request, Quote $quote)
    {
        abort_unless($request->user()?->can('sales.quotes.edit'), 403);
        $quote->delete();
        return response()->noContent();
    }

    /**
     * POST /api/v1/quotes/{quote}/convert-to-invoice
     *
     * Crée une Invoice draft à partir du devis : copie client/entity/items,
     * passe le statut du devis à "accepted" si en draft/sent.
     */
    public function convertToInvoice(Request $request, Quote $quote)
    {
        abort_unless($request->user()?->can('sales.invoices.edit'), 403);

        // audit 2026-05-19 — anti double-conversion : une fois converti, le devis
        // est lié à sa facture (quotes.invoice_id). 409 explicite pour le front.
        abort_if($quote->invoice_id !== null, 409, 'Devis déjà converti en facture.');

        $quote->load('items');
        $sequences = app(DocumentSequenceService::class);

        $invoice = DB::transaction(function () use ($quote, $sequences) {
            // Numérotation atomique (audit 2026-05-19 — fix race condition count()+1)
            $ref = $sequences->next('INV');
            $invoice = Invoice::create([
                'reference' => $ref,
                'type' => 'client',
                'client_id' => $quote->client_id,
                'entity_id' => $quote->entity_id,
                'invoice_date' => now()->toDateString(),
                'due_date' => null,
                'payment_status' => 'unpaid',
                'status' => 'draft',
                'comment' => 'Issue du devis ' . ($quote->reference ?? "#{$quote->id}"),
                'total' => 0,
            ]);

            $total = 0;
            foreach ($quote->items as $qi) {
                InvoiceItem::create([
                    'invoice_id' => $invoice->id,
                    'label' => $qi->label,
                    'item_type' => $qi->item_type ?? 'forfait',
                    'vat_rate_id' => $qi->vat_rate_id, // audit 2026-05-19 — propage la TVA par ligne
                    'quantity' => $qi->quantity,
                    'unit_price' => $qi->unit_price,
                    'total' => $qi->total,
                ]);
                $total += (float) $qi->total;
            }
            $invoice->update(['total' => $total]);

            if (in_array($quote->status, ['draft', 'sent'], true)) {
                $quote->update(['status' => 'accepted']);
            }

            // audit 2026-05-19 — lock le devis à la facture émise
            $quote->update(['invoice_id' => $invoice->id]);

            return $invoice;
        });

        $invoice->load(['client.company', 'invoiceItems']);
        return response()->json(['data' => $invoice], 201);
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
