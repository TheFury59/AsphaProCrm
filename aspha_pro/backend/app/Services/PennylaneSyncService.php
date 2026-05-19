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
        $invoice->loadMissing(['invoiceItems.vatRate', 'client.company']);

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
                    // audit 2026-05-19 — TVA dynamique : map du taux réel vers le
                    // code Pennylane. Fallback FR_200 (20%) si absent (compat
                    // historique des factures sans vat_rate_id).
                    'vat_rate' => $this->mapVatRateToPennylane($item->vatRate?->rate),
                ])->all(),
            ],
        ];
    }

    /**
     * Map d'un taux numérique (5.5, 10, 20…) vers le code Pennylane (FR_055, FR_100, FR_200…).
     *
     * audit 2026-05-19 — remplace le 'FR_200' hardcodé. Pennylane attend une
     * énumération string, pas un float ; on couvre les taux français usuels.
     */
    private function mapVatRateToPennylane(?float $rate): string
    {
        if ($rate === null) {
            Log::warning('Pennylane payload : vat_rate manquant sur une ligne, fallback FR_200 (20%).');
            return 'FR_200';
        }
        return match (true) {
            abs($rate - 0.0)  < 0.01 => 'FR_000', // exonéré (services à la personne agréés)
            abs($rate - 2.1)  < 0.01 => 'FR_021',
            abs($rate - 5.5)  < 0.01 => 'FR_055',
            abs($rate - 10.0) < 0.01 => 'FR_100',
            abs($rate - 20.0) < 0.01 => 'FR_200',
            default => 'FR_200',
        };
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
