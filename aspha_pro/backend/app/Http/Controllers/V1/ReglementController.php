<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Reglement;
use App\Models\ReglementInvoiceLine;
use App\Services\DocumentSequenceService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
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
                'client.company:id,client_id,company_name,photo,updated_at',
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

        // audit 2026-05-19 — check over-allocation : sum(allocations) <= amount
        // (sinon le règlement vaudrait plus que ce que le client a réellement
        // versé, ce qui passerait silencieusement à 'allocated' et fausserait
        // le statut paiement des factures côté ventilation_status).
        if (! empty($data['allocations'])) {
            $totalAlloc = collect($data['allocations'])->sum(fn ($a) => (float) $a['amount']);
            if ($totalAlloc > (float) $data['amount'] + 0.01) {
                return response()->json([
                    'message' => 'Montant alloué (' . number_format($totalAlloc, 2) . ') dépasse le règlement (' . number_format((float) $data['amount'], 2) . ').',
                ], 422);
            }

            // Check par facture : on ne peut pas ventiler plus que le restant dû
            // d'une facture (en tenant compte des règlements antérieurs ET du
            // total TTC réel via les lignes/TVA, pas via le hardcodé 20%).
            $byInvoice = collect($data['allocations'])->groupBy('invoice_id');
            foreach ($byInvoice as $invoiceId => $rows) {
                $invoice = Invoice::find($invoiceId);
                if (! $invoice) continue;
                $newAlloc = $rows->sum(fn ($r) => (float) $r['amount']);
                $existing = (float) ReglementInvoiceLine::where('invoice_id', $invoiceId)->sum('allocated_amount');
                $totalTtc = $this->computeInvoiceTotalTtc($invoice);
                if ($newAlloc + $existing > $totalTtc + 0.01) {
                    return response()->json([
                        'message' => "Facture #{$invoice->reference} : ventilation cumulée (" . number_format($newAlloc + $existing, 2) . ') dépasse le TTC dû (' . number_format($totalTtc, 2) . ').',
                    ], 422);
                }
            }
        }

        $sequences = app(DocumentSequenceService::class);

        $reglement = DB::transaction(function () use ($data, $sequences) {
            // Numérotation atomique (audit 2026-05-19 — fix race condition count()+1)
            $ref = $sequences->next('PAY');
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
                    'ventilation_status' => $totalAllocated >= $data['amount'] - 0.01 ? 'allocated' : 'partial',
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

        // audit 2026-05-19 — over-allocation checks (cf. store())
        $existingOnReglement = (float) $reglement->reglementInvoiceLines()->sum('allocated_amount');
        if ($existingOnReglement + (float) $data['amount'] > (float) $reglement->amount + 0.01) {
            return response()->json([
                'message' => 'Ventilation cumulée (' . number_format($existingOnReglement + (float) $data['amount'], 2) . ') dépasse le règlement (' . number_format((float) $reglement->amount, 2) . ').',
            ], 422);
        }

        $invoice = Invoice::find($data['invoice_id']);
        if ($invoice) {
            $existingOnInvoice = (float) ReglementInvoiceLine::where('invoice_id', $invoice->id)->sum('allocated_amount');
            $totalTtc = $this->computeInvoiceTotalTtc($invoice);
            if ($existingOnInvoice + (float) $data['amount'] > $totalTtc + 0.01) {
                return response()->json([
                    'message' => "Facture #{$invoice->reference} : ventilation cumulée (" . number_format($existingOnInvoice + (float) $data['amount'], 2) . ') dépasse le TTC dû (' . number_format($totalTtc, 2) . ').',
                ], 422);
            }
        }

        DB::transaction(function () use ($data, $reglement) {
            ReglementInvoiceLine::create([
                'reglement_id' => $reglement->id,
                'invoice_id' => $data['invoice_id'],
                'allocated_amount' => $data['amount'],
            ]);
            $totalAllocated = (float) $reglement->reglementInvoiceLines()->sum('allocated_amount');
            $reglement->update([
                'ventilation_status' => $totalAllocated >= (float) $reglement->amount - 0.01 ? 'allocated' : 'partial',
            ]);
            $this->updateInvoicePaymentStatus($data['invoice_id']);
        });

        return ['data' => $reglement->fresh()->load('reglementInvoiceLines')];
    }

    public function destroy(Request $request, Reglement $reglement)
    {
        abort_unless($request->user()?->can('sales.payments.record'), 403);

        // audit 2026-05-19 — purge cascade : on supprime explicitement les
        // lignes de ventilation avant le reglement. Sans cela les FK orphelines
        // restaient en BDD (on s'appuyait sur le cascade SQL implicite, qui
        // peut être absent selon la migration / le driver).
        $invoiceIds = $reglement->reglementInvoiceLines()->pluck('invoice_id')->all();

        DB::transaction(function () use ($reglement) {
            ReglementInvoiceLine::where('reglement_id', $reglement->id)->delete();
            $reglement->delete();
        });

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
        $totalAllocated = (float) ReglementInvoiceLine::where('invoice_id', $invoiceId)->sum('allocated_amount');
        $totalTtc = $this->computeInvoiceTotalTtc($invoice);
        $status = match (true) {
            $totalAllocated <= 0.001 => 'unpaid',
            $totalAllocated >= $totalTtc - 0.01 => 'paid',
            default => 'partial',
        };
        $invoice->update(['payment_status' => $status]);
    }

    /**
     * Calcule le total TTC d'une facture à partir des lignes (qty × pu × (1 + rate/100)).
     *
     * audit 2026-05-19 — remplace le `$invoice->total * 1.20` hardcodé.
     * Si une ligne n'a pas de `vat_rate_id`, fallback silencieux à 20% pour
     * compatibilité historique (les factures déjà émises restent valides).
     * Log warning à chaque fallback pour traquer la dette.
     */
    private function computeInvoiceTotalTtc(Invoice $invoice): float
    {
        $invoice->loadMissing(['invoiceItems.vatRate']);
        if ($invoice->invoiceItems->isEmpty()) {
            // Pas d'items (devrait être rare) → on retombe sur le total scalaire
            // de la facture supposé HT, avec fallback TVA 20%.
            return (float) $invoice->total * 1.20;
        }

        $totalTtc = 0.0;
        $fallbackUsed = false;

        foreach ($invoice->invoiceItems as $item) {
            $lineHt = (float) $item->quantity * (float) $item->unit_price;
            $rate = $item->vatRate?->rate;
            if ($rate === null) {
                $fallbackUsed = true;
                $rate = 20.0;
            }
            $totalTtc += $lineHt * (1 + (float) $rate / 100);
        }

        if ($fallbackUsed) {
            Log::warning("Invoice #{$invoice->id} ({$invoice->reference}) : au moins une ligne sans vat_rate_id, fallback TVA 20% appliqué.");
        }

        return round($totalTtc, 2);
    }
}
