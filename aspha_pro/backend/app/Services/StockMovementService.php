<?php

namespace App\Services;

use App\Models\StockMovement;
use App\Models\StockProduct;

/**
 * Service centralisant l'application d'un mouvement de stock.
 *
 * Factorise la logique historiquement portée par
 * `StockController::createMovement` afin que les autres modules (missions,
 * réassorts…) puissent décompter/ré-incrémenter le stock SANS dupliquer le
 * calcul du delta ni la mise à jour atomique de `current_quantity`.
 *
 * ⚠ Doit être appelé À L'INTÉRIEUR d'une transaction par l'appelant (les
 *    controllers ouvrent déjà une `DB::transaction`).
 *
 * Cohérence avec l'existant : comme `StockController::createMovement`, une
 * sortie ne bloque PAS si le stock est insuffisant — `current_quantity` est
 * clampée à 0 (`max(0, …)`). Le commerce passe avant ; l'info de stock
 * insuffisant est renvoyée par `wouldGoNegative()` pour que l'appelant puisse
 * la remonter sans interrompre l'opération.
 */
class StockMovementService
{
    /**
     * Enregistre un mouvement « out » (sortie) qui décrémente le stock.
     *
     * @param  int|null  $referenceId  id de l'entité source (ex: mission_stock_item)
     */
    public function recordOut(
        StockProduct $product,
        int $quantity,
        ?int $doneBy = null,
        ?int $referenceId = null,
        string $reason = 'usage',
    ): StockMovement {
        return $this->apply($product, 'out', $quantity, $doneBy, $referenceId, $reason);
    }

    /**
     * Enregistre un mouvement « in » (entrée) qui ré-incrémente le stock.
     * Utilisé pour annuler une sortie (retrait d'un produit d'une mission).
     */
    public function recordIn(
        StockProduct $product,
        int $quantity,
        ?int $doneBy = null,
        ?int $referenceId = null,
        string $reason = 'usage',
    ): StockMovement {
        return $this->apply($product, 'in', $quantity, $doneBy, $referenceId, $reason);
    }

    /**
     * Ajuste le stock pour refléter un changement de quantité consommée.
     * `$delta` > 0 → consomme davantage (sortie) ; < 0 → restitue (entrée).
     * `$delta` == 0 → aucun mouvement (renvoie null).
     */
    public function adjustByDelta(
        StockProduct $product,
        int $delta,
        ?int $doneBy = null,
        ?int $referenceId = null,
        string $reason = 'usage',
    ): ?StockMovement {
        if ($delta === 0) {
            return null;
        }

        return $delta > 0
            ? $this->recordOut($product, $delta, $doneBy, $referenceId, $reason)
            : $this->recordIn($product, abs($delta), $doneBy, $referenceId, $reason);
    }

    /**
     * Indique si une sortie de `$quantity` ferait passer le stock sous zéro
     * (stock insuffisant). N'empêche PAS l'opération — sert à informer.
     */
    public function wouldGoNegative(StockProduct $product, int $quantity): bool
    {
        return ((int) $product->current_quantity - $quantity) < 0;
    }

    /**
     * Cœur partagé : met à jour `current_quantity` (clampée à 0) et crée la
     * ligne `stock_movements`. Mêmes règles que StockController::createMovement.
     */
    private function apply(
        StockProduct $product,
        string $type,
        int $quantity,
        ?int $doneBy,
        ?int $referenceId,
        string $reason,
    ): StockMovement {
        $delta = $type === 'in' ? $quantity : -$quantity;

        $product->update([
            'current_quantity' => max(0, (int) $product->current_quantity + $delta),
        ]);

        return StockMovement::create([
            'stock_product_id' => $product->id,
            'movement_type' => $type,
            'quantity' => abs($delta),
            'reason' => $reason,
            'reference_id' => $referenceId,
            'done_by' => $doneBy,
            'movement_date' => now(),
        ]);
    }
}
