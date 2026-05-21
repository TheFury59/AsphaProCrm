<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\Employee;
use App\Models\Intervention;
use App\Models\Invoice;
use App\Models\Quote;
use Carbon\Carbon;
use Illuminate\Http\Request;

/**
 * Statistiques agrégées du tableau de bord (page d'accueil admin).
 *
 * Un seul endpoint `GET /dashboard/stats` qui retourne tous les KPI réels,
 * calculés en BDD. Remplace les anciens appels front bricolés
 * (`useClients({per_page:1})` lus pour `meta.total`) et les valeurs codées
 * en dur ("+12%", "3 nouveaux", "—").
 *
 * Réservé aux administrateurs : les rôles `intervenant` / `client` ont leurs
 * propres écrans extranet et ne doivent pas voir les chiffres globaux.
 */
class DashboardController extends Controller
{
    public function stats(Request $request)
    {
        $user = $request->user();
        abort_unless(
            $user && ($user->hasRole('super_admin') || $user->hasRole('admin')),
            403,
            "Tableau de bord réservé aux administrateurs.",
        );

        $now = Carbon::now();
        $monthStart = $now->copy()->startOfMonth();
        $monthEnd = $now->copy()->endOfMonth();
        $next30 = $now->copy()->addDays(30);

        // Mois précédent (pour les vraies variations vs mois courant)
        $prevMonthStart = $now->copy()->subMonthNoOverflow()->startOfMonth();
        $prevMonthEnd = $now->copy()->subMonthNoOverflow()->endOfMonth();

        // --- Clients actifs ---
        $clientsActive = Client::where('status', 'active')->count();

        // --- Intervenants (employees) ---
        // La table employees n'a pas de colonne status (cf. migration) :
        // tous les intervenants enregistrés comptent.
        $employeesCount = Employee::count();

        // --- Interventions à venir (30 prochains jours) ---
        // On ne compte que les interventions ponctuelles réellement
        // enregistrées avec une date de début. Les occurrences virtuelles
        // de récurrences ne sont pas en table : on ne les invente pas.
        $interventionsUpcoming = Intervention::whereNotNull('start_datetime')
            ->whereBetween('start_datetime', [$now, $next30])
            ->whereNotIn('status', ['annulee', 'draft'])
            ->count();

        // --- Interventions à pourvoir (sans intervenant affecté) ---
        $interventionsToFill = Intervention::where('status', 'a_pourvoir')->count();

        // --- Factures impayées : nombre + montant TTC dû ---
        $unpaidInvoices = Invoice::whereIn('payment_status', ['unpaid', 'partial'])
            ->where('status', '!=', 'cancelled');
        $unpaidInvoicesCount = (clone $unpaidInvoices)->count();
        $unpaidInvoicesTotal = (float) (clone $unpaidInvoices)->sum('total');

        // --- Devis en attente (brouillon ou envoyé, pas encore tranchés) ---
        $pendingQuotesCount = Quote::whereIn('status', ['draft', 'sent'])->count();

        // --- Chiffre d'affaires facturé du mois en cours ---
        // Somme des `total` (TTC) des factures émises ce mois, hors annulées.
        $revenueThisMonth = (float) Invoice::where('status', '!=', 'cancelled')
            ->whereBetween('invoice_date', [$monthStart->toDateString(), $monthEnd->toDateString()])
            ->sum('total');

        $revenuePrevMonth = (float) Invoice::where('status', '!=', 'cancelled')
            ->whereBetween('invoice_date', [$prevMonthStart->toDateString(), $prevMonthEnd->toDateString()])
            ->sum('total');

        // Variation CA mois courant vs mois précédent — seulement si le mois
        // précédent a un CA non nul (sinon un % serait trompeur).
        $revenueTrendPct = null;
        if ($revenuePrevMonth > 0) {
            $revenueTrendPct = round((($revenueThisMonth - $revenuePrevMonth) / $revenuePrevMonth) * 100, 1);
        }

        return [
            'data' => [
                'clients_active' => $clientsActive,
                'employees_count' => $employeesCount,
                'interventions_upcoming_30d' => $interventionsUpcoming,
                'interventions_to_fill' => $interventionsToFill,
                'unpaid_invoices_count' => $unpaidInvoicesCount,
                'unpaid_invoices_total' => $unpaidInvoicesTotal,
                'pending_quotes_count' => $pendingQuotesCount,
                'revenue_this_month' => $revenueThisMonth,
                'revenue_prev_month' => $revenuePrevMonth,
                'revenue_trend_pct' => $revenueTrendPct,
            ],
        ];
    }
}
