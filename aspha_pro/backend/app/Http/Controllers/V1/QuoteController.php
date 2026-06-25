<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\ClientPrestation;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Mission;
use App\Models\Quote;
use App\Models\QuoteItem;
use App\Models\User;
use App\Services\DocumentSequenceService;
use App\Services\PennylaneSyncService;
use App\Services\QuotePdfGenerator; // 2026-05-20 PDF B2B
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class QuoteController extends Controller
{
    /**
     * Helper d'ownership : admin/super_admin → OK pour tout. Client extranet →
     * OK uniquement pour son propre client_id (vérifié via portal_user_id).
     * Intervenant → 403 (un intervenant n'accède jamais aux devis).
     *
     * À appeler sur les endpoints qui exposent un Quote/Invoice/PDF/etc.
     * pour défense en profondeur contre l'IDOR (audit 2026-06-24 H1/H2).
     */
    private function assertOwnershipOrAdmin(?User $user, ?int $clientId): void
    {
        abort_unless($user, 401);
        if ($user->hasAnyRole(['super_admin', 'admin'])) {
            return; // admins voient tout
        }
        $ownedClientId = Client::where('portal_user_id', $user->id)->value('id');
        abort_unless(
            $ownedClientId && (int) $ownedClientId === (int) $clientId,
            403,
            "Vous n'avez pas accès à ce document.",
        );
    }

    public function index(Request $request)
    {
        abort_unless($request->user()?->can('sales.quotes.view'), 403);
        $perPage = min((int) $request->query('per_page', 25), 100);

        $query = QueryBuilder::for(Quote::class)
            ->allowedFilters([
                'status', 'client_id', 'entity_id',
                AllowedFilter::callback('search', function ($q, $v) {
                    $q->where(function ($qq) use ($v) {
                        $qq->where('reference', 'like', "%$v%")
                            ->orWhereHas('client.company', fn ($c) => $c->where('company_name', 'like', "%$v%"));
                    });
                }),
            ])
            ->allowedSorts(['quote_date', 'created_at', 'status', 'reference', 'total'])
            ->defaultSort('-quote_date')
            ->with(['client.company:id,client_id,company_name,photo,updated_at']);

        return ['data' => $query->paginate($perPage)];
    }

    public function show(Request $request, Quote $quote)
    {
        abort_unless($request->user()?->can('sales.quotes.view'), 403);
        $quote->load(['client.company', 'quoteType', 'address', 'ownerUser:id,name', 'items.stockProduct:id,name,reference']);
        return ['data' => $quote];
    }

    public function store(Request $request)
    {
        abort_unless($request->user()?->can('sales.quotes.edit'), 403);
        $data = $request->validate([
            'client_id' => ['required', 'exists:clients,id'],
            // entity_id n'est plus exigé du formulaire : on le dérive du
            // client (refonte 2026-05-20). Reste accepté en override admin.
            'entity_id' => ['nullable', 'exists:entities,id'],
            'quote_type_id' => ['nullable', 'exists:quote_types,id'],
            // mission_id optionnel : un devis "régulier" provient d'une mission
            // dont il reprend les prestations contractualisées (2026-05-20).
            'mission_id' => ['nullable', 'exists:missions,id'],
            'quote_date' => ['required', 'date'],
            'validity_date' => ['nullable', 'date'],
            'nature' => ['nullable', 'in:regular,punctual'],
            'billing_mode' => ['nullable', 'string', 'max:64'],
            'status' => ['nullable', 'in:draft,sent,accepted,refused,expired'],
            'comment' => ['nullable', 'string'],
            // 2026-06-24 — internal_notes : visibles UNIQUEMENT des admins (jamais
            // exportées sur le PDF envoyé au client).
            'internal_notes' => ['nullable', 'string'],
            'items' => ['nullable', 'array'],
            'items.*.label' => ['required_with:items', 'string', 'max:255'],
            'items.*.quantity' => ['required_with:items', 'numeric', 'min:0'],
            // duration_minutes : durée standard de la prestation, saisie sur le
            // devis (refonte C4 2026-05-22 — n'est plus portée par le catalogue).
            'items.*.duration_minutes' => ['nullable', 'integer', 'min:0'],
            'items.*.unit_price' => ['required_with:items', 'numeric', 'min:0'],
            'items.*.item_type' => ['nullable', 'in:hourly,forfait,frais,remise,produit,carte,adjustment'],
            'items.*.vat_rate_id' => ['nullable', 'exists:vat_rates,id'], // audit 2026-05-19 — TVA par ligne
            // product_id : prestation du catalogue dont vient la ligne
            // (null = ligne libre saisie à la main). 2026-05-20.
            'items.*.product_id' => ['nullable', 'exists:products,id'],
            // stock_product_id : produit du stock chiffré sur la ligne
            // (null = ligne libre / prestation). 2026-05-21. Chiffrage SEUL :
            // un devis ne déclenche AUCUN mouvement de stock.
            'items.*.stock_product_id' => ['nullable', 'exists:stock_products,id'],
        ]);

        $client = \App\Models\Client::findOrFail($data['client_id']);
        // entity_id : override admin sinon entité du client
        $entityId = $data['entity_id'] ?? $client->entity_id;
        abort_if(! $entityId, 422, "Le client n'est rattaché à aucune entité — impossible de générer le devis.");

        // Si une mission est fournie, on vérifie sa cohérence avec le client
        if (! empty($data['mission_id'])) {
            $mission = \App\Models\Mission::findOrFail($data['mission_id']);
            abort_if($mission->client_id !== $client->id, 422, "La mission sélectionnée n'appartient pas à ce client.");
        }

        $userId = $request->user()->id;
        $sequences = app(DocumentSequenceService::class);

        $quote = DB::transaction(function () use ($data, $userId, $sequences, $entityId) {
            // Référence auto atomique (audit 2026-05-19 — fix race condition count()+1)
            $ref = $sequences->next('QUO');

            $quote = Quote::create([
                'reference' => $ref,
                'client_id' => $data['client_id'],
                'entity_id' => $entityId,
                // quote_type_id réellement optionnel (migration 2026-05-20 :
                // colonne nullable). Plus de fallback QuoteType::first() qui
                // cassait l'insertion quand la table était vide.
                'quote_type_id' => $data['quote_type_id'] ?? null,
                'owner_user_id' => $userId,
                'quote_date' => $data['quote_date'],
                'validity_date' => $data['validity_date'] ?? null,
                'nature' => $data['nature'] ?? 'regular',
                'billing_mode' => $data['billing_mode'] ?? null,
                'status' => $data['status'] ?? 'draft',
                'comment' => $data['comment'] ?? null,
                'total' => 0,
            ]);

            $total = 0;
            $order = 0;
            foreach ($data['items'] ?? [] as $item) {
                $lineTotal = (float) $item['quantity'] * (float) $item['unit_price'];
                QuoteItem::create([
                    'quote_id' => $quote->id,
                    'product_id' => $item['product_id'] ?? null, // 2026-05-20 traçabilité
                    'stock_product_id' => $item['stock_product_id'] ?? null, // 2026-05-21 — chiffrage seul, 0 mouvement
                    'label' => $item['label'],
                    'item_type' => $item['item_type'] ?? 'forfait',
                    'vat_rate_id' => $item['vat_rate_id'] ?? null, // audit 2026-05-19
                    'quantity' => $item['quantity'],
                    'duration_minutes' => $item['duration_minutes'] ?? null, // C4 2026-05-22
                    'unit_price' => $item['unit_price'],
                    'total' => $lineTotal,
                    'order' => $order++,
                ]);
                $total += $lineTotal;
            }
            $quote->update(['total' => $total]);

            // Lier la mission d'origine à ce devis (missions.quote_id).
            if (! empty($data['mission_id'])) {
                \App\Models\Mission::where('id', $data['mission_id'])
                    ->whereNull('quote_id')
                    ->update(['quote_id' => $quote->id]);
            }

            return $quote;
        });

        $quote->load(['client.company', 'items']);
        return response()->json(['data' => $quote], 201);
    }

    public function update(Request $request, Quote $quote)
    {
        abort_unless($request->user()?->can('sales.quotes.edit'), 403);

        // audit 2026-05-19 — un devis déjà converti en facture est verrouillé
        // (sinon on pourrait modifier les lignes alors que la facture émise
        // a déjà été générée → incohérence comptable).
        abort_if($quote->invoice_id !== null, 409, 'Devis converti en facture — non modifiable.');

        $data = $request->validate([
            'quote_date' => ['sometimes', 'date'],
            'validity_date' => ['sometimes', 'nullable', 'date'],
            'status' => ['sometimes', 'in:draft,sent,accepted,refused,expired'],
            'comment' => ['sometimes', 'nullable', 'string'],
            'internal_notes' => ['sometimes', 'nullable', 'string'], // 2026-06-24
            'success_rate' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:100'],
            'items' => ['sometimes', 'array'],
            'items.*.label' => ['required_with:items', 'string', 'max:255'],
            'items.*.quantity' => ['required_with:items', 'numeric', 'min:0'],
            'items.*.duration_minutes' => ['nullable', 'integer', 'min:0'], // C4 2026-05-22
            'items.*.unit_price' => ['required_with:items', 'numeric', 'min:0'],
            'items.*.item_type' => ['nullable', 'in:hourly,forfait,frais,remise,produit,carte,adjustment'],
            'items.*.vat_rate_id' => ['nullable', 'exists:vat_rates,id'], // audit 2026-05-19
            'items.*.product_id' => ['nullable', 'exists:products,id'], // 2026-05-20
            'items.*.stock_product_id' => ['nullable', 'exists:stock_products,id'], // 2026-05-21
        ]);

        DB::transaction(function () use ($data, $quote) {
            $scalar = collect($data)->except('items')->all();
            if (! empty($scalar)) {
                $quote->update($scalar);
            }
            if (array_key_exists('items', $data)) {
                $quote->items()->delete();
                $total = 0;
                $order = 0;
                foreach ($data['items'] as $item) {
                    $lineTotal = (float) $item['quantity'] * (float) $item['unit_price'];
                    QuoteItem::create([
                        'quote_id' => $quote->id,
                        'product_id' => $item['product_id'] ?? null, // 2026-05-20
                        'stock_product_id' => $item['stock_product_id'] ?? null, // 2026-05-21
                        'label' => $item['label'],
                        'item_type' => $item['item_type'] ?? 'forfait',
                        'vat_rate_id' => $item['vat_rate_id'] ?? null, // audit 2026-05-19
                        'quantity' => $item['quantity'],
                        'duration_minutes' => $item['duration_minutes'] ?? null, // C4 2026-05-22
                        'unit_price' => $item['unit_price'],
                        'total' => $lineTotal,
                        'order' => $order++,
                    ]);
                    $total += $lineTotal;
                }
                $quote->update(['total' => $total]);
            }
        });

        return ['data' => $quote->fresh(['items', 'client.company'])];
    }

    public function destroy(Request $request, Quote $quote)
    {
        abort_unless($request->user()?->can('sales.quotes.edit'), 403);
        $quote->delete();
        return response()->noContent();
    }

    /**
     * POST /api/v1/quotes/{quote}/convert-to-invoice
     *
     * Crée une Invoice draft à partir du devis : copie client/entity/items,
     * passe le statut du devis à "accepted" si en draft/sent.
     */
    public function convertToInvoice(Request $request, Quote $quote)
    {
        abort_unless($request->user()?->can('sales.invoices.edit'), 403);

        $quote->load('items');
        $sequences = app(DocumentSequenceService::class);

        // 2026-06-24 audit H5 — anti double-conversion via lockForUpdate
        // DANS la transaction. Avant, le check `invoice_id !== null` se
        // faisait HORS transaction → race condition possible (double clic
        // ou tab dupliquée pouvait créer 2 factures avant le second update).
        // Maintenant : lock row + recheck après lock = atomique.
        $invoice = DB::transaction(function () use ($quote, $sequences) {
            $fresh = Quote::where('id', $quote->id)->lockForUpdate()->firstOrFail();
            abort_if($fresh->invoice_id !== null, 409, 'Devis déjà converti en facture.');

            // Numérotation atomique (audit 2026-05-19 — fix race condition count()+1)
            $ref = $sequences->next('INV');
            $invoice = Invoice::create([
                'reference' => $ref,
                'type' => 'client',
                'client_id' => $quote->client_id,
                'entity_id' => $quote->entity_id,
                'invoice_date' => now()->toDateString(),
                'due_date' => null,
                'payment_status' => 'unpaid',
                'status' => 'draft',
                'comment' => 'Issue du devis ' . ($quote->reference ?? "#{$quote->id}"),
                'total' => 0,
            ]);

            $total = 0;
            foreach ($quote->items as $qi) {
                InvoiceItem::create([
                    'invoice_id' => $invoice->id,
                    'product_id' => $qi->product_id, // 2026-05-20 — propage la prestation source
                    'stock_product_id' => $qi->stock_product_id, // 2026-05-21 — propage le produit de stock
                    'label' => $qi->label,
                    'item_type' => $qi->item_type ?? 'forfait',
                    'vat_rate_id' => $qi->vat_rate_id, // audit 2026-05-19 — propage la TVA par ligne
                    'quantity' => $qi->quantity,
                    'unit_price' => $qi->unit_price,
                    'total' => $qi->total,
                ]);
                $total += (float) $qi->total;
            }
            $invoice->update(['total' => $total]);

            if (in_array($fresh->status, ['draft', 'sent'], true)) {
                $fresh->update(['status' => 'accepted']);
            }

            // audit 2026-05-19 — lock le devis à la facture émise
            $fresh->update(['invoice_id' => $invoice->id]);

            return $invoice;
        });

        $invoice->load(['client.company', 'invoiceItems']);
        return response()->json(['data' => $invoice], 201);
    }

    /**
     * POST /api/v1/quotes/{quote}/convert-to-mission
     *
     * Crée une mission rattachée au client du devis, avec une
     * `client_prestation` par ligne du devis (workflow validation 2026-05-21).
     *
     * Règles :
     *  - réservé aux devis `accepted` (validés par le client) ;
     *  - anti-doublon : si une mission a déjà été créée depuis ce devis
     *    (`missions.quote_id`), on la renvoie sans en recréer une ;
     *  - mapping `quote_items` → `client_prestations` : label, product_id,
     *    prix → base_price/custom_price, billing_type dérivé d'item_type ;
     *  - nature par défaut `punctual` (l'admin ajuste ensuite via l'édition
     *    de mission, notamment pour passer une prestation en récurrent).
     *
     * 2026-05-21 — les lignes du devis qui référencent un produit de stock
     * (`stock_product_id` non null) ne deviennent PAS des prestations mais
     * des `mission_stock_items` ; le décompte de stock est alors déclenché
     * par `MissionStockService` (mouvement de sortie).
     *
     * L'admin pourra réviser la mission via `EditMissionPage`.
     */
    public function convertToMission(Request $request, Quote $quote, \App\Services\MissionStockService $stockService)
    {
        abort_unless($request->user()?->can('clients.edit'), 403);

        abort_if(
            $quote->status !== 'accepted',
            409,
            "Seul un devis validé par le client peut être converti en mission.",
        );

        // Anti-doublon : une mission déjà issue de ce devis → on la renvoie.
        $existing = Mission::where('quote_id', $quote->id)->first();
        if ($existing) {
            return response()->json([
                'data' => $existing->load(['clientPrestations', 'stockItems']),
                'already_existed' => true,
            ], 200);
        }

        $quote->load(['items', 'client.company']);
        abort_if(! $quote->client_id, 422, "Ce devis n'est rattaché à aucun client.");

        $userId = $request->user()->id;

        $mission = DB::transaction(function () use ($quote, $stockService, $userId) {
            $clientName = $quote->client?->company?->company_name
                ?? ($quote->client ? "Client {$quote->client->code}" : 'Client');

            $mission = Mission::create([
                'client_id' => $quote->client_id,
                'quote_id' => $quote->id,
                'name' => 'Mission ' . ($quote->reference ?? "devis #{$quote->id}")
                    . " — {$clientName}",
                'status' => 'active',
                'billing_rhythm' => $quote->billing_rhythm,
            ]);

            foreach ($quote->items as $item) {
                $price = $item->unit_price !== null ? (float) $item->unit_price : null;

                // Ligne « produit de stock » → mission_stock_item + décompte.
                // (le devis n'a déclenché aucun mouvement ; la mission, si.)
                if ($item->stock_product_id) {
                    $stockService->addItem($mission, [
                        'stock_product_id' => $item->stock_product_id,
                        'label' => $item->label,
                        'quantity' => $item->quantity !== null ? (float) $item->quantity : 1,
                        'unit_price' => $price ?? 0,
                    ], $userId);
                    continue;
                }

                ClientPrestation::create([
                    'client_id' => $quote->client_id,
                    'mission_id' => $mission->id,
                    'product_id' => $item->product_id,
                    'quote_id' => $quote->id,
                    'label' => $item->label,
                    // C4 2026-05-22 — la durée saisie sur le devis suit la prestation.
                    'duration_minutes' => $item->duration_minutes,
                    'billing_type' => $this->itemTypeToBillingType($item->item_type),
                    // Pas de produit catalogue → prix custom (le prix vient du
                    // devis, pas du catalogue). Avec produit → tarif du catalogue
                    // conservé en base_price + prix devis en custom_price si
                    // différent serait du sur-engineering : on prend le prix du
                    // devis comme base_price, l'admin ajuste ensuite.
                    'pricing_type' => $item->product_id ? 'default' : 'custom',
                    'base_price' => $item->product_id ? $price : null,
                    'custom_price' => $item->product_id ? null : $price,
                    // Nature par défaut ponctuelle : pas de génération auto
                    // d'intervention récurrente. L'admin bascule en régulier
                    // via l'édition de mission s'il le souhaite.
                    'nature' => 'punctual',
                ]);
            }

            return $mission;
        });

        return response()->json([
            'data' => $mission->load(['clientPrestations', 'stockItems']),
            'already_existed' => false,
        ], 201);
    }

    /**
     * Mappe un `item_type` de QuoteItem vers un `billing_type` de
     * ClientPrestation. Les énums ne sont pas 1:1 :
     *  - QuoteItem : hourly|forfait|frais|remise|produit|carte|adjustment
     *  - ClientPrestation : hourly|forfait|frais|remise|carte|exceptional
     * 'produit'/'adjustment' (sans équivalent) retombent sur 'forfait'.
     */
    private function itemTypeToBillingType(?string $itemType): string
    {
        return match ($itemType) {
            'hourly', 'forfait', 'frais', 'remise', 'carte' => $itemType,
            default => 'forfait',
        };
    }

    /**
     * GET /api/v1/quotes/{quote}/pdf
     *
     * 2026-05-20 PDF B2B — Retourne le PDF du devis au format Aspha Services
     * (adapté clients entreprises). Pas de XML Factur-X : un devis n'est pas
     * une facture électronique.
     */
    public function pdf(Request $request, Quote $quote, QuotePdfGenerator $generator)
    {
        // 2026-06-24 audit H1 — defense in depth :
        // 1. permission Spatie générique
        // 2. ET ownership : si l'user est un CLIENT extranet, il ne doit
        //    voir QUE les devis de SON client (jamais ceux d'un autre).
        //    Les admin/super_admin (qui ont la permission) sont OK.
        $user = $request->user();
        abort_unless($user?->can('sales.quotes.view'), 403);
        $this->assertOwnershipOrAdmin($user, $quote->client_id);

        $pdf = $generator->generate($quote);

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="' . $quote->reference . '.pdf"',
        ]);
    }

    public function syncPennylane(Request $request, Quote $quote, PennylaneSyncService $sync)
    {
        abort_unless($request->user()?->can('sales.quotes.edit'), 403);
        $quote = $sync->syncQuote($quote);
        return ['data' => [
            'id' => $quote->id,
            'pennylane_id' => $quote->pennylane_id,
            'pennylane_synced_at' => $quote->pennylane_synced_at?->toIso8601String(),
            'mock' => ! $sync->isConfigured(),
        ]];
    }
}
