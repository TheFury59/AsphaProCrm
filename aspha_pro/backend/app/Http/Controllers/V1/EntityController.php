<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\Entity;
use Illuminate\Http\Request;

/**
 * Gestion administrative des entités (agences / sociétés).
 *
 * Distinct de `ReferentialsController::entities` qui n'expose que id+name+siret
 * pour les sélecteurs : ici on renvoie TOUS les champs (adresse, TVA, etc.)
 * et on autorise la modification — typiquement pour la page « Mon entreprise »
 * des paramètres admin (utilisée pour les en-têtes PDF des devis/factures).
 *
 * Permissions :
 *  - index : super_admin + admin (les deux ont besoin de voir leur entité)
 *  - update : super_admin + admin
 */
class EntityController extends Controller
{
    private function authorizeAdmin(Request $request): void
    {
        $user = $request->user();
        abort_unless($user, 401);
        abort_unless(
            $user->hasRole('super_admin') || $user->hasRole('admin'),
            403,
            "Accès admin requis.",
        );
    }

    /**
     * Liste TOUTES les entités (actives et inactives) avec tous les champs.
     */
    public function index(Request $request)
    {
        $this->authorizeAdmin($request);

        return [
            'data' => Entity::orderBy('name')->get(),
        ];
    }

    /**
     * Détail d'une entité.
     */
    public function show(Request $request, Entity $entity)
    {
        $this->authorizeAdmin($request);

        return ['data' => $entity];
    }

    /**
     * Met à jour les informations d'une entité — nom, contact, adresse,
     * SIRET, TVA intra, coordonnées GPS. Utilisé par l'admin pour
     * renseigner les en-têtes PDF des devis/factures.
     *
     * Le champ `status` (active/inactive) et les flags modulation/
     * annualisation sont également modifiables — utiles pour les
     * comptes multi-entités.
     */
    public function update(Request $request, Entity $entity)
    {
        $this->authorizeAdmin($request);

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:32'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'siret' => ['sometimes', 'nullable', 'string', 'max:32'],
            'vat_number' => ['sometimes', 'nullable', 'string', 'max:32'],
            'address_line' => ['sometimes', 'nullable', 'string', 'max:255'],
            'postal_code' => ['sometimes', 'nullable', 'string', 'max:16'],
            'city' => ['sometimes', 'nullable', 'string', 'max:128'],
            'latitude' => ['sometimes', 'nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['sometimes', 'nullable', 'numeric', 'between:-180,180'],
            'status' => ['sometimes', 'in:active,inactive'],
            'modulation_enabled' => ['sometimes', 'boolean'],
            'annualisation_enabled' => ['sometimes', 'boolean'],
        ]);

        $entity->update($data);

        return ['data' => $entity->fresh()];
    }
}
