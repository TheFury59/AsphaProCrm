<?php

use App\Http\Controllers\V1\AuthController;
use App\Http\Controllers\V1\UsersController;
use App\Http\Controllers\V1\ClientController;
use App\Http\Controllers\V1\ClientPortalController;
use App\Http\Controllers\V1\ClientSubResourceController;
use App\Http\Controllers\V1\ContractController;
use App\Http\Controllers\V1\DocumentController;
use App\Http\Controllers\V1\EmployeeController;
use App\Http\Controllers\V1\EmployeeSubResourceController;
use App\Http\Controllers\V1\ExtranetController;
use App\Http\Controllers\V1\FleetController;
use App\Http\Controllers\V1\HelpController;
use App\Http\Controllers\V1\InterventionController;
use App\Http\Controllers\V1\InvoiceController;
use App\Http\Controllers\V1\MatchingController;
use App\Http\Controllers\V1\MessagingController;
use App\Http\Controllers\V1\ClientPortalAccessController;
use App\Http\Controllers\V1\EmployeePortalAccessController;
use App\Http\Controllers\V1\ClientRequestController;
use App\Http\Controllers\V1\DashboardController;
use App\Http\Controllers\V1\MediaUploadController;
use App\Http\Controllers\V1\MissionController;
use App\Http\Controllers\V1\NotificationController;
use App\Http\Controllers\V1\PermissionsController;
use App\Http\Controllers\V1\PlanningSummaryController;
use App\Http\Controllers\V1\ProductController;
use App\Http\Controllers\V1\RequiredDocumentTypesController;
use App\Http\Controllers\V1\SettingsController;
use App\Http\Controllers\V1\QuoteController;
use App\Http\Controllers\V1\QuoteTypeController;
use App\Http\Controllers\V1\ReferentialsController;
use App\Http\Controllers\V1\ReglementController;
use App\Http\Controllers\V1\SalaryDeductionController;
use App\Http\Controllers\V1\StockController;
use App\Http\Controllers\V1\TelemanagementController;
use Illuminate\Support\Facades\Route;

Route::get('/ping', fn () => [
    'status' => 'ok',
    'app' => config('app.name'),
    'time' => now()->toIso8601String(),
    'version' => 'v1',
]);

