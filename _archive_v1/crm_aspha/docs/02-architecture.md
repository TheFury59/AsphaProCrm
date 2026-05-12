# Architecture & conventions

## Choix structurants

### Monorepo

Backend et frontend cohabitent dans le même dépôt (dossiers `backend/` et `frontend/`). Avantages : un seul clone, un seul historique git, scripts root pour tout piloter (`npm run dev`).

### SPA séparée + API REST

Le frontend React est une **SPA pure** qui consomme l'API Laravel via `axios` + cookies de session Sanctum. Pas d'Inertia, pas de Blade — l'API et le front évoluent indépendamment.

En **dev local**, Vite proxy `/api` et `/sanctum` vers le backend (`vite.config.ts`) : depuis le navigateur, tout passe par `http://localhost:5173` (pas de CORS à gérer).

En **prod**, deux scénarios possibles (à arbitrer pour o2switch) :
- **Sous-domaines partagés** : `app.aspha.fr` (front) + `api.aspha.fr` (back) avec `SESSION_DOMAIN=.aspha.fr`
- **Mono-domaine** : front à la racine, API sur `aspha.fr/api/`

### Authentification — Sanctum SPA cookie-based

Le navigateur reçoit un cookie de session `aspha_crm_session` après login. Tous les appels API partent avec ce cookie + un header `X-XSRF-TOKEN` lu depuis le cookie `XSRF-TOKEN`. Pas de token JWT, pas de localStorage — c'est plus sécurisé contre le XSS.

Détails dans [03-auth.md](03-auth.md).

### Multi-site via `site_id`

Chaque entité métier (employee, client, invoice, …) porte un `site_id`. Les requêtes Eloquent filtrent automatiquement par site (à implémenter avec un global scope quand le module multi-site sera vraiment exploité). Cette approche scale jusqu'à des dizaines de sites sans changer de stratégie.

### Calendrier → service_assignment + appointment

Le cœur du planning :
- **`service_assignments`** = la « période de service » (ID stable). Une affectation d'un service à un client, ponctuelle ou récurrente (RRULE iCal).
- **`appointments`** = instances réelles dans le calendrier, matérialisées par un job à partir des SA récurrentes.

C'est ce qui permet à un client d'avoir **plusieurs services le même jour** (chaque SA est indépendante) tout en gardant un identifiant stable pour la facturation et l'historique.

## Structure du backend

```
backend/
├── app/
│   ├── Http/
│   │   ├── Controllers/      AuthController, [Resource]Controller
│   │   ├── Requests/         FormRequest pour validation
│   │   └── Resources/        API Resources (transformation JSON)
│   ├── Models/               Eloquent (User, Site, Employee, …)
│   ├── Jobs/                 Tâches asynchrones (matérialisation, …)
│   ├── Services/             Logique métier réutilisable
│   ├── Policies/             Autorisation par modèle
│   └── Providers/
├── bootstrap/app.php         Configuration framework (middleware, routing)
├── config/                   Configuration (sanctum, permission, …)
├── database/
│   ├── migrations/           Schéma BDD (chronologique)
│   ├── seeders/              Données initiales
│   ├── factories/            Factories de test
│   └── database.sqlite       BDD locale (gitignored)
├── routes/api.php            Routes API
├── storage/                  Logs, cache, uploads (gitignored sauf .gitkeep)
└── tests/                    Tests PHPUnit (Feature + Unit)
```

## Structure du frontend

```
frontend/src/
├── components/               Composants UI réutilisables
│   ├── ui/                   shadcn-style primitives (Button, Input, …)
│   └── ProtectedRoute.tsx    Garde de route auth
├── lib/
│   ├── api.ts                Instance axios + helpers d'erreur
│   └── utils.ts              cn() pour Tailwind
├── pages/                    Pages routées par React Router
├── stores/                   Zustand (auth.ts, …)
├── hooks/                    React hooks réutilisables (à venir)
├── types/                    Types TS partagés
├── App.tsx                   Routing + Layout
├── main.tsx                  Entry point
└── index.css                 Tailwind + variables CSS shadcn
```

## Conventions

### Code

- **Backend**
  - Tables/colonnes en **anglais snake_case** (`service_assignments`, `scheduled_start`)
  - Models en **PascalCase** singulier (`ServiceAssignment`)
  - Controllers : un par ressource (`ServiceAssignmentController`), méthodes RESTful (`index/show/store/update/destroy`)
  - Form Requests pour la validation, jamais directement dans le controller
  - API Resources pour la sérialisation JSON
  - Tests Feature : un fichier par endpoint majeur
- **Frontend**
  - Composants en **PascalCase** (`LoginPage`, `AppointmentForm`)
  - Hooks préfixés `use*` (`useAuth`, `useAppointments`)
  - Path alias `@/` → `src/` (configuré dans `tsconfig` et `vite.config.ts`)
  - Pas de `any` non justifié — toujours typer les retours d'API
  - Forms : RHF + zod, jamais de gestion d'état manuelle
- **UI** : libellés en **français**, code en anglais.

### Git

- Branches : `main` (prod), `feature/<nom>`, `fix/<nom>`
- Commits style **conventional commits** : `feat(planning): add drag-and-drop`
- Squash merge sur main pour garder un historique propre

### Migrations

- Une migration = un changement atomique
- Toujours fournir `down()` symétrique (rollback fiable)
- Préfixer le nom par le verbe : `create_*`, `alter_*`, `drop_*`, `rename_*`
- Ajouter les indexes en même temps que la table

### API

- Routes versionnées si besoin plus tard (`/api/v1/...`) — pour l'instant `/api/...`
- Format JSON pour tout : entrées et sorties
- Erreurs 422 avec `{ message, errors: { field: [msg] } }` (Laravel par défaut)
- Filtres en query string : `?from=...&to=...&employee_id=...`
- Pagination : `?page=2&per_page=25` (Laravel Resource Collection)

### BDD

- IDs : `unsignedBigInteger` auto-increment (simple, perf OK pour ce projet)
- FK : nommées `<entity>_id`, contrainte `ON DELETE RESTRICT` par défaut
- Soft delete (`deleted_at`) sur entités métier importantes
- Statuts : `enum` string (`'planned', 'done', ...`) — lisibles en BDD
- Datetimes : stockés en UTC, affichés en `Europe/Paris`

## Packages externes clés

### Backend

| Package | Rôle |
|---|---|
| `laravel/sanctum` | Auth SPA cookie + tokens API |
| `spatie/laravel-permission` | RBAC (rôles + permissions fines) |
| `spatie/laravel-activitylog` | Audit trail (qui a modifié quoi) |
| `spatie/laravel-medialibrary` | Gestion fichiers (avatars, docs) |
| `simshaun/recurr` | Parsing RRULE iCal pour récurrences |

### Frontend

| Package | Rôle |
|---|---|
| `@tanstack/react-query` | Data fetching + cache + mutations |
| `zustand` | State management léger (auth, UI) |
| `axios` | HTTP client |
| `react-router-dom` | Routing |
| `react-hook-form` + `zod` + `@hookform/resolvers` | Formulaires + validation |
| `@fullcalendar/*` | Calendrier (drag-and-drop, RRULE) |
| `leaflet` + `react-leaflet` | Cartographie (Leaflet open-source, Google pour Distance Matrix uniquement) |
| `tailwindcss` + `tailwindcss-animate` | Styling |
| `class-variance-authority` + `clsx` + `tailwind-merge` | Variantes shadcn-style |
| `lucide-react` | Icônes |
| `date-fns` | Manipulation de dates |
