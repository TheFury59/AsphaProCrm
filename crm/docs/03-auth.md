# Authentification — Sanctum SPA cookie-based

## Principe

Pas de JWT, pas de token en localStorage. La SPA React s'authentifie via une **session cookie** Laravel classique, exactement comme une app web traditionnelle. C'est plus sécurisé contre le XSS (les cookies `HttpOnly` ne sont pas accessibles au JS) et plus simple à gérer.

## Flux complet

```
┌─────────────┐                                    ┌─────────────┐
│   Frontend  │                                    │   Backend   │
│  (React)    │                                    │  (Laravel)  │
└──────┬──────┘                                    └──────┬──────┘
       │                                                  │
       │  1. GET /sanctum/csrf-cookie                     │
       │  ───────────────────────────────────────────────>│
       │                                                  │  Set-Cookie: XSRF-TOKEN=abc123
       │  <───────────────────────────────────────────────│  Set-Cookie: aspha_crm_session=...
       │                                                  │
       │  2. POST /api/login                              │
       │     Body: { email, password }                    │
       │     Header: X-XSRF-TOKEN (depuis cookie)         │
       │  ───────────────────────────────────────────────>│
       │                                                  │  Vérifie credentials
       │                                                  │  Régénère session
       │  <───────────────────────────────────────────────│  Renvoie { user }
       │                                                  │
       │  3. GET /api/me / GET /api/appointments / …      │
       │     (cookie session envoyé automatiquement       │
       │      + X-XSRF-TOKEN sur POST/PUT/PATCH/DELETE)   │
       │  ───────────────────────────────────────────────>│
       │  <───────────────────────────────────────────────│
       │                                                  │
       │  4. POST /api/logout                             │
       │  ───────────────────────────────────────────────>│
       │  <───────────────────────────────────────────────│  Session invalidée
       │                                                  │
```

## Configuration

### Backend (`backend/.env`)

```env
SANCTUM_STATEFUL_DOMAINS=localhost:5173,127.0.0.1:5173
APP_URL=http://127.0.0.1:8000
FRONTEND_URL=http://localhost:5173
SESSION_DRIVER=database
```

`SANCTUM_STATEFUL_DOMAINS` liste les domaines (avec port) **du frontend** depuis lesquels Laravel acceptera l'auth par session. Toute requête venant d'un autre domaine retombera sur l'auth par token API.

### Backend (`bootstrap/app.php`)

```php
->withMiddleware(function (Middleware $middleware) {
    $middleware->statefulApi();
})
```

Active le middleware `EnsureFrontendRequestsAreStateful` sur toutes les routes API → leur permet de lire le cookie de session.

### Frontend (`vite.config.ts`)

```ts
server: {
  proxy: {
    "/api":     { target: "http://127.0.0.1:8000", changeOrigin: true },
    "/sanctum": { target: "http://127.0.0.1:8000", changeOrigin: true },
  },
}
```

Le navigateur ne voit que `localhost:5173` → pas de problème de cross-origin, tous les cookies sont sur le même domaine.

### Frontend (`src/lib/api.ts`)

```ts
export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,    // envoie les cookies
  withXSRFToken: true,      // lit XSRF-TOKEN cookie → header X-XSRF-TOKEN auto
});
```

### Frontend (`src/stores/auth.ts`)

```ts
login: async (email, password) => {
  await csrf();                                          // étape 1
  const { data } = await api.post("/login", { … });      // étape 2
  set({ user: data, status: "ready" });
}
```

## Routes auth

| Méthode | URL | Auth requise | Description |
|---|---|---|---|
| GET | `/sanctum/csrf-cookie` | Non | Initialise le cookie XSRF |
| POST | `/api/login` | Non | Connexion (email + password) |
| GET | `/api/me` | Oui | Retourne l'utilisateur courant |
| POST | `/api/logout` | Oui | Déconnexion (invalide session) |

## Roles & permissions

Les rôles sont gérés par **spatie/laravel-permission** :

```php
// Model
$user->assignRole('manager');
$user->hasRole('super-admin');
$user->can('appointments.delete'); // permission fine
```

Les rôles seedés :
- `super-admin` — accès total
- `admin` — admin d'un site
- `manager` — gestionnaire (planning, RH)
- `employee` — extranet salarié
- `client` — extranet client

Les **permissions fines** seront ajoutées au fur et à mesure des modules (ex. `appointments.create`, `clients.delete`, …) avec le module Rôles paramétrable du CDC § 4.12.

## Sécurité

- Mots de passe : hashés avec **bcrypt** (cost 12) via le cast `'password' => 'hashed'`
- Sessions : stockées en BDD (`sessions` table), expiration configurée par `SESSION_LIFETIME` (120 min par défaut)
- CSRF : double-cookie pattern Laravel (cookie `XSRF-TOKEN` + header `X-XSRF-TOKEN`)
- Cookies : `HttpOnly`, `SameSite=lax`, `Secure` en prod
- En prod : `APP_ENV=production`, `SESSION_SECURE_COOKIE=true` obligatoires

## Déconnexion forcée

Pour invalider toutes les sessions d'un user (ex. après changement de mot de passe) :

```php
$user->tokens()->delete();          // tokens API si tu en utilises
DB::table('sessions')->where('user_id', $user->id)->delete();  // sessions web
```