// Login : rate-limited à `RATE_LIMIT_LOGIN` tentatives/minute (défaut 5)
// pour bloquer les attaques brute-force. Limiteur défini dans
// AppServiceProvider::boot() via RateLimiter::for('login', ...).
// Cf. audit 2026-05-19 (HIGH).
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::patch('/me', [AuthController::class, 'updateMe']);
    Route::post('/logout', [AuthController::class, 'logout']);

    // Référentiels
    Route::get('/referentials/skills', [ReferentialsController::class, 'skills']);
    Route::get('/referentials/client-absence-reasons', [ReferentialsController::class, 'clientAbsenceReasons']);
    Route::get('/referentials/employee-absence-reasons', [ReferentialsController::class, 'employeeAbsenceReasons']);
    Route::get('/referentials/entities', [ReferentialsController::class, 'entities']);
    Route::get('/referentials/job-references', [ReferentialsController::class, 'jobReferences']);
    Route::get('/referentials/vat-rates', [ReferentialsController::class, 'vatRates']);
    Route::get('/referentials/product-categories', [ReferentialsController::class, 'productCategories']);

    // Clients
    Route::apiResource('clients', ClientController::class);
    Route::prefix('clients/{client}')->controller(ClientSubResourceController::class)->group(function () {
        Route::get('addresses', 'listAddresses'); Route::post('addresses', 'storeAddress');
        Route::patch('addresses/{addressId}', 'updateAddress'); Route::delete('addresses/{addressId}', 'destroyAddress');
        Route::get('contacts', 'listContacts'); Route::post('contacts', 'storeContact');
        Route::patch('contacts/{contactId}', 'updateContact'); Route::delete('contacts/{contactId}', 'destroyContact');
        Route::get('related-contacts', 'listRelated'); Route::post('related-contacts', 'storeRelated');
        Route::patch('related-contacts/{contactId}', 'updateRelated'); Route::delete('related-contacts/{contactId}', 'destroyRelated');
        Route::get('absences', 'listAbsences'); Route::post('absences', 'storeAbsence');
        Route::patch('absences/{absenceId}', 'updateAbsence'); Route::delete('absences/{absenceId}', 'destroyAbsence');
        Route::get('keys', 'listKeys'); Route::post('keys', 'storeKey');
        Route::patch('keys/{keyId}', 'updateKey'); Route::delete('keys/{keyId}', 'destroyKey');
        Route::get('keys/{keyId}/movements', 'listKeyMovements'); Route::post('keys/{keyId}/movements', 'storeKeyMovement');
    });

    // === Missions client + Prestations contractualisées ===
    // Hiérarchie : Client → Missions → Prestations → Devis/Factures
    Route::get('missions', [MissionController::class, 'indexAll']);
    Route::get('clients/{client}/missions', [MissionController::class, 'index']);
    Route::post('clients/{client}/missions', [MissionController::class, 'store']);
    Route::get('missions/{mission}', [MissionController::class, 'show']);
    Route::patch('missions/{mission}', [MissionController::class, 'update']);
    Route::delete('missions/{mission}', [MissionController::class, 'destroy']);
    Route::get('missions/{mission}/prestations', [MissionController::class, 'listPrestations']);
    Route::post('missions/{mission}/prestations', [MissionController::class, 'storePrestation']);
    Route::patch('missions/{mission}/prestations/{prestationId}', [MissionController::class, 'updatePrestation']);
    Route::delete('missions/{mission}/prestations/{prestationId}', [MissionController::class, 'destroyPrestation']);

    // === Tickets clients (réclamations, signalements, commandes consommables) ===
    Route::apiResource('client-requests', ClientRequestController::class)
        ->parameters(['client-requests' => 'clientRequest']);

    // === Accès extranet client (création / reset / email / révocation) ===
    Route::post('clients/{client}/portal-access', [ClientPortalAccessController::class, 'create']);
    Route::post('clients/{client}/portal-access/reset', [ClientPortalAccessController::class, 'reset']);
    Route::post('clients/{client}/portal-access/email', [ClientPortalAccessController::class, 'sendEmail']);
    Route::delete('clients/{client}/portal-access', [ClientPortalAccessController::class, 'revoke']);

    // === Accès extranet intervenant (mêmes 4 actions que client) ===
    Route::post('employees/{employee}/portal-access', [EmployeePortalAccessController::class, 'create']);
    Route::post('employees/{employee}/portal-access/reset', [EmployeePortalAccessController::class, 'reset']);
    Route::post('employees/{employee}/portal-access/email', [EmployeePortalAccessController::class, 'sendEmail']);
    Route::delete('employees/{employee}/portal-access', [EmployeePortalAccessController::class, 'revoke']);

    // === Uploads médias (avatars intervenants + logos clients) ===
    Route::post('employees/{employee}/avatar', [MediaUploadController::class, 'uploadEmployeeAvatar']);
    Route::delete('employees/{employee}/avatar', [MediaUploadController::class, 'deleteEmployeeAvatar']);
    Route::post('clients/{client}/logo', [MediaUploadController::class, 'uploadClientLogo']);
    Route::delete('clients/{client}/logo', [MediaUploadController::class, 'deleteClientLogo']);

    // Intervenants
    Route::apiResource('employees', EmployeeController::class);
    Route::prefix('employees/{employee}')->group(function () {
        Route::controller(EmployeeSubResourceController::class)->group(function () {
            Route::get('addresses', 'listAddresses'); Route::post('addresses', 'storeAddress');
            Route::patch('addresses/{addressId}', 'updateAddress'); Route::delete('addresses/{addressId}', 'destroyAddress');
            Route::get('absences', 'listAbsences'); Route::post('absences', 'storeAbsence');
            Route::patch('absences/{absenceId}', 'updateAbsence'); Route::delete('absences/{absenceId}', 'destroyAbsence');
            Route::get('trainings', 'listTrainings'); Route::post('trainings', 'storeTraining');
            Route::patch('trainings/{trainingId}', 'updateTraining'); Route::delete('trainings/{trainingId}', 'destroyTraining');
            Route::put('skills', 'syncSkills');
        });
        // Contrats (Sprint B)
        Route::controller(ContractController::class)->group(function () {
            Route::get('contracts', 'list'); Route::post('contracts', 'store');
            Route::get('contracts/{contractId}', 'show');
            Route::patch('contracts/{contractId}', 'update'); Route::delete('contracts/{contractId}', 'destroy');
        });
        // Saisies sur salaire (Sprint B)
        Route::controller(SalaryDeductionController::class)->group(function () {
            Route::get('salary-deductions', 'list'); Route::post('salary-deductions', 'store');
            Route::delete('salary-deductions/{deductionId}', 'destroy');
            Route::post('salary-deductions/{deductionId}/debts', 'addDebt');
            Route::post('salary-deductions/{deductionId}/payments', 'addPayment');
        });
    });

    // Documents polymorphique
    Route::get('documents', [DocumentController::class, 'index']);
    Route::post('documents', [DocumentController::class, 'store']);
    Route::get('documents/{document}/download', [DocumentController::class, 'download']);
    Route::delete('documents/{document}', [DocumentController::class, 'destroy']);

    // Catalogue prestations
    Route::apiResource('products', ProductController::class);

    // Phase 3 — Planning
    Route::get('interventions/calendar', [InterventionController::class, 'calendar']);
    Route::post('interventions/check-conflict', [InterventionController::class, 'checkConflict']);
    Route::get('planning/contract-summary', [PlanningSummaryController::class, 'contractSummary']);
    Route::get('planning/long-absences', [PlanningSummaryController::class, 'longAbsences']);
    Route::get('planning/trips', [PlanningSummaryController::class, 'trips']);
    Route::get('planning/available-employees', [PlanningSummaryController::class, 'availableEmployees']);
    Route::post('interventions/{intervention}/exceptions', [InterventionController::class, 'createException']);
    Route::apiResource('interventions', InterventionController::class);

    // Phase 3 — Ventes
    // Types de devis (modèles pré-paramétrés) — 2026-05-20
    Route::apiResource('quote-types', QuoteTypeController::class)
        ->parameters(['quote-types' => 'quoteType']);
    Route::apiResource('quotes', QuoteController::class);
    Route::get('quotes/{quote}/pdf', [QuoteController::class, 'pdf']); // 2026-05-20 PDF B2B
    Route::post('quotes/{quote}/sync-pennylane', [QuoteController::class, 'syncPennylane']);
    Route::post('quotes/{quote}/convert-to-invoice', [QuoteController::class, 'convertToInvoice']);
    // Conversion devis validé → mission + prestations (workflow 2026-05-21)
    Route::post('quotes/{quote}/convert-to-mission', [QuoteController::class, 'convertToMission']);
    Route::apiResource('invoices', InvoiceController::class);
    Route::get('invoices/{invoice}/facturx', [InvoiceController::class, 'facturX']);
    Route::get('invoices/{invoice}/pdf', [InvoiceController::class, 'pdf']); // 2026-05-20 PDF B2B
    Route::post('invoices/{invoice}/sync-pennylane', [InvoiceController::class, 'syncPennylane']);

    // Règlements (paiements reçus + ventilations sur factures)
    Route::apiResource('reglements', ReglementController::class)->except(['update']);
    Route::post('reglements/{reglement}/allocate', [ReglementController::class, 'allocate']);

    // === Phase 4 — Télégestion ===
    Route::prefix('telemanagement')->controller(TelemanagementController::class)->group(function () {
        Route::get('qr-codes', 'listQrCodes');
        Route::post('qr-codes', 'generateQrCode');
        Route::post('badge', 'badge');
        Route::post('manual-entry', 'manualEntry');
        Route::get('logs', 'logs');
    });
    Route::get('interventions/{intervention}/checkins', [TelemanagementController::class, 'listCheckins']);

    // === Phase 5 — Portail client ===
    Route::prefix('clients/{client}/portal')->controller(ClientPortalController::class)->group(function () {
        Route::get('requests', 'listRequests');
        Route::post('requests', 'storeRequest');
        Route::patch('requests/{requestId}', 'updateRequest');
        Route::get('reorders', 'listReorders');
        Route::post('reorders', 'storeReorder');
        Route::patch('reorders/{reorderId}', 'updateReorder');
        Route::get('quality-controls', 'listQualityControls');
        Route::post('quality-controls', 'storeQualityControl');
    });
    // Endpoints de signature électronique retirés le 2026-05-18 : décision
    // produit "pas de Yousign/DocuSign". Pennylane gère les signatures
    // côté devis/factures, on s'appuiera sur leur flow via PennylaneSyncService.
    // La table `electronic_signatures` reste en BDD (rollback safe) mais n'est
    // plus exposée via API.

    // === Phase 6 — Stock par entité ===
    Route::prefix('stock')->controller(StockController::class)->group(function () {
        Route::get('products', 'index');
        Route::post('products', 'store');
        Route::patch('products/{stockProduct}', 'update');
        Route::delete('products/{stockProduct}', 'destroy');
        Route::get('products/{stockProduct}/movements', 'listMovements');
        Route::post('products/{stockProduct}/movements', 'createMovement');
        Route::get('alerts', 'alerts');
    });

    // === Phase 10 — Matching auto intervenant ===
    Route::get('interventions/{intervention}/match', [MatchingController::class, 'suggest']);
    Route::prefix('matching-requests')->controller(MatchingController::class)->group(function () {
        Route::get('/', 'index');
        Route::post('/', 'store');
        Route::patch('{matchingRequest}/assign', 'assign');
        Route::patch('{matchingRequest}/cancel', 'cancel');
    });

    // === Phase 9 — Flotte véhicule ===
    Route::prefix('fleet')->controller(FleetController::class)->group(function () {
        Route::get('vehicles', 'index');
        Route::post('vehicles', 'store');
        Route::get('vehicles/{vehicle}', 'show');
        Route::patch('vehicles/{vehicle}', 'update');
        Route::delete('vehicles/{vehicle}', 'destroy');
        Route::post('vehicles/{vehicle}/assign', 'assign');
        Route::post('vehicles/{vehicle}/unassign', 'unassign');
        Route::get('vehicles/{vehicle}/maintenances', 'listMaintenances');
        Route::post('vehicles/{vehicle}/maintenances', 'createMaintenance');
        Route::get('vehicles/{vehicle}/incidents', 'listIncidents');
        Route::post('vehicles/{vehicle}/incidents', 'createIncident');
        Route::get('alerts', 'alerts');
    });

    // === Phase 7 — Messagerie ===
    Route::prefix('messaging')->controller(MessagingController::class)->group(function () {
        Route::get('threads', 'index');
        Route::post('threads', 'store');
        Route::get('threads/{thread}', 'show');
        Route::post('threads/{thread}/messages', 'postMessage');
        Route::post('threads/{thread}/read', 'markRead');
        Route::get('unread-total', 'totalUnread');
    });

    // === Notifications ===
    Route::get('notifications', [NotificationController::class, 'index']);
    Route::get('notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::patch('notifications/{notification}/read', [NotificationController::class, 'markRead']);
    Route::post('notifications/mark-all-read', [NotificationController::class, 'markAllRead']);
    Route::get('notifications/preferences', [NotificationController::class, 'listPreferences']);
    Route::patch('notifications/preferences/{typeId}', [NotificationController::class, 'updatePreference']);

    // === Extranets (vue restreinte) ===
    Route::prefix('extranet/intervenant')->controller(ExtranetController::class)->group(function () {
        Route::get('profile', 'intervenantProfile');
        Route::get('planning', 'intervenantPlanning');
        Route::get('absences', 'intervenantAbsences');
        Route::get('contract', 'intervenantContract');
        Route::get('my-clients', 'intervenantMyClients');
        Route::get('tickets', 'intervenantTickets');
        Route::post('tickets', 'createIntervenantTicket');
    });
    Route::prefix('extranet/client')->controller(ExtranetController::class)->group(function () {
        Route::get('profile', 'clientProfile');
        Route::get('invoices', 'clientInvoices');
        Route::get('quotes', 'clientQuotes');
        // Validation des devis par le client (workflow 2026-05-21).
        // Ownership strict : le devis doit appartenir au client lié au
        // portal_user_id de l'utilisateur connecté (cf. audit 2026-05-19).
        Route::post('quotes/{quote}/accept', 'acceptClientQuote');
        Route::post('quotes/{quote}/refuse', 'refuseClientQuote');
        Route::get('quotes/{quote}/pdf', 'clientQuotePdf');
        Route::get('prestations', 'clientPrestations');
        Route::get('tickets', 'clientTickets');
        Route::post('tickets', 'createClientTicket');
    });

    // === Tableau de bord (KPI agrégés, admins uniquement) ===
    Route::get('dashboard/stats', [DashboardController::class, 'stats']);

    // === Settings ===
    Route::get('settings/public', [SettingsController::class, 'publicSettings']);
    Route::get('settings', [SettingsController::class, 'index']);
    Route::patch('settings/{key}', [SettingsController::class, 'update']);

    // === Admin : permissions (super_admin only) ===
    Route::get('admin/permissions', [PermissionsController::class, 'index']);
    Route::put('admin/roles/{role}/permissions', [PermissionsController::class, 'syncRolePermissions']);

    // === Admin : gestion users + rôles (super_admin only) ===
    Route::get('admin/users', [UsersController::class, 'index']);
    Route::post('admin/users', [UsersController::class, 'store']);
    Route::get('admin/users/roles', [UsersController::class, 'availableRolesList']);
    Route::post('admin/users/{user}/role', [UsersController::class, 'setRole']);
    Route::patch('admin/users/{user}', [UsersController::class, 'update']);

    // === Référentiel docs requis intervenants ===
    Route::apiResource('required-document-types', RequiredDocumentTypesController::class)
        ->parameters(['required-document-types' => 'requiredDocumentType']);
    Route::get('employees/{employee}/required-documents', [RequiredDocumentTypesController::class, 'checklist']);

    // === Documentation in-app ===
    Route::get('help/articles', [HelpController::class, 'index']);
    Route::get('help/articles/{slug}', [HelpController::class, 'show']);
    Route::post('help/articles', [HelpController::class, 'store']);
    Route::patch('help/articles/{slug}', [HelpController::class, 'update']);
    Route::delete('help/articles/{slug}', [HelpController::class, 'destroy']);
});
