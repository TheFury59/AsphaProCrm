{{-- 2026-05-20 PDF B2B — Devis au format Aspha Services, adapté clients entreprises. --}}
@php
    use Carbon\Carbon;
    $fmtDate = fn ($d) => $d ? Carbon::parse($d)->format('d/m/Y') : null;
    $fmtMoney = fn ($n) => number_format((float) $n, 2, ',', ' ') . ' €';
    $fmtQty = fn ($n) => rtrim(rtrim(number_format((float) $n, 2, ',', ' '), '0'), ',');
@endphp
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Devis {{ $quote->reference }}</title>
    <style>
        @page { margin: 18mm 16mm 26mm 16mm; }
        * { box-sizing: border-box; }
        body { font-family: DejaVu Sans, sans-serif; font-size: 10px; color: #1a1a1a; line-height: 1.45; }
        h1, h2, h3, p { margin: 0; padding: 0; }

        .header { display: table; width: 100%; margin-bottom: 18px; }
        .header > div { display: table-cell; vertical-align: top; }
        .header .left { width: 55%; }
        .header .right { width: 45%; text-align: right; }
        .agency-name { font-size: 17px; font-weight: bold; color: #1f6f8b; margin-bottom: 4px; }
        .small { font-size: 9px; }
        .muted { color: #555; }

        .doc-title { font-size: 22px; font-weight: bold; color: #1f6f8b; margin-bottom: 6px; }
        .doc-meta { font-size: 9.5px; }

        .client-box { float: right; width: 52%; border: 1px solid #bbb; padding: 8px 10px; margin-bottom: 14px; }
        .client-box .cb-label { font-size: 8px; text-transform: uppercase; letter-spacing: .5px; color: #777; margin-bottom: 3px; }
        .client-box .cb-name { font-weight: bold; font-size: 11.5px; }
        .clearfix { clear: both; }

        .info-line { margin-bottom: 2px; }
        .info-line .lbl { font-weight: bold; }

        table.items { width: 100%; border-collapse: collapse; margin: 6px 0 14px; }
        table.items th, table.items td { border: 1px solid #333; padding: 5px 7px; }
        table.items th { background: #1f6f8b; color: #fff; font-size: 9px; text-transform: uppercase; text-align: left; }
        table.items td.num { text-align: right; }
        table.items tbody tr:nth-child(even) td { background: #f4f7f8; }

        .totals { width: 46%; margin-left: auto; margin-bottom: 14px; }
        .totals table { width: 100%; border-collapse: collapse; }
        .totals td { padding: 4px 8px; border: 1px solid #333; }
        .totals td.lbl { background: #f4f7f8; }
        .totals td.val { text-align: right; }
        .totals tr.grand td { font-weight: bold; font-size: 11.5px; background: #1f6f8b; color: #fff; }

        .legal { font-size: 8.5px; color: #444; margin-top: 10px; }
        .legal p { margin-bottom: 3px; }

        .accord { margin-top: 16px; border: 1px solid #333; padding: 10px; }
        .accord .accord-title { font-weight: bold; margin-bottom: 6px; }
        .accord .sign-row { display: table; width: 100%; margin-top: 6px; }
        .accord .sign-row > div { display: table-cell; width: 50%; vertical-align: bottom; padding-top: 26px; }

        .footer { position: fixed; bottom: -16mm; left: 0; right: 0; text-align: center;
                  font-size: 7.5px; color: #777; border-top: 1px solid #ddd; padding-top: 4px; }
    </style>
</head>
<body>

    {{-- ===== Pied de page légal (toutes pages) ===== --}}
    <div class="footer">
        {{ $company['legal_name'] }}, siège social : {{ $company['head_office'] }} — {{ $company['legal_form'] }}<br>
        SIRET : {{ $company['siret'] }} ({{ $company['rcs'] }})
    </div>

    {{-- ===== En-tête ===== --}}
    <div class="header">
        <div class="left">
            <div class="agency-name">{{ $header['agency_name'] }}</div>
            <div class="small muted">
                @if ($header['address']){{ $header['address'] }}<br>@endif
                @if ($header['postal_city']){{ $header['postal_city'] }}<br>@endif
                @if ($header['phone'])N° Téléphone : {{ $header['phone'] }}<br>@endif
                @if ($header['email'])Email : {{ $header['email'] }}<br>@endif
                {{ $header['website'] }}<br>
                @if ($header['agreement_number'])N° Agrément : {{ $header['agreement_number'] }}@endif
            </div>
        </div>
        <div class="right">
            <div class="doc-title">Devis N° {{ $quote->reference }}</div>
            <div class="doc-meta muted">
                Date de devis : {{ $fmtDate($quote->quote_date) ?? '—' }}<br>
                @if ($quote->validity_date)
                    Date de validité : {{ $fmtDate($quote->validity_date) }}<br>
                @endif
            </div>
        </div>
    </div>

    {{-- ===== Bloc client (B2B : raison sociale + SIRET + TVA) ===== --}}
    <div class="client-box">
        <div class="cb-label">Établi pour</div>
        <div class="cb-name">{{ $clientBlock['company_name'] }}</div>
        @unless ($clientBlock['has_company'])
            <div class="small muted">— Fiche entreprise non renseignée —</div>
        @endunless
        @if ($clientBlock['address'])<div>{{ $clientBlock['address'] }}</div>@endif
        @if ($clientBlock['postal_code'] || $clientBlock['city'])
            <div>{{ trim(($clientBlock['postal_code'] ?? '') . ' ' . ($clientBlock['city'] ?? '')) }}</div>
        @endif
        @if ($clientBlock['siret'])<div class="small">SIRET : {{ $clientBlock['siret'] }}</div>@endif
        @if ($clientBlock['vat_number'])<div class="small">N° TVA : {{ $clientBlock['vat_number'] }}</div>@endif
    </div>
    <div class="clearfix"></div>

    {{-- ===== Adresse d'intervention + mode ===== --}}
    @if ($interventionAddress)
        <div class="info-line">
            <span class="lbl">Adresse d'intervention :</span>
            {{ trim(($interventionAddress->address ?? '') . ' ' . ($interventionAddress->postal_code ?? '') . ' ' . ($interventionAddress->city ?? '')) }}
        </div>
    @endif
    @if ($quote->billing_mode)
        <div class="info-line"><span class="lbl">Mode d'intervention :</span> {{ $quote->billing_mode }}</div>
    @endif

    {{-- ===== Tableau des lignes ===== --}}
    <table class="items">
        <thead>
            <tr>
                <th style="width:52%">Désignation</th>
                <th style="width:12%; text-align:right">Qté</th>
                <th style="width:18%; text-align:right">PU TTC</th>
                <th style="width:18%; text-align:right">Montant TTC</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($items as $line)
                <tr>
                    <td>{{ $line['label'] }}</td>
                    <td class="num">{{ $fmtQty($line['quantity']) }}</td>
                    <td class="num">{{ $fmtMoney($line['unit_price_ttc']) }}</td>
                    <td class="num">{{ $fmtMoney($line['total_ttc']) }}</td>
                </tr>
            @empty
                <tr><td colspan="4" style="text-align:center; color:#888; padding:18px;">Aucune ligne</td></tr>
            @endforelse
        </tbody>
    </table>

    {{-- ===== Totaux ===== --}}
    <div class="totals">
        <table>
            <tr>
                <td class="lbl">Total HT</td>
                <td class="val">{{ $fmtMoney($totals['total_ht']) }}</td>
            </tr>
            @foreach ($totals['by_rate'] as $bucket)
                <tr>
                    <td class="lbl">TVA ({{ rtrim(rtrim(number_format($bucket['rate'], 2, ',', ' '), '0'), ',') }} %)</td>
                    <td class="val">{{ $fmtMoney($bucket['vat']) }}</td>
                </tr>
            @endforeach
            <tr class="grand">
                <td>Total TTC</td>
                <td class="val">{{ $fmtMoney($totals['total_ttc']) }}</td>
            </tr>
        </table>
    </div>
    <div class="clearfix"></div>

    @if ($quote->comment)
        <div class="info-line"><span class="lbl">Commentaire :</span> {{ $quote->comment }}</div>
    @endif

    {{-- ===== Mentions légales ===== --}}
    <div class="legal">
        <p><strong>NOTA :</strong> prix forfaitaire établi sur la base des indications fournies par le client. Toute prestation supplémentaire fera l'objet d'un avenant.</p>
        <p>Les modes de règlement acceptés : {{ $company ? config('aspha.payment_methods') : 'chèque, virement bancaire' }}.</p>
        <p>Le client certifie avoir pris connaissance des conditions générales de vente et les accepter sans réserve.</p>
    </div>

    {{-- ===== Bon pour accord ===== --}}
    <div class="accord">
        <div class="accord-title">Bon pour accord</div>
        <div class="small muted">Devis à retourner daté et signé, précédé de la mention « Bon pour accord ».</div>
        <div class="sign-row">
            <div>Date : ............................</div>
            <div>Signature :</div>
        </div>
    </div>

</body>
</html>
