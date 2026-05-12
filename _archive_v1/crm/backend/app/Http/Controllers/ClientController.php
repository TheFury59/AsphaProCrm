<?php

namespace App\Http\Controllers;

use App\Http\Resources\ClientResource;
use App\Models\Client;

class ClientController extends Controller
{
    public function index()
    {
        return ClientResource::collection(
            Client::with('addresses')
                ->orderBy('last_name')
                ->orderBy('first_name')
                ->get()
        );
    }

    public function show(Client $client)
    {
        $client->load('addresses');
        return new ClientResource($client);
    }
}
