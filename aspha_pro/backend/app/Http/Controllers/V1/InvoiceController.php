<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Quote;
use App\Models\ReglementInvoiceLine;
use App\Services\DocumentSequenceService;
use App\Services\FacturXGenerator;
use App\Services\PennylaneSyncService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class InvoiceController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()?->can('sales.invoices.view'), 403);
        $perPage = min((int) $request->query('per_page', 25), 100);

        $query = QueryBuilder::for(Invoice::class)
            ->allowedFilters([
                'status', 'payment_status', 'client_id', 'entity_id',
                AllowedFilter::callback('search', function ($q, $v) {
                    $q->where(function ($qq) use ($v) {
                        $qq->where('reference', 'like', "%$v%")
                            ->orWhereHas('client.company', fn ($c) => $c->where('company_name', 'like', "%$v%"));
                    });
                }),
            ])
            ->allowedSorts(['invoice_date', 'reference', 'total', 'status'])
            ->defaultSort('-invoice_date')
            ->with(['client.company:id,client_id,company_name,photo,updated_at']);

        return ['data' => $query->paginate($perPage)];
    }

    public function show(Request $request, Invoice $invoice)
    {
        abort_unless($request->user()?->can('sales.invoices.view'), 403);
        $invoice->load(['client.company', 'invoiceItems', 'reglementInvoiceLines.reglement']);
        return ['data' => $invoice];
    }

    public function store(Request $request)
    {
        abort_unless($request->user()?->can('sales.invoices.edit'), 403);
        $data = $request->validate([
            'client_id' => ['required', 'exists:clients,id'],
            'entity_id' => ['required', 'exists:entities,id'],
            'invoice_date' => ['required', 'date'],
            'due_date' => ['nullable', 'date', 'after_or_equal:invoice_date'],
            'type' => ['nullable', 'in:client,third_party,credit_note,manual'],
            'payment_mode' => ['nullable', 'string', 'max:32'],
            'comment' => ['nullable', 'string'],
            'items' => ['nullable', 'array'],
            'items.*.label' => ['required_with:items', 'string', 'max:255'],
            'items.*.quantity' => ['required_with:items', 'numeric', 'min:0'],
            'items.*.unit_price' => ['required_with:items', 'numeric', 'min:0'],
            'items.*.item_type' => ['nullable', 'in:hourly,forfait,frais,remise,produit,carte,adjustment'],
            'items.*.vat_rate_id' => ['nullable', 'exists:vat_rates,id'], // audit 2026-05-19 — TVA par ligne
        ]);

        $sequences = app(DocumentSequenceService::class);

        $invoice = DB::transaction(function () use ($data, $sequences) {
            // Numérotation atomique (audit 2026-05-19 — fix race condition count()+1)
            $ref = $sequences->next('INV');
            $invoice = Invoice::create([
                'reference' => $ref,
                'type' => $data['type'] ?? 'client',
                'client_id' => $data['client_id'],
                'entity_id' => $data['entity_id'],
                'invoice_date' => $data['invoice_date'],
                'due_date' => $data['due_date'] ?? null,
                'payment_mode' => $data['payment_mode'] ?? null,
                'payment_status' => 'unpaid',
                'status' => 'draft',
                'comment' => $data['comment'] ?? null,
                'total' => 0,
            ]);

            $total = 0;
            foreach ($data['items'] ?? [] as $item) {
                $lineTotal = (float) $item['quantity'] * (float) $item['unit_price'];
                InvoiceItem::create([
                    'invoice_id' => $invoice->id,
                    'label' => $item['label'],
                    'item_type' => $item['item_type'] ?? 'forfait',
                    'vat_rate_id' => $item['vat_rate_id'] ?? null, // audit 2026-05-19
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['unit_price'],
                    'total' => $lineTotal,
                ]);
                $total += $lineTotal;
            }
            $invoice->update(['total' => $total]);
            return $invoice;
        });

        $invoice->load('invoiceItems');
        return response()->json(['data' => $invoice], 201);
    }

    public function update(Request $request, Invoice $invoice)
    {
        abort_unless($request->user()?->can('sales.invoices.edit'), 403);
        $invoice->update($request->validate([
            'invoice_date' => ['sometimes', 'date'],
            'due_date' => ['sometimes', 'nullable', 'date'],
            'status' => ['sometimes', 'in:draft,sent,cancelled,loss'],
            'payment_status' => ['sometimes', 'in:unpaid,partial,paid,loss'],
            'comment' => ['sometimes', 'nullable', 'string'],
        ]));
        return ['data' => $invoice->fresh()];
    }

    public function destroy(Request $request, Invoice $invoice)
    {
        abort_unless($request->user()?->can('sales.invoices.edit'), 403);
        // Une facture émise (sent) ne peut plus être supprimée — obligation comptable.
        // On autorise seulement la suppression de brouillons ou annulées (draft / cancelled).
        if (! in_array($invoice->status, ['draft', 'cancelled'], true)) {
            return response()->json([
                'message' => 'Facture émise — non supprimable. Annulez-la d\'abord.',
            ], 422);
        }

        // audit 2026-05-19 — purge cascade : allocations de règlement + délier
        // un éventuel devis source (quotes.invoice_id devient null) pour éviter
        // les FK orphelines / les références mortes côté reporting.
        DB::transaction(function () use ($invoice) {
            ReglementInvoiceLine::where('invoice_id', $invoice->id)->delete();
            Quote::where('invoice_id', $invoice->id)->update(['invoice_id' => null]);
            $invoice->delete();
        });

        return response()->noContent();
    }

    /**
     * GET /api/v1/invoices/{invoice}/facturx
     *
     * Génère et retourne le PDF/A-3 Factur-X (PDF visible + XML CII embarqué)
     * conforme à la norme EN 16931, requis par l'obligation française de
     * facturation électronique à partir du 1er septembre 2026.
     */
    public function facturX(Request $request, Invoice $invoice, FacturXGenerator $generator)
    {
        abort_unless($request->user()?->can('sales.invoices.view'), 403);

        $pdf = $generator->generate($invoice);

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="' . $invoice->reference . '.pdf"',
        ]);
    }

    /**
     * GET /api/v1/invoices/{invoice}/pdf
     *
     * 2026-05-20 PDF B2B — Retourne uniquement le PDF visuel de la facture
     * (format Aspha Services, sans le XML Factur-X embarqué). Pour la version
     * conforme facturation électronique avec XML CII, utiliser /facturx.
     */
    public function pdf(Request $request, Invoice $invoice, FacturXGenerator $generator)
    {
        abort_unless($request->user()?->can('sales.invoices.view'), 403);

        $pdf = $generator->renderPdf($invoice);

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="' . $invoice->reference . '.pdf"',
        ]);
    }

    /**
     * POST /api/v1/invoices/{invoice}/sync-pennylane
     */
    public function syncPennylane(Request $request, Invoice $invoice, PennylaneSyncService $sync)
    {
        abort_unless($request->user()?->can('sales.invoices.edit'), 403);
        $invoice = $sync->syncInvoice($invoice);
        return ['data' => [
            'id' => $invoice->id,
            'reference' => $invoice->reference,
            'pennylane_id' => $invoice->pennylane_id,
            'pennylane_synced_at' => $invoice->pennylane_synced_at?->toIso8601String(),
            'mock' => ! $sync->isConfigured(),
        ]];
    }
}
