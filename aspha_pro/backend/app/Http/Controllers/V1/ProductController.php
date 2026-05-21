<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\V1\ProductResource;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

/**
 * Catalogue des prestations (table `products`).
 *
 * Le catalogue est géré par les admins (super_admin + admin) — ce sont eux
 * qui définissent les services facturables, leurs tarifs et leur TVA. Les
 * prestations alimentent ensuite les devis, factures et plannings.
 */
class ProductController extends Controller
{
    public function index(Request $request)
    {
        $perPage = min((int) $request->query('per_page', 25), 100);

        $query = QueryBuilder::for(Product::class)
            ->allowedFilters([
                'status', 'type', 'nature', 'billing_mode', 'category_id', 'entity_id',
                AllowedFilter::callback('search', fn ($q, $value) =>
                    $q->where(function ($sub) use ($value) {
                        $sub->where('name', 'like', "%{$value}%")
                            ->orWhere('code', 'like', "%{$value}%");
                    })
                ),
            ])
            ->allowedSorts(['name', 'code', 'price', 'created_at'])
            ->defaultSort('name')
            ->with(['category', 'vatRate', 'entity:id,name']);

        return ProductResource::collection($query->paginate($perPage));
    }

    public function show(Product $product)
    {
        $product->load(['category', 'vatRate', 'entity:id,name', 'productPriceTiers']);
        return new ProductResource($product);
    }

    public function store(Request $request)
    {
        $this->authorizeCatalog($request);

        $data = $this->validatePayload($request, isUpdate: false);
        $tiers = $data['price_tiers'] ?? null;
        unset($data['price_tiers']);

        // `nature` n'est plus saisie dans le catalogue (refonte 2026-05-21 :
        // la nature régulier/ponctuel dépend du contrat client, pas du produit).
        // La colonne `products.nature` est conservée en BDD pour la rétro-compat
        // (devis/factures historiques) ; on lui donne un défaut neutre 'regular'.
        $data['nature'] = $data['nature'] ?? 'regular';

        $product = DB::transaction(function () use ($data, $tiers) {
            $product = Product::create($data);
            $this->syncPriceTiers($product, $tiers, $data['has_degressive_pricing'] ?? false);
            return $product;
        });

        $product->load(['category', 'vatRate', 'entity:id,name', 'productPriceTiers']);
        return (new ProductResource($product))->response()->setStatusCode(201);
    }

    public function update(Request $request, Product $product)
    {
        $this->authorizeCatalog($request);

        // ⚠️ Avant : `$product->update($request->all())` — mass assignment
        // non validé (n'importe quel champ injectable). Désormais validation
        // stricte avec `sometimes` pour rester compatible PATCH partiel.
        $data = $this->validatePayload($request, isUpdate: true, productId: $product->id);
        $tiers = $data['price_tiers'] ?? null;
        $hasTiersKey = array_key_exists('price_tiers', $data);
        unset($data['price_tiers']);

        DB::transaction(function () use ($product, $data, $tiers, $hasTiersKey) {
            $product->update($data);
            // On ne touche aux paliers que s'ils sont explicitement fournis
            if ($hasTiersKey) {
                $this->syncPriceTiers($product, $tiers, $product->has_degressive_pricing);
            } elseif (! $product->has_degressive_pricing) {
                // Si on désactive le tarif dégressif, on purge les paliers
                $product->productPriceTiers()->delete();
            }
        });

        $product->load(['category', 'vatRate', 'entity:id,name', 'productPriceTiers']);
        return new ProductResource($product);
    }

    public function destroy(Request $request, Product $product)
    {
        $this->authorizeCatalog($request);
        // Soft "delete" métier : on désactive la prestation. La table products
        // n'a pas de SoftDeletes — on garde la ligne pour l'historique des
        // devis/factures qui la référencent. Réactivable via update(status).
        $product->update(['status' => 'inactive']);
        return response()->noContent();
    }

    /**
     * Le catalogue est géré par les admins. Avant : permission
     * `admin.users.manage` (super_admin only) → un admin ne pouvait pas
     * créer de prestation. Corrigé 2026-05-20.
     */
    private function authorizeCatalog(Request $request): void
    {
        $user = $request->user();
        abort_unless(
            $user && ($user->hasRole('super_admin') || $user->hasRole('admin')),
            403,
            'Seuls les administrateurs peuvent gérer le catalogue de prestations.',
        );
    }

    /**
     * Validation partagée store/update. En update, tous les champs passent
     * en `sometimes` pour autoriser les PATCH partiels.
     */
    private function validatePayload(Request $request, bool $isUpdate, ?int $productId = null): array
    {
        $req = fn (string $rule) => $isUpdate ? "sometimes" : $rule;

        $codeRule = $isUpdate
            ? ['sometimes', 'string', 'max:64', "unique:products,code,{$productId}"]
            : ['required', 'string', 'max:64', 'unique:products,code'];

        return $request->validate([
            'code' => $codeRule,
            'status' => [$req('required'), 'in:active,inactive'],
            'name' => [$req('required'), 'string', 'max:255'],
            'entity_id' => ['nullable', 'exists:entities,id'],
            'type' => [$req('required'), 'in:hourly,forfait,frais,remise,carte,exceptional'],
            // `nature` n'est plus requise : la nature régulier/ponctuel se gère
            // désormais au niveau de la prestation contractualisée (mission),
            // pas du catalogue. Conservée en `nullable` pour la rétro-compat.
            'nature' => ['nullable', 'in:regular,punctual'],
            'billing_mode' => [$req('required'), 'in:per_intervention,per_month,per_week,per_unit'],
            'category_id' => ['nullable', 'exists:product_categories,id'],
            'default_duration_minutes' => ['nullable', 'integer', 'min:0'],
            'price' => [$req('required'), 'numeric', 'min:0'],
            'cost' => ['nullable', 'numeric', 'min:0'],
            'vat_rate_id' => ['nullable', 'exists:vat_rates,id'],
            'amount_incl_tax' => ['nullable', 'boolean'],
            'has_degressive_pricing' => ['nullable', 'boolean'],
            'specific_rates_forbidden' => ['nullable', 'boolean'],
            'accounting_code' => ['nullable', 'string', 'max:32'],
            'chapter' => ['nullable', 'string', 'max:64'],
            'description' => ['nullable', 'string'],
            // Paliers de tarif dégressif (optionnel)
            'price_tiers' => ['sometimes', 'array'],
            'price_tiers.*.from_quantity' => ['required_with:price_tiers', 'numeric', 'min:0'],
            'price_tiers.*.price' => ['required_with:price_tiers', 'numeric', 'min:0'],
        ]);
    }

    /**
     * Remplace tous les paliers de tarif dégressif du produit.
     * Si `has_degressive_pricing` est false, on purge tout (pas de palier
     * orphelin).
     */
    private function syncPriceTiers(Product $product, ?array $tiers, bool $degressive): void
    {
        $product->productPriceTiers()->delete();
        if (! $degressive || empty($tiers)) {
            return;
        }
        foreach ($tiers as $tier) {
            $product->productPriceTiers()->create([
                'from_quantity' => $tier['from_quantity'],
                'price' => $tier['price'],
            ]);
        }
    }
}
