<?php

use App\Http\Controllers\V1\AuthController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes V1 — Aspha Pro
|--------------------------------------------------------------------------
|
| Préfixe global appliqué via bootstrap/app.php : /api/v1
| Toutes les routes ici sont donc accessibles sous /api/v1/...
|
*/

// Healthcheck public
Route::get('/ping', fn () => [
    'status' => 'ok',
    'app' => config('app.name'),
    'time' => now()->toIso8601String(),
    'version' => 'v1',
]);

// Authentification (Sanctum cookie SPA)
Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
});
