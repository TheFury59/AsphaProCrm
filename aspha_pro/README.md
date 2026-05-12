# Aspha Pro

CRM métier services à la personne — Aspha Pro. Construit sur la base du schéma DBML `crm_ximi_schema_final.dbml` et des modifications fonctionnelles validées avec la cliente.

> **Statut** : **MVP fonctionnel** — Phases 0 / 1 / 2 / 2.5 (A+B) / 3 livrées. Utilisable en démo cliente. Voir [plan-rebuild-aspha-pro.docx](../plan-rebuild-aspha-pro.docx) pour le détail.

## Stack

- **Backend** : Laravel 11 + Sanctum (cookie SPA) + Spatie (Permission, ActivityLog, MediaLibrary, Query Builder) + simshaun/recurr — dossier `backend/`
- **Frontend** : Vite + React 18 + TypeScript + **Tailwind v4 + shadcn/ui (CLI)** + FullCalendar + TanStack Query + Zustand + RHF + zod — dossier `frontend/`
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
├── backend/                      Laravel 11 — 85 routes API V1
│   ├── app/Http/Controllers/V1/  12 controllers versionnés
│   ├── app/Http/Requests/V1/     Form Requests
│   ├── app/Http/Resources/V1/    API Resources
│   ├── app/Http/Middleware/      CorsMiddleware
│   ├── app/Models/               76 modèles Eloquent (générés du DBML)
│   ├── app/Services/             Logique métier
│   ├── database/migrations/      80 migrations (DBML + framework)
│   ├── database/seeders/         RolesAndPermissions + CatalogSeeder
│   ├── routes/api.php            85 routes V1
│   ├── config/cors.php           CORS * (dev)
│   └── bootstrap/app.php         statefulApi() + middleware
│
├── frontend/                     Vite + React 18 + TS
│   └── src/
│       ├── components/           AppLayout, AppSidebar, AppTopbar, ProtectedRoute, PageHeader
│       │   └── ui/               20+ composants shadcn/ui
│       ├── pages/
│       │   ├── clients/          Liste + Fiche (9 onglets) + tabs/
│       │   ├── employees/        Liste + Fiche (8 onglets) + tabs/
│       │   ├── products/         Catalogue prestations
│       │   ├── planning/         FullCalendar + drag-drop
│       │   ├── sales/            Quotes + Invoices
│       │   └── shared/           DocumentsTab polymorphique réutilisable
│       ├── hooks/                use-clients, use-employees, use-products,
│       │                          use-sub-resources, use-phase3
│       ├── stores/               Zustand (auth)
│       ├── lib/                  api (axios), utils (cn)
│       ├── types/                Types API typés
│       └── App.tsx               Routes + providers
│
├── scripts/                      Générateurs Node depuis DBML
│   ├── dbml-to-migrations.mjs    78 migrations générées
│   └── dbml-to-models.mjs        75 modèles générés
│
├── docs/                         Doc projet (à compléter)
├── package.json                  npm run dev (concurrently)
├── install.ps1 / install.sh
└── README.md
```

## ✅ Phases livrées

### Phase 0 — Bootstrap ✅
- Laravel 11 + Sanctum + Spatie (Permission, ActivityLog, MediaLibrary, QueryBuilder) + simshaun/recurr
- Vite + React 18 + TS + Tailwind v4 + shadcn/ui (CLI Nova preset)
- Layout pro : sidebar + topbar + content area
- Auth Sanctum SPA cookie-based
- 4 rôles + 28 permissions fines + super-admin seedé

### Phase 1 — Schéma BDD ✅
- **78 migrations** générées depuis le DBML (scripts Node)
- **76 modèles Eloquent** avec relations (BelongsTo / HasMany / MorphTo)
- Soft deletes sur 9 tables sensibles
- Audit log Spatie sur 9 tables critiques
- Polymorphisme via `Relation::morphMap` pour `addresses` et `documents`
- CatalogSeeder : 1 entité, 4 TVA, 12 raisons absences, 12 compétences, 3 barèmes km, 3 majorations…

### Phase 2 — Modules métier prioritaires ✅
- **Clients** : Liste dense + Fiche à 9 onglets + Dialog création
- **Intervenants** : Liste + Fiche à 8 onglets + Dialog création
- **Prestations** : Catalogue en grille
- API Resources + Form Requests + filtres Spatie QueryBuilder

### Phase 2.5 Sprint A — Sous-modules ✅
- **Contacts** (CRUD avec primary auto) + **Related contacts** (famille/médecin/urgence)
- **Adresses polymorphiques** (client/employee/entity)
- **Absences** ponctuelles + périodiques unifiées (client + intervenant)
- **Clés** + historique mouvements (avec auto-update current_holder)
- **Documents** polymorphique (upload + download)
- **Compétences** (toggle batch via PUT)
- **Formations** (onboarding + ongoing)

### Phase 2.5 Sprint B — RH avancé ✅
- **Contrat intervenant** : formulaire 4 sections (Général / Temps & rémun. / Indemnités km / Paie) avec règle métier 1 actif via auto-désactivation transaction
- **Saisies sur salaire** : créanciers + dettes + paiements (3 niveaux imbriqués)

### Phase 3 — Planning + Ventes ✅
- **Planning** : FullCalendar v6 (jour/semaine/mois/liste, locale FR, drag-and-drop wired, filtres intervenant + client)
- **Interventions** : table unifiée ponctuel/récurrent via `is_recurring`
- **Devis** : CRUD basique (status auto-draft)
- **Factures** : CRUD avec items inline (transaction), référence auto `INV-YYYYMM-XXXX`, total calculé auto

## 🚧 Reste à faire (post-MVP)

### Critique court terme
- **Matérialisation des récurrences** : expansion RRULE → events explosés dans le calendrier (actuellement 1 seul event affiché par récurrence)
- **Factur-X output** sur factures (deadline 1er septembre)
- **Pennylane API** sync devis + factures

### Améliorations Phase 2.5/3
- Édition inline des champs principaux fiches (actuellement dialog obligatoire)
- Reglements + ventilations (paiements reçus)
- Génération SEPA (mandats + ordres XML)

### Phases ultérieures
- **Phase 4** : Télégestion (QR/NFC + checkins + saisie manuelle)
- **Phase 5** : Portail client (réclamations, signatures électroniques, qualité, réassorts consommables)
- **Phase 6** : Stock par entité
- **Phase 7** : Messagerie mobile-first
- **Phase 8** : Notifications multi-canal
- **Phase 9** : Gestion flotte véhicule
- **Phase 10** : Matching auto intervenant (rêve cliente — skills + proximité + dispo)

## Commandes utiles

```bash
npm run dev          # Backend + frontend en parallèle
npm run dev:back     # Backend seul
npm run dev:front    # Frontend seul
npm run fresh        # Reset BDD + seed (admin + catalogue)
npm run build:front  # Build prod
npm run test:back    # PHPUnit
```

## Documents de référence

| Fichier | Rôle |
|---|---|
| [../plan-rebuild-aspha-pro.docx](../plan-rebuild-aspha-pro.docx) | Plan complet v0.2 — 31 sections (4 parties) |
| [../crm_ximi_schema_final.dbml](../crm_ximi_schema_final.dbml) | Schéma BDD source (60 tables) |
| [../modification attributs CRM aspha .docx](../modification%20attributs%20CRM%20aspha%20.docx) | Précisions cliente — 40 règles métier |
| [../LANCER_LE_PROJET.md](../LANCER_LE_PROJET.md) | Cheatsheet rapide pour lancer le projet |

## Licence

Propriétaire — Aspha & BI Développement.
