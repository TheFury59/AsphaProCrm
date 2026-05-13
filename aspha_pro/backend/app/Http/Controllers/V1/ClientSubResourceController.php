<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\ClientAbsence;
use App\Models\ClientContact;
use App\Models\Key;
use App\Models\KeyMovement;
use App\Models\RelatedContact;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Sous-ressources de Client :
 *   - addresses (polymorphique)
 *   - contacts (téléphone/email)
 *   - related_contacts (famille/médecin/urgence)
 *   - absences (ponctuelles + périodiques unifiées via is_periodic)
 *   - keys + mouvements (KeyMovement)
 *
 * Toutes sous /api/v1/clients/{client}/...
 */
class ClientSubResourceController extends Controller
{
    private function authorizeEdit(Request $request): void
    {
        abort_unless($request->user()?->can('clients.edit'), 403);
    }

    // ========== ADDRESSES (polymorphic) ==========
    public function listAddresses(Request $request, Client $client)
    {
        abort_unless($request->user()?->can('clients.view'), 403);
        return ['data' => $client->addresses()->get()];
    }

    public function storeAddress(Request $request, Client $client)
    {
        $this->authorizeEdit($request);
        $data = $request->validate([
            'type' => ['required', 'in:main,billing,intervention,other'],
            'address' => ['required', 'string', 'max:255'],
            'city' => ['required', 'string', 'max:128'],
            'postal_code' => ['required', 'string', 'max:16'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ]);
        $address = $client->addresses()->create($data);
        return response()->json(['data' => $address], 201);
    }

    public function updateAddress(Request $request, Client $client, int $addressId)
    {
        $this->authorizeEdit($request);
        $address = $client->addresses()->where('id', $addressId)->firstOrFail();
        $address->update($request->validate([
            'type' => ['sometimes', 'in:main,billing,intervention,other'],
            'address' => ['sometimes', 'string', 'max:255'],
            'city' => ['sometimes', 'string', 'max:128'],
            'postal_code' => ['sometimes', 'string', 'max:16'],
            'latitude' => ['sometimes', 'nullable', 'numeric'],
            'longitude' => ['sometimes', 'nullable', 'numeric'],
        ]));
        return ['data' => $address];
    }

    public function destroyAddress(Request $request, Client $client, int $addressId)
    {
        $this->authorizeEdit($request);
        $client->addresses()->where('id', $addressId)->delete();
        return response()->noContent();
    }

    // ========== CONTACTS ==========
    public function listContacts(Request $request, Client $client)
    {
        abort_unless($request->user()?->can('clients.view'), 403);
        return ['data' => $client->contacts()->get()];
    }

    public function storeContact(Request $request, Client $client)
    {
        $this->authorizeEdit($request);
        $data = $request->validate([
            'type' => ['required', 'in:phone,email,mobile'],
            'value' => ['required', 'string', 'max:255'],
            'is_primary' => ['nullable', 'boolean'],
        ]);
        // Si is_primary = true, on désactive les autres du même type
        if (! empty($data['is_primary'])) {
            $client->contacts()->where('type', $data['type'])->update(['is_primary' => false]);
        }
        $contact = $client->contacts()->create($data);
        return response()->json(['data' => $contact], 201);
    }

    public function updateContact(Request $request, Client $client, int $contactId)
    {
        $this->authorizeEdit($request);
        $contact = ClientContact::where('client_id', $client->id)->where('id', $contactId)->firstOrFail();
        $data = $request->validate([
            'type' => ['sometimes', 'in:phone,email,mobile'],
            'value' => ['sometimes', 'string', 'max:255'],
            'is_primary' => ['sometimes', 'boolean'],
        ]);
        if (! empty($data['is_primary'])) {
            $client->contacts()
                ->where('type', $data['type'] ?? $contact->type)
                ->where('id', '!=', $contact->id)
                ->update(['is_primary' => false]);
        }
        $contact->update($data);
        return ['data' => $contact];
    }

    public function destroyContact(Request $request, Client $client, int $contactId)
    {
        $this->authorizeEdit($request);
        ClientContact::where('client_id', $client->id)->where('id', $contactId)->delete();
        return response()->noContent();
    }

    // ========== RELATED CONTACTS ==========
    public function listRelated(Request $request, Client $client)
    {
        abort_unless($request->user()?->can('clients.view'), 403);
        return ['data' => $client->relatedContacts()->get()];
    }

    public function storeRelated(Request $request, Client $client)
    {
        $this->authorizeEdit($request);
        $data = $request->validate([
            'type' => ['required', 'in:family,doctor,emergency'],
            'name' => ['required', 'string', 'max:128'],
            'phone' => ['required', 'string', 'max:32'],
        ]);
        $contact = $client->relatedContacts()->create($data);
        return response()->json(['data' => $contact], 201);
    }

    public function updateRelated(Request $request, Client $client, int $contactId)
    {
        $this->authorizeEdit($request);
        $contact = RelatedContact::where('client_id', $client->id)->where('id', $contactId)->firstOrFail();
        $contact->update($request->validate([
            'type' => ['sometimes', 'in:family,doctor,emergency'],
            'name' => ['sometimes', 'string', 'max:128'],
            'phone' => ['sometimes', 'string', 'max:32'],
        ]));
        return ['data' => $contact];
    }

    public function destroyRelated(Request $request, Client $client, int $contactId)
    {
        $this->authorizeEdit($request);
        RelatedContact::where('client_id', $client->id)->where('id', $contactId)->delete();
        return response()->noContent();
    }

    // ========== ABSENCES (unified ponctuel + periodique) ==========
    public function listAbsences(Request $request, Client $client)
    {
        abort_unless($request->user()?->can('clients.view'), 403);
        return ['data' => $client->absences()->with('reason')->get()];
    }

    public function storeAbsence(Request $request, Client $client)
    {
        $this->authorizeEdit($request);
        $data = $this->validateAbsence($request);

        // Quick-add planning : motif libre → fusionne dans comment
        if (! empty($data['reason']) && empty($data['comment'])) {
            $data['comment'] = $data['reason'];
        }
        unset($data['reason']);

        $absence = $client->absences()->create($data);
        $absence->load('reason');
        return response()->json(['data' => $absence], 201);
    }

    public function updateAbsence(Request $request, Client $client, int $absenceId)
    {
        $this->authorizeEdit($request);
        $absence = ClientAbsence::where('client_id', $client->id)->where('id', $absenceId)->firstOrFail();
        $absence->update($this->validateAbsence($request, partial: true));
        $absence->load('reason');
        return ['data' => $absence];
    }

    public function destroyAbsence(Request $request, Client $client, int $absenceId)
    {
        $this->authorizeEdit($request);
        ClientAbsence::where('client_id', $client->id)->where('id', $absenceId)->delete();
        return response()->noContent();
    }

    private function validateAbsence(Request $request, bool $partial = false): array
    {
        $req = $partial ? 'sometimes' : 'required';
        $base = [
            // Nullable pour le quick-add depuis le planning (motif libre via `reason`)
            'reason_id' => ['nullable', 'exists:client_absence_reasons,id'],
            'reason' => ['nullable', 'string', 'max:255'],
            'is_hourly' => ['nullable', 'boolean'],
            'planning_action' => ['nullable', 'in:cancel,delete,nothing'],
            'comment' => ['nullable', 'string'],
            'is_periodic' => ['nullable', 'boolean'],
            'start_datetime' => ['nullable', 'date'],
            'duration_hours' => ['nullable', 'numeric', 'min:0'],
            'start_date' => ['nullable', 'date'],
            'start_time' => ['nullable', 'date_format:H:i'],
            'end_time' => ['nullable', 'date_format:H:i'],
            'frequency' => ['nullable', 'in:daily,weekly,monthly,yearly'],
            'interval' => ['nullable', 'integer', 'min:1'],
            'days_of_week' => ['nullable', 'string'],
            'exclude_school_holidays' => ['nullable', 'boolean'],
            'exclude_public_holidays' => ['nullable', 'boolean'],
            'end_type' => ['nullable', 'in:never,on_date,after_occurrences'],
            'end_date' => ['nullable', 'date'],
            'occurrences_count' => ['nullable', 'integer', 'min:1'],
        ];
        return $request->validate($base);
    }

    // ========== KEYS + MOVEMENTS ==========
    public function listKeys(Request $request, Client $client)
    {
        abort_unless($request->user()?->can('clients.view'), 403);
        return ['data' => $client->keys()->get()];
    }

    public function storeKey(Request $request, Client $client)
    {
        $this->authorizeEdit($request);
        $data = $request->validate([
            'label' => ['required', 'string', 'max:128'],
            'current_holder' => ['nullable', 'string', 'max:128'],
        ]);
        $key = $client->keys()->create($data);
        return response()->json(['data' => $key], 201);
    }

    public function updateKey(Request $request, Client $client, int $keyId)
    {
        $this->authorizeEdit($request);
        $key = Key::where('client_id', $client->id)->where('id', $keyId)->firstOrFail();
        $key->update($request->validate([
            'label' => ['sometimes', 'string', 'max:128'],
            'current_holder' => ['sometimes', 'nullable', 'string', 'max:128'],
        ]));
        return ['data' => $key];
    }

    public function destroyKey(Request $request, Client $client, int $keyId)
    {
        $this->authorizeEdit($request);
        Key::where('client_id', $client->id)->where('id', $keyId)->delete();
        return response()->noContent();
    }

    public function listKeyMovements(Request $request, Client $client, int $keyId)
    {
        abort_unless($request->user()?->can('clients.view'), 403);
        $key = Key::where('client_id', $client->id)->where('id', $keyId)->firstOrFail();
        return ['data' => $key->keyMovements()->orderByDesc('date')->get()];
    }

    public function storeKeyMovement(Request $request, Client $client, int $keyId)
    {
        $this->authorizeEdit($request);
        $key = Key::where('client_id', $client->id)->where('id', $keyId)->firstOrFail();
        $data = $request->validate([
            'from_holder' => ['nullable', 'string', 'max:128'],
            'to_holder' => ['required', 'string', 'max:128'],
            'date' => ['required', 'date'],
        ]);
        $movement = DB::transaction(function () use ($key, $data) {
            $m = $key->keyMovements()->create($data);
            $key->update(['current_holder' => $data['to_holder']]);
            return $m;
        });
        return response()->json(['data' => $movement], 201);
    }
}
