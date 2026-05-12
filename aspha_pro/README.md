# Aspha Pro

CRM métier services à la personne — Aspha Pro. Construit sur la base du schéma DBML `crm_ximi_schema_final.dbml` et des modifications fonctionnelles validées avec la cliente.

> **Statut** : Phase 0 — Bootstrap terminé. Auth Sanctum opérationnelle. Voir [plan-rebuild-aspha-pro.docx](../plan-rebuild-aspha-pro.docx) pour la suite.

## Stack

- **Backend** : Laravel 11 + Sanctum (cookie SPA) + Spatie (Permission, ActivityLog, MediaLibrary, Query Builder) + simshaun/recurr — dossier `backend/`
- **Frontend** : Vite + React 18 + TypeScript + **Tailwind v4 + shadcn/ui (CLI)** + TanStack Query + Zustand + RHF + zod — dossier `frontend/`
- **BDD** : SQLite (dev) / MariaDB (prod o2switch)

## 🚀 Premier démarrage

### Prérequis

| Outil | Version | Windows |
|---|---|---|
| PHP | 8.3+ | `winget install PHP.PHP.8.3` |
| Composer | 2.x | https://getcomposer.org/Composer-Setup.exe |
| Node.js | 20+ | `winget install OpenJS.NodeJS.LTS` |
| Git | 2.x | déjà présent en général |

### Installation automatique

**Windows :**
```powershell
.\install.ps1
```

**Linux/macOS :**
```bash
./install.sh
```

### Démarrage

```bash
npm run dev
```

→ Backend : http://127.0.0.1:8000 — Frontend : http://localhost:5173

### Identifiants par défaut

| Email | Mot de passe | Rôle |
|---|---|---|
| `admin@aspha.local` | `admin1234` | super_admin |

## Architecture

```
aspha_pro/
├── backend/                      Laravel 11
│   ├── app/Http/Controllers/V1/  Controllers versionnés
│   ├── app/Http/Requests/V1/     Form Requests
│   ├── app/Http/Resources/V1/    API Resources
│   ├── app/Http/Middleware/      CorsMiddleware, etc.
│   ├── app/Models/               Modèles Eloquent
│   ├── database/migrations/      Migrations (~60 prévues en Phase 1)
│   ├── database/seeders/         Roles, permissions, super-admin
│   ├── routes/api.php            Routes API (préfixe /api/v1 dans bootstrap/app.php)
│   ├── config/cors.php           CORS * (dev)
│   └── bootstrap/app.php         statefulApi() + middleware Spatie
│
├── frontend/                     Vite + React 18 + TS
│   └── src/
│       ├── components/           AppLayout, AppSidebar, AppTopbar, ProtectedRoute
│       │   └── ui/               shadcn/ui (16 composants installés)
│       ├── pages/                LoginPage, DashboardPage, ...
│       ├── stores/               Zustand (auth)
│       ├── lib/                  api (axios), utils (cn)
│       └── App.tsx               Routes + providers
│
├── docs/                         Doc projet (TBD)
├── package.json                  npm run dev (concurrently)
├── install.ps1 / install.sh
└── README.md
```

## Commandes utiles

```bash
npm run dev          # Lance backend + frontend en parallèle
npm run dev:back     # Backend seul
npm run dev:front    # Frontend seul
npm run fresh        # Reset BDD + seed
npm run build:front  # Build prod frontend
npm run test:back    # Tests PHPUnit
```

## Phase 0 — Bootstrap (terminé) ✅

- [x] Laravel 11 installé avec Sanctum, Spatie Permission/ActivityLog/MediaLibrary/QueryBuilder, simshaun/recurr
- [x] Structure V1 : `app/Http/Controllers/V1/`, `Requests/V1/`, `Resources/V1/`
- [x] CORS configuré à `*` en dev (compatible cookies Sanctum via `allowed_origins_patterns`)
- [x] CorsMiddleware créé (filet de sécurité supplémentaire)
- [x] Routes versionnées : `/api/v1/...` (préfixe via `bootstrap/app.php`)
- [x] AuthController V1 : login / logout / me
- [x] Seeder : 4 rôles (super_admin, admin, intervenant, client) + 28 permissions + super-admin
- [x] Frontend Vite + React + TS + **Tailwind v4** + **shadcn/ui CLI**
- [x] 16 composants shadcn installés
- [x] Layout pro : sidebar gauche + topbar + main content area
- [x] Login page propre + ProtectedRoute + auth store (Zustand)

## Phase 1 — À venir

Génération des ~60 migrations + modèles Eloquent à partir du DBML.

Voir [plan-rebuild-aspha-pro.docx](../plan-rebuild-aspha-pro.docx) section 22 pour le détail.

## Licence

Propriétaire — Aspha & BI Développement.
