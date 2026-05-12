<?php

use App\Http\Controllers\V1\AuthController;
use App\Http\Controllers\V1\ClientController;
use App\Http\Controllers\V1\ClientSubResourceController;
use App\Http\Controllers\V1\ContractController;
use App\Http\Controllers\V1\DocumentController;
use App\Http\Controllers\V1\EmployeeController;
use App\Http\Controllers\V1\EmployeeSubResourceController;
use App\Http\Controllers\V1\InterventionController;
use App\Http\Controllers\V1\InvoiceController;
use App\Http\Controllers\V1\ProductController;
use App\Http\Controllers\V1\QuoteController;
use App\Http\Controllers\V1\ReferentialsController;
use App\Http\Controllers\V1\SalaryDeductionController;
use Illuminate\Support\Facades\Route;

Route::get('/ping', fn () => [
    'status' => 'ok',
    'app' => config('app.name'),
    'time' => now()->toIso8601String(),
    'version' => 'v1',
]);

Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
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
    Route::apiResource('interventions', InterventionController::class);

    // Phase 3 — Ventes
    Route::apiResource('quotes', QuoteController::class);
    Route::apiResource('invoices', InvoiceController::class);
});
