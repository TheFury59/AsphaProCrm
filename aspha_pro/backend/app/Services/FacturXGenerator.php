<?php

namespace App\Services;

use App\Models\Entity;
use App\Models\Invoice;
use Barryvdh\DomPDF\Facade\Pdf;
use horstoeko\zugferd\codelists\ZugferdInvoiceType;
use horstoeko\zugferd\ZugferdDocumentBuilder;
use horstoeko\zugferd\ZugferdDocumentPdfMerger;
use horstoeko\zugferd\ZugferdProfiles;

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
    public function generate(Invoice $invoice): string
    {
        $invoice->loadMissing(['invoiceItems', 'client.company']);
        $entity = Entity::find($invoice->entity_id);

        // Étape 1 : PDF visible via DomPDF
        $pdfBinary = Pdf::loadView('invoices.pdf', [
            'invoice' => $invoice,
            'client' => $invoice->client,
            'entity' => $entity,
        ])->output();

        // Étape 2 : XML CII via horstoeko/zugferd
        $xml = $this->buildCiiXml($invoice, $entity);

        // Étape 3 : merger PDF + XML → PDF/A-3 Factur-X
        $merger = new ZugferdDocumentPdfMerger($xml, $pdfBinary);
        $merger->generateDocument();
        return $merger->downloadString();
    }

    private function buildCiiXml(Invoice $invoice, ?Entity $entity): string
    {
        $totalHt = (float) $invoice->total;
        $vatRate = 20.0;
        $vatAmount = round($totalHt * $vatRate / 100, 2);
        $totalTtc = round($totalHt + $vatAmount, 2);

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
            $totalHt, $vatAmount,
            null, 0.0
        );
        $doc->addDocumentTax('S', 'VAT', $totalHt, $vatAmount, $vatRate);

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
            $doc->addNewPosition((string) $position++);
            $doc->setDocumentPositionProductDetails($item->label);
            $doc->setDocumentPositionNetPrice((float) $item->unit_price);
            $doc->setDocumentPositionQuantity((float) $item->quantity, 'C62');
            $doc->addDocumentPositionTax('S', 'VAT', $vatRate);
            $doc->setDocumentPositionLineSummation((float) $item->total);
        }

        return $doc->getContent();
    }
}
