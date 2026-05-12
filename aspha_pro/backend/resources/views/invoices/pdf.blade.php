<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Facture {{ $invoice->reference }}</title>
    <style>
        @page { margin: 20mm 18mm; }
        * { box-sizing: border-box; }
        body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #1f2937; line-height: 1.4; }
        h1, h2, h3 { margin: 0; padding: 0; }
        .header { display: table; width: 100%; margin-bottom: 24px; }
        .header > div { display: table-cell; vertical-align: top; }
        .header .left { width: 60%; }
        .header .right { text-align: right; }
        .brand { font-size: 24px; font-weight: bold; color: #1f4e79; }
        .meta { color: #6b7280; margin-top: 4px; }
        .ref { font-size: 28px; font-weight: bold; color: #1f4e79; margin-bottom: 6px; }
        .status-pill { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
        .status-draft { background: #f3f4f6; color: #6b7280; }
        .status-sent { background: #dbeafe; color: #1e40af; }
        .status-paid { background: #d1fae5; color: #065f46; }
        .parties { display: table; width: 100%; margin-bottom: 24px; border: 1px solid #e5e7eb; border-radius: 4px; }
        .parties > div { display: table-cell; width: 50%; padding: 12px; }
        .parties .label { color: #6b7280; font-size: 9px; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.5px; }
        .parties .name { font-weight: bold; font-size: 13px; margin-bottom: 4px; }
        .parties + .parties { border-top: 0; }
        table.items { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        table.items th { background: #1f4e79; color: white; padding: 8px; text-align: left; font-size: 10px; text-transform: uppercase; }
        table.items td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
        table.items td.num { text-align: right; }
        table.items tr:nth-child(even) td { background: #f9fafb; }
        .totals { width: 40%; margin-left: auto; }
        .totals .row { display: table; width: 100%; padding: 4px 0; }
        .totals .row > div { display: table-cell; }
        .totals .row .label { color: #6b7280; }
        .totals .row .value { text-align: right; font-weight: bold; }
        .totals .grand { border-top: 2px solid #1f4e79; padding-top: 8px; margin-top: 8px; font-size: 14px; }
        .totals .grand .value { color: #1f4e79; }
        .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 9px; color: #6b7280; }
        .e-invoice { margin-top: 16px; padding: 8px; border: 1px solid #d1fae5; background: #ecfdf5; border-radius: 4px; font-size: 9px; color: #065f46; }
    </style>
</head>
<body>
    <div class="header">
        <div class="left">
            <div class="brand">{{ $entity->name ?? 'Aspha Service' }}</div>
            <div class="meta">
                @if ($entity?->siret) SIRET : {{ $entity->siret }}<br>@endif
                @if ($entity?->phone) Tél : {{ $entity->phone }}<br>@endif
                @if ($entity?->email) {{ $entity->email }}@endif
            </div>
        </div>
        <div class="right">
            <div class="ref">FACTURE</div>
            <div style="font-size: 14px; font-weight: bold; margin-bottom: 8px;">{{ $invoice->reference }}</div>
            <div class="meta">
                Émise le {{ \Carbon\Carbon::parse($invoice->invoice_date)->format('d/m/Y') }}<br>
                @if ($invoice->due_date)
                    Échéance : {{ \Carbon\Carbon::parse($invoice->due_date)->format('d/m/Y') }}<br>
                @endif
            </div>
            <span class="status-pill status-{{ $invoice->status }}">{{ strtoupper($invoice->status) }}</span>
        </div>
    </div>

    <div class="parties">
        <div>
            <div class="label">Émetteur</div>
            <div class="name">{{ $entity->name ?? 'Aspha Service' }}</div>
            @if ($entity?->siret)<div>SIRET : {{ $entity->siret }}</div>@endif
        </div>
        <div>
            <div class="label">Destinataire</div>
            <div class="name">{{ $client->company?->company_name ?? 'Client #' . $invoice->client_id }}</div>
            @if ($client->company?->siret)<div>SIRET : {{ $client->company->siret }}</div>@endif
            @if ($client->company?->vat_number)<div>TVA : {{ $client->company->vat_number }}</div>@endif
        </div>
    </div>

    <table class="items">
        <thead>
            <tr>
                <th style="width: 50%">Désignation</th>
                <th style="width: 12%; text-align: right">Qté</th>
                <th style="width: 18%; text-align: right">Prix unitaire HT</th>
                <th style="width: 20%; text-align: right">Total HT</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($invoice->invoiceItems as $item)
                <tr>
                    <td>{{ $item->label }}</td>
                    <td class="num">{{ rtrim(rtrim(number_format((float) $item->quantity, 2, ',', ' '), '0'), ',') }}</td>
                    <td class="num">{{ number_format((float) $item->unit_price, 2, ',', ' ') }} €</td>
                    <td class="num">{{ number_format((float) $item->total, 2, ',', ' ') }} €</td>
                </tr>
            @empty
                <tr>
                    <td colspan="4" style="text-align: center; color: #6b7280; padding: 24px;">Aucune ligne</td>
                </tr>
            @endforelse
        </tbody>
    </table>

    <div class="totals">
        <div class="row">
            <div class="label">Sous-total HT</div>
            <div class="value">{{ number_format((float) $invoice->total, 2, ',', ' ') }} €</div>
        </div>
        <div class="row">
            <div class="label">TVA (20%)</div>
            <div class="value">{{ number_format((float) $invoice->total * 0.2, 2, ',', ' ') }} €</div>
        </div>
        <div class="row grand">
            <div class="label">Total TTC</div>
            <div class="value">{{ number_format((float) $invoice->total * 1.2, 2, ',', ' ') }} €</div>
        </div>
    </div>

    @if ($invoice->comment)
        <div style="margin-top: 24px;">
            <strong>Notes</strong><br>
            <p>{{ $invoice->comment }}</p>
        </div>
    @endif

    <div class="e-invoice">
        <strong>Facturation électronique</strong> — Cette facture est conforme au format <strong>Factur-X</strong>
        (PDF/A-3 avec données XML embarquées selon la norme EN 16931 / CII). Elle peut être transmise via
        Chorus Pro ou tout opérateur Peppol agréé.
    </div>

    <div class="footer">
        Aspha Pro CRM — Document généré le {{ now()->format('d/m/Y H:i') }}
    </div>
</body>
</html>
