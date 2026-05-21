<?php

namespace App\Services;

use App\Models\ClientPrestation;
use App\Models\Mission;
use App\Models\Quote;
use App\Models\QuoteItem;
use Illuminate\Support\Collection;

/**
 * Génère automatiquement un devis brouillon (`Quote` statut `draft`) à partir
 * d'une mission et de ses prestations contractualisées (2026-05-21).
 *
 * Contexte métier : à la création d'une mission avec des prestations, l'ERP
 * matérialise immédiatement un devis brouillon que l'admin retrouvera dans la
 * liste des devis. Une `QuoteItem` est créée par prestation (label, quantité,
 * prix, product_id).
 *
 * Garde-fous :
 *  - ANTI-DOUBLON : une seule génération par mission. Si la mission est déjà
 *    liée à un devis (`missions.quote_id`), on ne régénère rien — le devis
 *    existant est laissé tel quel (l'admin le gère).
 *  - La référence est obtenue via `DocumentSequenceService::next('QUO')`
 *    (numérotation atomique, cf. audit 2026-05-19).
 *
 * Ce service NE gère PAS la transaction : l'appelant (MissionController,
 * InterventionController) l'enveloppe dans son `DB::transaction()` global pour
 * que la création multi-entités soit atomique.
 */
class MissionQuoteGenerator
{
    public function __construct(
        private DocumentSequenceService $sequences,
    ) {}

    /**
     * Crée le devis brouillon d'une mission s'il n'en existe pas déjà un.
     *
     * @param  Mission  $mission  La mission (doit avoir un `client_id`).
     * @param  Collection<int,ClientPrestation>|null  $prestations
     *         Les prestations de la mission. Si null, on les charge depuis la
     *         relation `clientPrestations`.
     * @param  int|null  $ownerUserId  Utilisateur créateur du devis (admin courant).
     * @return Quote|null Le devis créé, ou null si un devis existe déjà ou s'il
     *                    n'y a aucune prestation à chiffrer.
     */
    public function generateForMission(
        Mission $mission,
        ?Collection $prestations = null,
        ?int $ownerUserId = null,
    ): ?Quote {
        // Anti-doublon : mission déjà liée à un devis → on ne touche à rien.
        if ($mission->quote_id !== null) {
            return null;
        }

        $prestations ??= $mission->clientPrestations()->get();

        // Pas de prestation → pas de devis (un devis vide n'a aucun sens).
        if ($prestations->isEmpty()) {
            return null;
        }

        $client = $mission->client; // BelongsTo
        $entityId = $client?->entity_id;

        // Sans entité de rattachement, le devis ne peut pas être généré (la
        // colonne entity_id est requise). On ne bloque PAS la création de la
        // mission pour autant : on saute simplement la génération du devis.
        if (! $entityId) {
            return null;
        }

        $ref = $this->sequences->next('QUO');

        $quote = Quote::create([
            'reference' => $ref,
            'client_id' => $mission->client_id,
            'entity_id' => $entityId,
            'owner_user_id' => $ownerUserId,
            'quote_date' => now()->toDateString(),
            'nature' => 'regular',
            'status' => 'draft',
            'comment' => 'Devis généré automatiquement à la création de la mission « '
                . $mission->name . ' ».',
            'total' => 0,
        ]);

        $total = 0;
        $order = 0;
        foreach ($prestations as $prestation) {
            $unitPrice = $this->resolvePrice($prestation);
            $lineTotal = $unitPrice; // quantité 1 → total = prix unitaire

            QuoteItem::create([
                'quote_id' => $quote->id,
                'product_id' => $prestation->product_id,
                'label' => $prestation->label,
                'item_type' => $this->billingTypeToItemType($prestation->billing_type),
                'quantity' => 1,
                // Cast string : les colonnes sont des `decimal` (brick/math
                // déprécie le passage direct de floats).
                'unit_price' => number_format($unitPrice, 2, '.', ''),
                'total' => number_format($lineTotal, 2, '.', ''),
                'order' => $order++,
            ]);
            $total += $lineTotal;
        }

        $quote->update(['total' => number_format($total, 2, '.', '')]);

        // Lien mission ↔ devis (missions.quote_id) — cohérent avec
        // QuoteController::store qui pose ce même lien dans l'autre sens.
        $mission->update(['quote_id' => $quote->id]);

        return $quote;
    }

    /**
     * Résout le prix unitaire d'une prestation : prix personnalisé si défini,
     * sinon prix catalogue (base_price), sinon 0.
     */
    private function resolvePrice(ClientPrestation $prestation): float
    {
        if ($prestation->pricing_type === 'custom' && $prestation->custom_price !== null) {
            return (float) $prestation->custom_price;
        }
        if ($prestation->base_price !== null) {
            return (float) $prestation->base_price;
        }

        return 0.0;
    }

    /**
     * Mappe un `billing_type` de ClientPrestation vers un `item_type` de
     * QuoteItem. Les énums ne sont pas 1:1 :
     *  - ClientPrestation : hourly|forfait|frais|remise|carte|exceptional
     *  - QuoteItem        : hourly|forfait|frais|remise|produit|carte|adjustment
     * 'exceptional' (sans équivalent) retombe sur 'forfait'.
     */
    private function billingTypeToItemType(?string $billingType): string
    {
        return match ($billingType) {
            'hourly', 'forfait', 'frais', 'remise', 'carte' => $billingType,
            default => 'forfait',
        };
    }
}
