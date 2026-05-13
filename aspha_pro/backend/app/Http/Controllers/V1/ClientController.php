<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\V1\StoreClientRequest;
use App\Http\Requests\V1\UpdateClientRequest;
use App\Http\Resources\V1\ClientResource;
use App\Models\Client;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class ClientController extends Controller
{
    /**
     * GET /api/v1/clients
     *
     * Filtres : ?filter[status]=active&filter[entity_id]=1&filter[search]=ducat
     * Tri    : ?sort=-created_at,code
     * Pagination : ?page=N&per_page=N (max 100)
     */
    public function index(Request $request)
    {
        abort_unless($request->user()?->can('clients.view'), 403);

        $perPage = min((int) $request->query('per_page', 25), 100);

        $query = QueryBuilder::for(Client::class)
            ->allowedFilters([
                'status',
                'entity_id',
                'owner_user_id',
                AllowedFilter::callback('search', function ($q, $value) {
                    $q->where(function ($sub) use ($value) {
                        $sub->where('code', 'like', "%{$value}%")
                            ->orWhereHas('company', fn ($c) => $c
                                ->where('company_name', 'like', "%{$value}%")
                                ->orWhere('siret', 'like', "%{$value}%")
                                ->orWhere('primary_email', 'like', "%{$value}%")
                            );
                    });
                }),
            ])
            ->allowedSorts(['code', 'status', 'created_at'])
            ->defaultSort('-created_at')
            ->with(['company', 'entity:id,name', 'ownerUser:id,name', 'addresses'])
            ->withCount(['missions', 'prestations', 'absences', 'keys', 'invoices', 'quotes']);

        return ClientResource::collection($query->paginate($perPage));
    }

    /**
     * GET /api/v1/clients/{client}
     */
    public function show(Request $request, Client $client)
    {
        abort_unless($request->user()?->can('clients.view'), 403);

        $client->load([
            'company',
            'billingContact',
            'entity',
            'ownerUser:id,name,email',
            'addresses',
            'contacts',
            'relatedContacts',
        ])->loadCount(['missions', 'prestations', 'absences', 'keys', 'invoices', 'quotes']);

        return new ClientResource($client);
    }

    /**
     * POST /api/v1/clients
     */
    public function store(StoreClientRequest $request)
    {
        $client = DB::transaction(function () use ($request) {
            $data = $request->only([
                'code', 'status', 'entity_id', 'owner_user_id', 'print_intervention_detail',
            ]);
            // Si non précisé, l'utilisateur courant devient le gestionnaire par défaut
            $data['owner_user_id'] = $data['owner_user_id'] ?? $request->user()->id;

            $client = Client::create($data);

            $companyData = $request->input('company');
            $client->company()->create($companyData);

            if ($request->filled('billing_contact')) {
                $client->billingContact()->create($request->input('billing_contact'));
            }

            return $client;
        });

        $client->load(['company', 'billingContact', 'entity', 'ownerUser:id,name']);
        return (new ClientResource($client))->response()->setStatusCode(201);
    }

    /**
     * PATCH /api/v1/clients/{client}
     */
    public function update(UpdateClientRequest $request, Client $client)
    {
        DB::transaction(function () use ($request, $client) {
            $clientFields = $request->only([
                'code', 'status', 'entity_id', 'owner_user_id', 'print_intervention_detail',
            ]);
            if (! empty($clientFields)) {
                $client->update($clientFields);
            }

            if ($request->filled('company')) {
                $client->company()->updateOrCreate(
                    ['client_id' => $client->id],
                    $request->input('company')
                );
            }

            if ($request->has('billing_contact')) {
                $bc = $request->input('billing_contact');
                if (empty($bc)) {
                    $client->billingContact()->delete();
                } else {
                    $client->billingContact()->updateOrCreate(
                        ['client_id' => $client->id],
                        $bc
                    );
                }
            }
        });

        $client->load(['company', 'billingContact', 'entity', 'ownerUser:id,name']);
        return new ClientResource($client);
    }

    /**
     * DELETE /api/v1/clients/{client}
     */
    public function destroy(Request $request, Client $client)
    {
        abort_unless($request->user()?->can('clients.delete'), 403);
        $client->delete();
        return response()->noContent();
    }
}
