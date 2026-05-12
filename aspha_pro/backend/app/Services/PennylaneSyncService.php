<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\Quote;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Synchronise devis et factures avec Pennylane (comptabilité).
 *
 * État : implémentation **mock** pour la V1 — la cliente doit fournir une clé
 * API Pennylane avant d'activer la sync réelle.
 *
 * Si PENNYLANE_API_KEY est vide → mode mock : on génère un faux pennylane_id et
 * on met à jour pennylane_synced_at, sans appel HTTP réel.
 *
 * Quand la clé sera fournie, remplacer les corps mock par les vrais appels :
 *   POST https://app.pennylane.com/api/external/v1/customer_invoices
 *   POST https://app.pennylane.com/api/external/v1/customer_estimates
 */
class PennylaneSyncService
{
    public function isConfigured(): bool
    {
        return ! empty(config('services.pennylane.api_key'));
    }

    public function syncInvoice(Invoice $invoice): Invoice
    {
        $invoice->loadMissing(['invoiceItems', 'client.company']);

        if (! $this->isConfigured()) {
            // MODE MOCK
            $fakeId = 'pl-mock-' . Str::random(12);
            $invoice->update([
                'pennylane_id' => $fakeId,
                'pennylane_synced_at' => now(),
            ]);
            Log::info("Pennylane sync (mock) — invoice {$invoice->reference} → {$fakeId}");
            return $invoice->fresh();
        }

        // MODE RÉEL (à activer avec la vraie clé API)
        $payload = $this->buildInvoicePayload($invoice);
        $response = Http::withToken(config('services.pennylane.api_key'))
            ->baseUrl(config('services.pennylane.url'))
            ->post('/customer_invoices', $payload);

        if (! $response->successful()) {
            throw new \RuntimeException("Pennylane API error: " . $response->body());
        }

        $invoice->update([
            'pennylane_id' => $response->json('id'),
            'pennylane_synced_at' => now(),
        ]);
        return $invoice->fresh();
    }

    public function syncQuote(Quote $quote): Quote
    {
        if (! $this->isConfigured()) {
            $fakeId = 'pl-quote-mock-' . Str::random(12);
            $quote->update([
                'pennylane_id' => $fakeId,
                'pennylane_synced_at' => now(),
            ]);
            Log::info("Pennylane sync (mock) — quote {$quote->id} → {$fakeId}");
            return $quote->fresh();
        }

        // MODE RÉEL
        $response = Http::withToken(config('services.pennylane.api_key'))
            ->baseUrl(config('services.pennylane.url'))
            ->post('/customer_estimates', $this->buildQuotePayload($quote));

        if (! $response->successful()) {
            throw new \RuntimeException("Pennylane API error: " . $response->body());
        }

        $quote->update([
            'pennylane_id' => $response->json('id'),
            'pennylane_synced_at' => now(),
        ]);
        return $quote->fresh();
    }

    private function buildInvoicePayload(Invoice $invoice): array
    {
        return [
            'invoice' => [
                'reference' => $invoice->reference,
                'date' => $invoice->invoice_date,
                'deadline' => $invoice->due_date,
                'customer_id' => $invoice->client_id,  // à mapper sur l'ID Pennylane réel
                'line_items_attributes' => $invoice->invoiceItems->map(fn ($item) => [
                    'label' => $item->label,
                    'quantity' => (float) $item->quantity,
                    'unit' => 'piece',
                    'unit_amount' => (float) $item->unit_price,
                    'vat_rate' => 'FR_200',  // 20%
                ])->all(),
            ],
        ];
    }

    private function buildQuotePayload(Quote $quote): array
    {
        return [
            'estimate' => [
                'reference' => "Q-{$quote->id}",
                'date' => $quote->quote_date,
                'deadline' => $quote->validity_date,
                'customer_id' => $quote->client_id,
            ],
        ];
    }
}
