<?php

// 2026-05-20 PDF B2B — Préparation des données pour les vues PDF devis/factures.

namespace App\Services;

use App\Models\Entity;
use App\Models\Invoice;
use App\Models\Quote;
use Illuminate\Support\Facades\Log;

/**
 * Centralise la préparation des données passées aux vues blade
 * `invoices.pdf` et `quotes.pdf`.
 *
 * 2026-05-20 PDF B2B — l'ERP génère ses propres PDF devis/factures de façon
 * autonome (pas encore d'API Pennylane/Silae). Format calqué sur les vrais
 * documents Aspha Services, adapté B2B (clients entreprises) :
 *   - bloc client avec raison sociale + SIRET + N° TVA
 *   - PAS de ligne "après avantage fiscal" (crédit d'impôt = particuliers only)
 *
 * Le calcul de TVA est dynamique par ligne via `item.vatRate.rate`
 * (fallback 20% si null, avec log warning — cf. lessons 2026-05-19).
 */
class SalesPdfPresenter
{
    private const FALLBACK_VAT_RATE = 20.0;

    /**
     * Construit le payload de la vue facture (`invoices.pdf`).
     *
     * @return array<string,mixed>
     */
    public function forInvoice(Invoice $invoice): array
    {
        $invoice->loadMissing([
            'invoiceItems.vatRate',
            'client.company',
            'entity',
            'interventionAddress',
        ]);

        $entity = $invoice->entity ?: Entity::find($invoice->entity_id);
        $items = $this->normalizeItems($invoice->invoiceItems, "facture #{$invoice->id} ({$invoice->reference})");

        return [
            'invoice' => $invoice,
            'client' => $invoice->client,
            'entity' => $entity,
            'company' => $this->companyInfo($entity),
            'header' => $this->headerInfo($entity),
            'clientBlock' => $this->clientBlock($invoice->client),
            'items' => $items,
            'totals' => $this->computeTotals($items),
            'interventionAddress' => $invoice->interventionAddress,
        ];
    }

    /**
     * Construit le payload de la vue devis (`quotes.pdf`).
     *
     * @return array<string,mixed>
     */
    public function forQuote(Quote $quote): array
    {
        $quote->loadMissing([
            'items.vatRate',
            'client.company',
            'entity',
            'address',
        ]);

        $entity = $quote->entity ?: Entity::find($quote->entity_id);
        $items = $this->normalizeItems($quote->items, "devis #{$quote->id} ({$quote->reference})");

        return [
            'quote' => $quote,
            'client' => $quote->client,
            'entity' => $entity,
            'company' => $this->companyInfo($entity),
            'header' => $this->headerInfo($entity),
            'clientBlock' => $this->clientBlock($quote->client),
            'items' => $items,
            'totals' => $this->computeTotals($items),
            'interventionAddress' => $quote->address,
        ];
    }

    /**
     * Infos société pour le pied de page légal (siège, RCS, capital).
     * Tirées de config/aspha.php — l'Entity ne porte pas ces champs.
     *
     * @return array<string,string>
     */
    private function companyInfo(?Entity $entity): array
    {
        $c = config('aspha.company');

        return [
            'legal_name' => $c['legal_name'],
            'legal_form' => $c['legal_form'],
            'head_office' => $c['head_office'],
            // SIRET du siège : on privilégie celui de l'entité s'il est défini.
            'siret' => $entity?->siret ?: $c['siret'],
            'rcs' => $c['rcs'],
            'website' => $c['website'],
        ];
    }

    /**
     * Infos d'en-tête gauche (agence émettrice).
     *
     * @return array<string,?string>
     */
    private function headerInfo(?Entity $entity): array
    {
        return [
            'agency_name' => $entity?->name ?: 'Aspha Services',
            'address' => config('aspha.agency_address_fallback'),
            'postal_city' => config('aspha.agency_postal_city_fallback'),
            'phone' => $entity?->phone,
            'email' => $entity?->email,
            'website' => config('aspha.company.website'),
            'agreement_number' => config('aspha.agreement_number'),
            'authorization_number' => config('aspha.authorization_number'),
        ];
    }

