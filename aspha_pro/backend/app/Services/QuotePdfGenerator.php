<?php

// 2026-05-20 PDF B2B — Générateur PDF des devis (format Aspha Services).

namespace App\Services;

use App\Models\Quote;
use Barryvdh\DomPDF\Facade\Pdf;

/**
 * Génère le PDF d'un devis au format Aspha Services, adapté B2B.
 *
 * 2026-05-20 PDF B2B — contrairement à la facture, un devis n'est PAS une
 * facture électronique : pas de XML Factur-X embarqué, on produit un simple
 * PDF visuel via DomPDF. La charte (en-tête agence, bloc client SIRET/TVA,
 * totaux TVA par taux) est mutualisée avec la facture via SalesPdfPresenter.
 */
class QuotePdfGenerator
{
    public function __construct(private SalesPdfPresenter $presenter)
    {
    }

    /**
     * Retourne le binaire PDF du devis.
     */
    public function generate(Quote $quote): string
    {
        return Pdf::loadView('quotes.pdf', $this->presenter->forQuote($quote))->output();
    }
}
