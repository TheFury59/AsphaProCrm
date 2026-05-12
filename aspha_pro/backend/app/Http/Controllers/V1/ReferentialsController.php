<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\AbsenceReason;
use App\Models\ClientAbsenceReason;
use App\Models\Entity;
use App\Models\JobReference;
use App\Models\ProductCategory;
use App\Models\Skill;
use App\Models\VatRate;
use Illuminate\Http\Request;

/**
 * Endpoints "référentiels" en lecture seule pour alimenter les selects/combobox.
 *
 * Tous publics aux utilisateurs authentifiés (ils servent à remplir des forms).
 */
class ReferentialsController extends Controller
{
    public function skills(Request $request)
    {
        return ['data' => Skill::where('status', 'active')->orderBy('label')->get()];
    }

    public function clientAbsenceReasons(Request $request)
    {
        return ['data' => ClientAbsenceReason::where('status', 'active')->orderBy('label')->get()];
    }

    public function employeeAbsenceReasons(Request $request)
    {
        return ['data' => AbsenceReason::where('status', 'active')->orderBy('label')->get()];
    }

    public function entities(Request $request)
    {
        return ['data' => Entity::where('status', 'active')->orderBy('name')->get(['id', 'name', 'siret'])];
    }

    public function jobReferences(Request $request)
    {
        return ['data' => JobReference::where('status', 'active')->orderBy('label')->get()];
    }

    public function vatRates(Request $request)
    {
        return ['data' => VatRate::where('status', 'active')->orderBy('rate')->get()];
    }

    public function productCategories(Request $request)
    {
        return ['data' => ProductCategory::where('status', 'active')->orderBy('label')->get()];
    }
}
