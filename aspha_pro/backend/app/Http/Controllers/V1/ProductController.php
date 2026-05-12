<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\V1\ProductResource;
use App\Models\Product;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $perPage = min((int) $request->query('per_page', 25), 100);

        $query = QueryBuilder::for(Product::class)
            ->allowedFilters([
                'status', 'type', 'nature', 'billing_mode', 'category_id', 'entity_id',
                AllowedFilter::callback('search', fn ($q, $value) =>
                    $q->where('name', 'like', "%{$value}%")
                      ->orWhere('code', 'like', "%{$value}%")
                ),
            ])
            ->allowedSorts(['name', 'code', 'price', 'created_at'])
            ->defaultSort('name')
            ->with(['category', 'vatRate']);

        return ProductResource::collection($query->paginate($perPage));
    }

    public function show(Product $product)
    {
        $product->load(['category', 'vatRate', 'productPriceTiers']);
        return new ProductResource($product);
    }

    public function store(Request $request)
    {
        abort_unless($request->user()?->can('admin.users.manage'), 403); // catalogue = admin

        $data = $request->validate([
            'code' => ['required', 'string', 'max:64', 'unique:products,code'],
            'status' => ['required', 'in:active,inactive'],
            'name' => ['required', 'string', 'max:255'],
            'entity_id' => ['nullable', 'exists:entities,id'],
            'type' => ['required', 'in:hourly,forfait,frais,remise,carte,exceptional'],
            'nature' => ['required', 'in:regular,punctual'],
            'billing_mode' => ['required', 'in:per_intervention,per_month,per_week,per_unit'],
            'category_id' => ['nullable', 'exists:product_categories,id'],
            'default_duration_minutes' => ['nullable', 'integer', 'min:0'],
            'price' => ['required', 'numeric', 'min:0'],
            'cost' => ['nullable', 'numeric', 'min:0'],
            'vat_rate_id' => ['nullable', 'exists:vat_rates,id'],
            'amount_incl_tax' => ['nullable', 'boolean'],
            'has_degressive_pricing' => ['nullable', 'boolean'],
            'specific_rates_forbidden' => ['nullable', 'boolean'],
            'accounting_code' => ['nullable', 'string', 'max:32'],
            'chapter' => ['nullable', 'string', 'max:64'],
            'description' => ['nullable', 'string'],
        ]);

        $product = Product::create($data);
        $product->load(['category', 'vatRate']);
        return (new ProductResource($product))->response()->setStatusCode(201);
    }

    public function update(Request $request, Product $product)
    {
        abort_unless($request->user()?->can('admin.users.manage'), 403);
        $product->update($request->all());
        $product->load(['category', 'vatRate']);
        return new ProductResource($product);
    }

    public function destroy(Request $request, Product $product)
    {
        abort_unless($request->user()?->can('admin.users.manage'), 403);
        $product->update(['status' => 'inactive']);
        return response()->noContent();
    }
}
