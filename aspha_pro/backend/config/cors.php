<?php

// CORS Configuration — env-aware (dev permissif / prod restrictif).
//
// HISTORIQUE SÉCURITÉ : avant 2026-05-19, `allowed_origins_patterns` était
// fixé a `['/.*/']` (wildcard total) avec `supports_credentials=true`.
// Conséquence : tout site malveillant pouvait envoyer une requête depuis
// nimporte quel domaine vers cette API en piggy-backant la session du user
// (CSRF cross-origin trivial). Cf. audit 2026-05-19 (CRIT).
//
// Désormais :
//  - en `local` / `testing` : wildcard pour la DX (Vite dev sur tout port,
//    ngrok tunnels, etc.)
//  - en `production` : liste blanche stricte alimentée par
//    `CORS_ALLOWED_ORIGINS` (CSV) + repli sur `APP_URL` si vide.

$env = env('APP_ENV', 'production');
$isDevLike = in_array($env, ['local', 'testing'], true);

$prodAllowedOrigins = array_filter(array_map(
    'trim',
    explode(',', (string) env('CORS_ALLOWED_ORIGINS', (string) env('APP_URL', ''))),
));

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie', 'login', 'logout'],

    'allowed_methods' => ['*'],

    'allowed_origins' => $isDevLike ? [] : $prodAllowedOrigins,

    // Regex match-all UNIQUEMENT en dev. En prod = [] (donc seul
    // `allowed_origins` filtre les domaines autorisés).
    'allowed_origins_patterns' => $isDevLike ? ['/.*/'] : [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
