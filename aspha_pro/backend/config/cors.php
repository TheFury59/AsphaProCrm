<?php

/*
|--------------------------------------------------------------------------
| CORS Configuration — DEV (totalement permissif)
|--------------------------------------------------------------------------
|
| En dev, on accepte tout pour ne pas se prendre la tête.
| Pour les cookies de session Sanctum, on ne peut PAS utiliser
| allowed_origins=['*'] avec supports_credentials=true (limitation navigateur).
| À la place, on matche tout via une regex dans allowed_origins_patterns.
|
| EN PROD : durcir allowed_origins à FRONTEND_URL uniquement.
|
*/

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie', 'login', 'logout'],

    'allowed_methods' => ['*'],

    'allowed_origins' => [],

    // Regex match-all pour permettre les credentials cross-origin en dev
    'allowed_origins_patterns' => ['/.*/'],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
