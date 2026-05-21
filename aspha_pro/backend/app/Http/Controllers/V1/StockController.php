<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\StockMovement;
use App\Models\StockProduct;
use App\Services\StockMovementService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

/**
 * Stock par entité — produits, mouvements, alertes seuil.
 *
 * Règle métier (cf modifications docx) :
 *   - Chaque entité a son propre stock
 *   - Seuils d'alerte de réassort par produit
 *   - Mouvements typés : in / out / adjustment
 *   - current_quantity est mise à jour atomiquement en transaction
 */
class StockController extends Controller
{
    // ========== PRODUITS EN STOCK ==========

    public function index(Request $request)
    {
        abort_unless($request->user()?->can('stock.view'), 403);

        $query = QueryBuilder::for(StockProduct::class)
            ->allowedFilters([
                'entity_id', 'category_id', 'status',
                AllowedFilter::callback('search', fn ($q, $v) =>
                    $q->where('name', 'like', "%$v%")->orWhere('reference', 'like', "%$v%")
                ),
                AllowedFilter::callback('low_stock', fn ($q, $v) => $v
                    ? $q->whereColumn('current_quantity', '<=', 'alert_threshold')
                    : null),
            ])
            ->allowedSorts(['name', 'current_quantity', 'created_at'])
            ->defaultSort('name')
            ->with(['category:id,label']);

        return ['data' => $query->paginate(50)];
    }

    public function store(Request $request)
    {
        abort_unless($request->user()?->can('stock.manage'), 403);
        $data = $request->validate([
            'entity_id' => ['required', 'exists:entities,id'],
            'category_id' => ['nullable', 'exists:stock_categories,id'],
            'name' => ['required', 'string', 'max:255'],
            'reference' => ['nullable', 'string', 'max:128'],
            'unit' => ['required', 'in:unit,liter,kg,pack'],
            'alert_threshold' => ['required', 'integer', 'min:0'],
            'current_quantity' => ['required', 'integer', 'min:0'],
            'purchase_price' => ['nullable', 'numeric', 'min:0'],
            'selling_price' => ['nullable', 'numeric', 'min:0'],
            'supplier_id' => ['nullable', 'exists:suppliers,id'],
        ]);
        $product = StockProduct::create($data + ['status' => 'active']);
        return response()->json(['data' => $product->load(['category:id,label', 'supplier:id,name'])], 201);
    }

    public function update(Request $request, StockProduct $stockProduct)
    {
        abort_unless($request->user()?->can('stock.manage'), 403);
        $stockProduct->update($request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'reference' => ['sometimes', 'nullable', 'string', 'max:128'],
            'unit' => ['sometimes', 'in:unit,liter,kg,pack'],
            'alert_threshold' => ['sometimes', 'integer', 'min:0'],
            'category_id' => ['sometimes', 'nullable', 'exists:stock_categories,id'],
            'purchase_price' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'selling_price' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'supplier_id' => ['sometimes', 'nullable', 'exists:suppliers,id'],
            'status' => ['sometimes', 'in:active,inactive'],
        ]));
        return ['data' => $stockProduct->fresh(['category:id,label', 'supplier:id,name'])];
    }

    public function destroy(Request $request, StockProduct $stockProduct)
    {
        abort_unless($request->user()?->can('stock.manage'), 403);
        $stockProduct->update(['status' => 'inactive']);
        return response()->noContent();
    }

    // ========== MOUVEMENTS DE STOCK ==========

    public function listMovements(Request $request, StockProduct $stockProduct)
    {
        abort_unless($request->user()?->can('stock.view'), 403);
        return ['data' => $stockProduct->stockMovements()
            ->with('doneBy:id,name')
            ->orderByDesc('movement_date')
            ->paginate(50)];
    }

    public function createMovement(Request $request, StockProduct $stockProduct)
    {
        abort_unless($request->user()?->can('stock.manage'), 403);
        $data = $request->validate([
            'movement_type' => ['required', 'in:in,out,adjustment'],
            'quantity' => ['required', 'integer', 'min:1'],
            'reason' => ['nullable', 'in:reorder,usage,loss,inventory_adjustment'],
            'reference_id' => ['nullable', 'integer'],
        ]);

        return DB::transaction(function () use ($data, $stockProduct, $request) {
            // L'ajustement n'a pas d'équivalent dans le service (delta calculé
            // par rapport à la quantité actuelle) : conservé en local.
            $delta = match ($data['movement_type']) {
                'in' => $data['quantity'],
                'out' => -$data['quantity'],
                'adjustment' => $data['quantity'] - $stockProduct->current_quantity,
            };

            $stockProduct->update([
                'current_quantity' => max(0, $stockProduct->current_quantity + $delta),
            ]);

            $movement = StockMovement::create([
                'stock_product_id' => $stockProduct->id,
                'movement_type' => $data['movement_type'],
                'quantity' => abs($delta),
                'reason' => $data['reason'] ?? null,
                'reference_id' => $data['reference_id'] ?? null,
                'done_by' => $request->user()->id,
                'movement_date' => now(),
            ]);

            return response()->json([
                'data' => [
                    'movement' => $movement,
                    'new_quantity' => $stockProduct->current_quantity,
                    'low_stock_alert' => $stockProduct->current_quantity <= $stockProduct->alert_threshold,
                ],
            ], 201);
        });
    }

    /**
     * GET /api/v1/stock/products/all — liste plate (non paginée) des produits
     * de stock actifs, pour les sélecteurs (devis, missions).
     *
     * Permission `stock.view` requise comme `index`.
     */
    public function options(Request $request)
    {
        abort_unless($request->user()?->can('stock.view'), 403);

        $query = StockProduct::query()
            ->where('status', 'active')
            ->with('category:id,label')
            ->orderBy('name');

        if ($entityId = $request->integer('entity_id')) {
            $query->where('entity_id', $entityId);
        }

        return ['data' => $query->get([
            'id', 'entity_id', 'category_id', 'name', 'reference', 'unit', 'current_quantity',
        ])];
    }

    /**
     * GET /api/v1/stock/alerts — produits sous le seuil
     */
    public function alerts(Request $request)
    {
        abort_unless($request->user()?->can('stock.view'), 403);
        return ['data' => StockProduct::query()
            ->where('status', 'active')
            ->whereColumn('current_quantity', '<=', 'alert_threshold')
            ->with('category:id,label')
            ->orderBy('current_quantity')
            ->get()];
    }
}
