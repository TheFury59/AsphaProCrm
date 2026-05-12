<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Services\FacturXGenerator;
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
                AllowedFilter::callback('search', fn ($q, $v) =>
                    $q->where('reference', 'like', "%$v%")
                ),
            ])
            ->allowedSorts(['invoice_date', 'reference', 'total', 'status'])
            ->defaultSort('-invoice_date')
            ->with(['client.clientCompanies:id,client_id,company_name']);

        return ['data' => $query->paginate($perPage)];
    }

    public function show(Request $request, Invoice $invoice)
    {
        abort_unless($request->user()?->can('sales.invoices.view'), 403);
        $invoice->load(['client.clientCompanies', 'invoiceItems']);
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
        ]);

        $invoice = DB::transaction(function () use ($data) {
            // Référence auto : INV-YYYYMM-XXXX
            $ref = 'INV-' . date('Ym') . '-' . str_pad((string) (Invoice::count() + 1), 4, '0', STR_PAD_LEFT);
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
        $invoice->delete();
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
}
