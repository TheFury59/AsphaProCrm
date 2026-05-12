<?php

use App\Http\Controllers\V1\AuthController;
use App\Http\Controllers\V1\ClientController;
use App\Http\Controllers\V1\ClientSubResourceController;
use App\Http\Controllers\V1\DocumentController;
use App\Http\Controllers\V1\EmployeeController;
use App\Http\Controllers\V1\EmployeeSubResourceController;
use App\Http\Controllers\V1\ProductController;
use App\Http\Controllers\V1\ReferentialsController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes V1 — Aspha Pro
|--------------------------------------------------------------------------
| Préfixe global appliqué via bootstrap/app.php : /api/v1
*/

Route::get('/ping', fn () => [
    'status' => 'ok',
    'app' => config('app.name'),
    'time' => now()->toIso8601String(),
    'version' => 'v1',
]);

Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    // Auth
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    // Référentiels (lecture seule pour selects/combobox)
    Route::get('/referentials/skills', [ReferentialsController::class, 'skills']);
    Route::get('/referentials/client-absence-reasons', [ReferentialsController::class, 'clientAbsenceReasons']);
    Route::get('/referentials/employee-absence-reasons', [ReferentialsController::class, 'employeeAbsenceReasons']);
    Route::get('/referentials/entities', [ReferentialsController::class, 'entities']);
    Route::get('/referentials/job-references', [ReferentialsController::class, 'jobReferences']);
    Route::get('/referentials/vat-rates', [ReferentialsController::class, 'vatRates']);
    Route::get('/referentials/product-categories', [ReferentialsController::class, 'productCategories']);

    // Clients
    Route::apiResource('clients', ClientController::class);

    // Sous-ressources Client (toutes nested under /clients/{client}/...)
    Route::prefix('clients/{client}')->controller(ClientSubResourceController::class)->group(function () {
        // Addresses
        Route::get('addresses', 'listAddresses');
        Route::post('addresses', 'storeAddress');
        Route::patch('addresses/{addressId}', 'updateAddress');
        Route::delete('addresses/{addressId}', 'destroyAddress');
        // Contacts
        Route::get('contacts', 'listContacts');
        Route::post('contacts', 'storeContact');
        Route::patch('contacts/{contactId}', 'updateContact');
        Route::delete('contacts/{contactId}', 'destroyContact');
        // Related contacts
        Route::get('related-contacts', 'listRelated');
        Route::post('related-contacts', 'storeRelated');
        Route::patch('related-contacts/{contactId}', 'updateRelated');
        Route::delete('related-contacts/{contactId}', 'destroyRelated');
        // Absences
        Route::get('absences', 'listAbsences');
        Route::post('absences', 'storeAbsence');
        Route::patch('absences/{absenceId}', 'updateAbsence');
        Route::delete('absences/{absenceId}', 'destroyAbsence');
        // Keys
        Route::get('keys', 'listKeys');
        Route::post('keys', 'storeKey');
        Route::patch('keys/{keyId}', 'updateKey');
        Route::delete('keys/{keyId}', 'destroyKey');
        // Key movements
        Route::get('keys/{keyId}/movements', 'listKeyMovements');
        Route::post('keys/{keyId}/movements', 'storeKeyMovement');
    });

    // Intervenants
    Route::apiResource('employees', EmployeeController::class);

    // Sous-ressources Employee
    Route::prefix('employees/{employee}')->controller(EmployeeSubResourceController::class)->group(function () {
        // Addresses
        Route::get('addresses', 'listAddresses');
        Route::post('addresses', 'storeAddress');
        Route::patch('addresses/{addressId}', 'updateAddress');
        Route::delete('addresses/{addressId}', 'destroyAddress');
        // Absences (with entry_type filter)
        Route::get('absences', 'listAbsences');
        Route::post('absences', 'storeAbsence');
        Route::patch('absences/{absenceId}', 'updateAbsence');
        Route::delete('absences/{absenceId}', 'destroyAbsence');
        // Trainings
        Route::get('trainings', 'listTrainings');
        Route::post('trainings', 'storeTraining');
        Route::patch('trainings/{trainingId}', 'updateTraining');
        Route::delete('trainings/{trainingId}', 'destroyTraining');
        // Skills (sync N-N)
        Route::put('skills', 'syncSkills');
    });

    // Documents polymorphique
    Route::get('documents', [DocumentController::class, 'index']);
    Route::post('documents', [DocumentController::class, 'store']);
    Route::get('documents/{document}/download', [DocumentController::class, 'download']);
    Route::delete('documents/{document}', [DocumentController::class, 'destroy']);

    // Catalogue prestations
    Route::apiResource('products', ProductController::class);
});
