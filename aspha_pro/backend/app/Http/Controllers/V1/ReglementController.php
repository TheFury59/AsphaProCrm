<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Reglement;
use App\Models\ReglementInvoiceLine;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

/**
 * Règlements (paiements reçus) + ventilations sur factures.
 *
 * Un règlement peut être ventilé sur plusieurs factures via reglement_invoice_lines.
 * Le statut de ventilation est calculé : unallocated / partial / allocated.
 * Le statut payment_status de la facture est mis à jour automatiquement.
 */
class ReglementController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()?->can('sales.payments.record'), 403);
        $perPage = min((int) $request->query('per_page', 25), 100);

        $query = QueryBuilder::for(Reglement::class)
            ->allowedFilters([
                'status', 'payment_method', 'ventilation_status', 'client_id', 'entity_id',
                AllowedFilter::callback('search', function ($q, $v) {
                    $q->where(function ($qq) use ($v) {
                        $qq->where('reference', 'like', "%$v%")
                            ->orWhereHas('client.company', fn ($c) => $c->where('company_name', 'like', "%$v%"));
                    });
                }),
            ])
            ->allowedSorts(['operation_date', 'amount', 'created_at'])
            ->defaultSort('-operation_date')
            ->with([
                'client.company:id,client_id,company_name',
                'reglementInvoiceLines.invoice:id,reference,total',
            ]);

        return ['data' => $query->paginate($perPage)];
    }

    public function show(Request $request, Reglement $reglement)
    {
        abort_unless($request->user()?->can('sales.payments.record'), 403);
        $reglement->load([
            'client.company',
            'reglementInvoiceLines.invoice:id,reference,total,invoice_date,status,payment_status',
        ]);
        return ['data' => $reglement];
    }

    public function store(Request $request)
    {
        abort_unless($request->user()?->can('sales.payments.record'), 403);

        $data = $request->validate([
            'client_id' => ['required', 'exists:clients,id'],
            'entity_id' => ['required', 'exists:entities,id'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'payment_method' => ['required', 'in:cash,check,card,transfer,cesu,sepa'],
            'operation_date' => ['required', 'date'],
            'value_date' => ['nullable', 'date'],
            'description' => ['nullable', 'string'],
            'allocations' => ['nullable', 'array'],
            'allocations.*.invoice_id' => ['required_with:allocations', 'exists:invoices,id'],
            'allocations.*.amount' => ['required_with:allocations', 'numeric', 'min:0.01'],
        ]);

        $reglement = DB::transaction(function () use ($data) {
            $ref = 'PAY-' . date('Ym') . '-' . str_pad((string) (Reglement::count() + 1), 4, '0', STR_PAD_LEFT);
            $reglement = Reglement::create([
                'reference' => $ref,
                'type' => 'reglement',
                'status' => 'received',
                'is_non_deductible' => false,
                'client_id' => $data['client_id'],
                'entity_id' => $data['entity_id'],
                'amount' => $data['amount'],
                'payment_method' => $data['payment_method'],
                'operation_date' => $data['operation_date'],
                'value_date' => $data['value_date'] ?? $data['operation_date'],
                'description' => $data['description'] ?? null,
                'ventilation_status' => 'unallocated',
            ]);

            // Ventilation immédiate si fournie
            if (! empty($data['allocations'])) {
                $totalAllocated = 0;
                foreach ($data['allocations'] as $alloc) {
                    ReglementInvoiceLine::create([
                        'reglement_id' => $reglement->id,
                        'invoice_id' => $alloc['invoice_id'],
                        'allocated_amount' => $alloc['amount'],
                    ]);
                    $totalAllocated += $alloc['amount'];
                    $this->updateInvoicePaymentStatus($alloc['invoice_id']);
                }
                $reglement->update([
                    'ventilation_status' => $totalAllocated >= $data['amount'] ? 'allocated' : 'partial',
                ]);
            }
            return $reglement;
        });

        $reglement->load(['client.company', 'reglementInvoiceLines']);
        return response()->json(['data' => $reglement], 201);
    }

    /**
     * Ajoute une ventilation à un règlement existant.
     */
    public function allocate(Request $request, Reglement $reglement)
    {
        abort_unless($request->user()?->can('sales.payments.record'), 403);
        $data = $request->validate([
            'invoice_id' => ['required', 'exists:invoices,id'],
            'amount' => ['required', 'numeric', 'min:0.01'],
        ]);

        DB::transaction(function () use ($data, $reglement) {
            ReglementInvoiceLine::create([
                'reglement_id' => $reglement->id,
                'invoice_id' => $data['invoice_id'],
                'allocated_amount' => $data['amount'],
            ]);
            $totalAllocated = (float) $reglement->reglementInvoiceLines()->sum('allocated_amount');
            $reglement->update([
                'ventilation_status' => $totalAllocated >= (float) $reglement->amount ? 'allocated' : 'partial',
            ]);
            $this->updateInvoicePaymentStatus($data['invoice_id']);
        });

        return ['data' => $reglement->fresh()->load('reglementInvoiceLines')];
    }

    public function destroy(Request $request, Reglement $reglement)
    {
        abort_unless($request->user()?->can('sales.payments.record'), 403);
        $invoiceIds = $reglement->reglementInvoiceLines()->pluck('invoice_id')->all();
        $reglement->delete();
        foreach ($invoiceIds as $id) {
            $this->updateInvoicePaymentStatus($id);
        }
        return response()->noContent();
    }

    /**
     * Recalcule le payment_status d'une facture en fonction de ses règlements ventilés.
     */
    private function updateInvoicePaymentStatus(int $invoiceId): void
    {
        $invoice = Invoice::find($invoiceId);
        if (! $invoice) return;
        $totalAllocated = ReglementInvoiceLine::where('invoice_id', $invoiceId)->sum('allocated_amount');
        $totalTtc = (float) $invoice->total * 1.20;  // TVA 20% hardcodée pour le MVP
        $status = match (true) {
            $totalAllocated <= 0.001 => 'unpaid',
            $totalAllocated >= $totalTtc - 0.01 => 'paid',
            default => 'partial',
        };
        $invoice->update(['payment_status' => $status]);
    }
}
