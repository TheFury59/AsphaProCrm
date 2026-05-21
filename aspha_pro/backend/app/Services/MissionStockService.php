<?php

namespace App\Services;

use App\Models\Mission;
use App\Models\MissionStockItem;
use App\Models\StockProduct;

/**
 * Gestion des produits de stock rattachés à une mission, AVEC décompte.
 *
 * RÈGLE MÉTIER (2026-05-21) :
 *  - Ajouter un produit du stock (`stock_product_id` non null) à une mission
 *    crée un mouvement de SORTIE → le stock est décompté immédiatement.
 *  - Retirer la ligne crée le mouvement INVERSE (entrée) → annulation.
 *  - Modifier la quantité ajuste par un mouvement de la DIFFÉRENCE.
 *  - Une ligne libre (`stock_product_id` null) ne déclenche aucun mouvement.
 *
 * ⚠ Toutes les méthodes doivent être appelées DANS une transaction par
 *    l'appelant (MissionController / QuoteController le font).
 *
 * Le décompte réutilise `StockMovementService` (logique de mouvement non
 * dupliquée). Stock insuffisant : non bloquant (cf. StockMovementService) —
 * le commerce passe avant ; `current_quantity` est clampée à 0.
 */
class MissionStockService
{
    public function __construct(private StockMovementService $movements) {}

    /**
     * Ajoute un produit (ou une ligne libre) à la mission.
     * Déclenche un mouvement de sortie si `stock_product_id` est renseigné.
     *
     * @param  array{stock_product_id:?int,label:string,quantity:float|int,unit_price:float|int}  $data
     */
    public function addItem(Mission $mission, array $data, ?int $userId = null): MissionStockItem
    {
        $item = $mission->stockItems()->create([
            'stock_product_id' => $data['stock_product_id'] ?? null,
            'label' => $data['label'],
            'quantity' => $data['quantity'],
            'unit_price' => $data['unit_price'] ?? 0,
        ]);

        if ($item->stock_product_id) {
            $product = StockProduct::find($item->stock_product_id);
            if ($product) {
                $this->movements->recordOut(
                    $product,
                    $this->toUnits($item->quantity),
                    $userId,
                    $item->id,
                );
            }
        }

        return $item;
    }

    /**
     * Met à jour une ligne. Si la quantité change ET que la ligne référence un
     * produit de stock, ajuste le stock par la différence (positive = sortie
     * supplémentaire, négative = restitution).
     *
     * Changement de produit : on annule entièrement l'ancien (entrée) puis on
     * décompte le nouveau (sortie).
     *
     * @param  array{stock_product_id?:?int,label?:string,quantity?:float|int,unit_price?:float|int}  $data
     */
    public function updateItem(MissionStockItem $item, array $data, ?int $userId = null): MissionStockItem
    {
        $oldProductId = $item->stock_product_id;
        $oldQty = $this->toUnits($item->quantity);

        $newProductId = array_key_exists('stock_product_id', $data)
            ? ($data['stock_product_id'] ?? null)
            : $oldProductId;
        $newQty = array_key_exists('quantity', $data)
            ? $this->toUnits($data['quantity'])
            : $oldQty;

        $item->fill($data)->save();

        if ($oldProductId === $newProductId) {
            // Même produit (ou toujours libre) → simple ajustement par delta.
            if ($newProductId) {
                $product = StockProduct::find($newProductId);
                if ($product) {
                    // delta consommé = nouvelle qté - ancienne qté
                    $this->movements->adjustByDelta($product, $newQty - $oldQty, $userId, $item->id);
                }
            }
        } else {
            // Produit changé : restituer l'ancien, décompter le nouveau.
            if ($oldProductId) {
                $old = StockProduct::find($oldProductId);
                if ($old) {
                    $this->movements->recordIn($old, $oldQty, $userId, $item->id);
                }
            }
            if ($newProductId) {
                $new = StockProduct::find($newProductId);
                if ($new) {
                    $this->movements->recordOut($new, $newQty, $userId, $item->id);
                }
            }
        }

        return $item->refresh();
    }

    /**
     * Supprime une ligne. Si elle référençait un produit de stock, ré-incrémente
     * le stock (mouvement d'entrée) pour annuler la sortie initiale.
     */
    public function removeItem(MissionStockItem $item, ?int $userId = null): void
    {
        if ($item->stock_product_id) {
            $product = StockProduct::find($item->stock_product_id);
            if ($product) {
                $this->movements->recordIn(
                    $product,
                    $this->toUnits($item->quantity),
                    $userId,
                    $item->id,
                );
            }
        }

        $item->delete();
    }

    /**
     * Les mouvements de stock sont entiers (`stock_movements.quantity` =
     * unsignedBigInteger). Les quantités mission sont décimales (pour les
     * lignes libres facturées). On arrondit pour le décompte physique.
     */
    private function toUnits(float|int|string $quantity): int
    {
        return (int) round((float) $quantity);
    }
}
