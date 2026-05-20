<?php

namespace App\Services;

use App\Models\Entity;
use App\Models\Invoice;
use Barryvdh\DomPDF\Facade\Pdf;
use horstoeko\zugferd\codelists\ZugferdInvoiceType;
use horstoeko\zugferd\ZugferdDocumentBuilder;
use horstoeko\zugferd\ZugferdDocumentPdfMerger;
use horstoeko\zugferd\ZugferdProfiles;
use Illuminate\Support\Facades\Log;

/**
 * Génère une facture au format Factur-X (PDF/A-3 + XML CII embarqué).
 *
 * Factur-X = standard franco-allemand de facture électronique :
 *   - PDF/A-3 visuellement lisible
 *   - XML CII (Cross Industry Invoice, norme EN 16931) embarqué dedans
 *
 * Profil utilisé : EN16931 — suffisant pour Chorus Pro et l'obligation
 * française de facturation électronique à partir du 1er septembre 2026.
 */
class FacturXGenerator
{
    public function __construct(private SalesPdfPresenter $presenter)
    {
    }

    public function generate(Invoice $invoice): string
    {
        $invoice->loadMissing(['invoiceItems.vatRate', 'client.company']);
        $entity = Entity::find($invoice->entity_id);

        // Étape 1 : PDF visible via DomPDF
        // 2026-05-20 PDF B2B — la vue facture est refondue au format Aspha
        // Services (clients entreprises). Les données complètes (en-tête agence,
        // bloc client SIRET/TVA, totaux TVA par taux) sont préparées par le
        // SalesPdfPresenter, partagé avec le générateur de devis.
        $pdfBinary = $this->renderPdf($invoice);

        // Étape 2 : XML CII via horstoeko/zugferd
        $xml = $this->buildCiiXml($invoice, $entity);

        // Étape 3 : merger PDF + XML → PDF/A-3 Factur-X
        $merger = new ZugferdDocumentPdfMerger($xml, $pdfBinary);
        $merger->generateDocument();
        return $merger->downloadString();
    }

    /**
     * 2026-05-20 PDF B2B — Génère uniquement le PDF visuel de la facture
     * (sans le XML Factur-X embarqué). Utilisé par le endpoint
     * GET /api/v1/invoices/{invoice}/pdf.
     */
    public function renderPdf(Invoice $invoice): string
    {
        return Pdf::loadView('invoices.pdf', $this->presenter->forInvoice($invoice))->output();
    }

