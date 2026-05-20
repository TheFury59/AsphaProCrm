<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web routes — service du SPA React
|--------------------------------------------------------------------------
|
| En déploiement, le frontend React est buildé dans public/ (cf. Dockerfile).
| Les assets statiques (public/assets/*, favicon…) sont servis directement
| par le serveur. Toute autre URL qui n'est PAS une route API/Sanctum est
| renvoyée vers index.html : le routeur React prend le relais côté client.
|
*/

$serveSpa = function () {
    $index = public_path('index.html');
    // En dev pur (pas de build front dans public/), on retombe sur la vue
    // welcome de Laravel — évite un 404 sec.
    if (! file_exists($index)) {
        return view('welcome');
    }

    return response()->file($index);
};

Route::get('/', $serveSpa);

// Catch-all : toute route hors api / sanctum / storage → le SPA.
Route::get('/{any}', $serveSpa)
    ->where('any', '^(?!api|sanctum|storage|up).*$');