    /**
     * Bloc client (B2B) : raison sociale, SIRET, N° TVA, adresse.
     * Gère proprement le cas `client.company === null`.
     *
     * @return array<string,?string>
     */
    private function clientBlock(?\App\Models\Client $client): array
    {
        $company = $client?->company;

        // Adresse de facturation : 1re adresse de type "billing" sinon 1re dispo.
        $address = null;
        if ($client) {
            $client->loadMissing('addresses');
            $address = $client->addresses->firstWhere('type', 'billing')
                ?? $client->addresses->first();
        }

        return [
            'company_name' => $company?->company_name
                ?: ($client ? "Client #{$client->id}" : 'Client'),
            'has_company' => $company !== null,
            'siret' => $company?->siret,
            'vat_number' => $company?->vat_number,
            'address' => $address?->address,
            'postal_code' => $address?->postal_code,
            'city' => $address?->city,
        ];
    }

    /**
     * Normalise les lignes d'un document en tableau plat exploitable par la
     * vue, avec le taux de TVA résolu par ligne (fallback 20%).
     *
     * @param  iterable<object>  $rawItems
     * @return array<int,array<string,mixed>>
     */
    private function normalizeItems(iterable $rawItems, string $docLabel): array
    {
        $items = [];
        $fallbackUsed = false;

        foreach ($rawItems as $item) {
            $qty = (float) $item->quantity;
            $unitPrice = (float) $item->unit_price;
            $lineHt = (float) $item->total !== 0.0
                ? (float) $item->total
                : $qty * $unitPrice;

            $rate = $item->vatRate?->rate;
            if ($rate === null) {
                $fallbackUsed = true;
                $rate = self::FALLBACK_VAT_RATE;
            }
            $rate = (float) $rate;

            $lineVat = round($lineHt * $rate / 100, 2);

            $items[] = [
                'label' => $item->label,
                'quantity' => $qty,
                'unit_price' => $unitPrice,
                'vat_rate' => $rate,
                'total_ht' => round($lineHt, 2),
                'total_vat' => $lineVat,
                'total_ttc' => round($lineHt + $lineVat, 2),
                // PU TTC pour l'affichage colonne "PU TTC"
                'unit_price_ttc' => round($unitPrice * (1 + $rate / 100), 2),
            ];
        }

        if ($fallbackUsed) {
            Log::warning("SalesPdfPresenter — {$docLabel} : au moins une ligne sans vat_rate_id, fallback TVA 20% appliqué.");
        }

        return $items;
    }

    /**
     * Agrège les totaux d'un document : HT, TTC, et un bloc TVA par taux.
     *
     * @param  array<int,array<string,mixed>>  $items
     * @return array<string,mixed>
     */
    private function computeTotals(array $items): array
    {
        $totalHt = 0.0;
        $totalVat = 0.0;
        $byRate = [];

        foreach ($items as $line) {
            $totalHt += $line['total_ht'];
            $totalVat += $line['total_vat'];

            $key = (string) $line['vat_rate'];
            if (! isset($byRate[$key])) {
                $byRate[$key] = ['rate' => $line['vat_rate'], 'base' => 0.0, 'vat' => 0.0];
            }
            $byRate[$key]['base'] += $line['total_ht'];
            $byRate[$key]['vat'] += $line['total_vat'];
        }

        foreach ($byRate as $k => $b) {
            $byRate[$k]['base'] = round($b['base'], 2);
            $byRate[$k]['vat'] = round($b['vat'], 2);
        }
        ksort($byRate);

        return [
            'total_ht' => round($totalHt, 2),
            'total_vat' => round($totalVat, 2),
            'total_ttc' => round($totalHt + $totalVat, 2),
            'by_rate' => array_values($byRate),
        ];
    }
}