    private function buildCiiXml(Invoice $invoice, ?Entity $entity): string
    {
        // audit 2026-05-19 — TVA dynamique par ligne. On groupe par taux pour
        // construire les blocs de TVA conformes EN16931 (un addDocumentTax
        // par taux distinct). Fallback 20% silencieux si aucune ligne n'a de
        // vat_rate (compat historique).
        $vatBreakdown = $this->computeVatBreakdown($invoice);
        $totalHt = $vatBreakdown['total_ht'];
        $totalVat = $vatBreakdown['total_vat'];
        $totalTtc = round($totalHt + $totalVat, 2);

        $client = $invoice->client;

        $doc = ZugferdDocumentBuilder::createNew(ZugferdProfiles::PROFILE_EN16931);

        $doc->setDocumentInformation(
            $invoice->reference,
            ZugferdInvoiceType::INVOICE,
            new \DateTime((string) $invoice->invoice_date),
            'EUR'
        );

        // Émetteur
        $doc->setDocumentSeller($entity?->name ?? 'Aspha Service');
        if ($entity?->siret) {
            $doc->addDocumentSellerTaxRegistration('FC', $entity->siret);
        }

        // Acheteur
        $doc->setDocumentBuyer(
            $client?->company?->company_name ?? "Client #{$invoice->client_id}",
            (string) $invoice->client_id
        );
        if ($client?->company?->vat_number) {
            $doc->addDocumentBuyerTaxRegistration('VA', $client->company->vat_number);
        }
        if ($client?->company?->siret) {
            $doc->addDocumentBuyerTaxRegistration('FC', $client->company->siret);
        }

        // Totaux
        $doc->setDocumentSummation(
            $totalTtc, $totalTtc, $totalHt,
            0.0, 0.0,
            $totalHt, $totalVat,
            null, 0.0
        );
        // audit 2026-05-19 — un bloc TVA par taux distinct (conforme EN16931)
        foreach ($vatBreakdown['by_rate'] as $rate => $bucket) {
            $doc->addDocumentTax('S', 'VAT', $bucket['ht'], $bucket['vat'], (float) $rate);
        }

        // Échéance
        if ($invoice->due_date) {
            $doc->addDocumentPaymentTerm(
                'Paiement à réception',
                new \DateTime((string) $invoice->due_date)
            );
        }

        // Lignes
        $position = 1;
        foreach ($invoice->invoiceItems as $item) {
            // audit 2026-05-19 — taux par ligne (fallback 20% si null)
            $lineRate = $item->vatRate?->rate !== null ? (float) $item->vatRate->rate : 20.0;
            $doc->addNewPosition((string) $position++);
            $doc->setDocumentPositionProductDetails($item->label);
            $doc->setDocumentPositionNetPrice((float) $item->unit_price);
            $doc->setDocumentPositionQuantity((float) $item->quantity, 'C62');
            $doc->addDocumentPositionTax('S', 'VAT', $lineRate);
            $doc->setDocumentPositionLineSummation((float) $item->total);
        }

        return $doc->getContent();
    }

    /**
     * Calcule le breakdown TVA par taux pour une facture.
     *
     * audit 2026-05-19 — remplace le `$vatRate = 20.0` hardcodé. Retourne
     * {total_ht, total_vat, by_rate: [rate => {ht, vat}]} pour alimenter à la
     * fois les totaux globaux et les blocs `addDocumentTax` EN16931.
     *
     * Fallback 20% silencieux si une ligne n'a pas de vat_rate_id (log warning).
     */
    private function computeVatBreakdown(Invoice $invoice): array
    {
        $byRate = [];
        $totalHt = 0.0;
        $totalVat = 0.0;
        $fallbackUsed = false;

        foreach ($invoice->invoiceItems as $item) {
            $lineHt = (float) $item->total !== 0.0
                ? (float) $item->total
                : (float) $item->quantity * (float) $item->unit_price;

            $rate = $item->vatRate?->rate;
            if ($rate === null) {
                $fallbackUsed = true;
                $rate = 20.0;
            }
            $rateKey = (string) (float) $rate; // canonicalise "20" / "20.0" / "20.00"

            $lineVat = round($lineHt * (float) $rate / 100, 2);

            if (! isset($byRate[$rateKey])) {
                $byRate[$rateKey] = ['ht' => 0.0, 'vat' => 0.0];
            }
            $byRate[$rateKey]['ht'] += $lineHt;
            $byRate[$rateKey]['vat'] += $lineVat;
            $totalHt += $lineHt;
            $totalVat += $lineVat;
        }

        // Au moins un bucket si aucune ligne (sécurité — devrait ne pas arriver
        // en pratique mais évite un Factur-X invalide sans bloc TVA).
        if (empty($byRate)) {
            $byRate['20'] = ['ht' => 0.0, 'vat' => 0.0];
        }

        // Round final pour cohérence d'affichage
        foreach ($byRate as $k => $b) {
            $byRate[$k] = ['ht' => round($b['ht'], 2), 'vat' => round($b['vat'], 2)];
        }

        if ($fallbackUsed) {
            Log::warning("FacturX invoice #{$invoice->id} ({$invoice->reference}) : au moins une ligne sans vat_rate_id, fallback TVA 20% appliqué.");
        }

        return [
            'total_ht' => round($totalHt, 2),
            'total_vat' => round($totalVat, 2),
            'by_rate' => $byRate,
        ];
    }
}
