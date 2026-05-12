# Aspha CRM

CRM métier dédié aux services à la personne — Aspha. Reproduit la logique du module planning Ximi (Xelya) tout en intégrant les processus opérationnels d'Aspha (clientèle, RH, facturation, suivi des clés, gestion documentaire).

> **Statut** : phase de cadrage — environnement bootstrappé, schéma BDD complet, auth Sanctum SPA opérationnelle. Voir [docs/](docs/) pour les détails.

## Stack

- **Backend** : Laravel 11 + Sanctum (cookie SPA) + Spatie (Permission, ActivityLog, MediaLibrary) + simshaun/recurr — dossier `backend/`
- **Frontend** : Vite + React 18 + TypeScript + Tailwind v3 + FullCalendar + Leaflet + TanStack Query + Zustand + RHF + zod — dossier `frontend/`
- **BDD** : SQLite en dev local, MySQL/MariaDB en production (o2switch)
- **Hébergement cible** : o2switch (Cloud mutualisé)

## 🚀 Premier démarrage (zéro à fonctionnel)

### Prérequis

| Outil | Version | Installation Windows |
|---|---|---|
| PHP | 8.3+ | `winget install PHP.PHP.8.3` |
| Composer | 2.x | https://getcomposer.org/Composer-Setup.exe |
| Node.js | 20+ | `winget install OpenJS.NodeJS.LTS` |
| Git | 2.x | déjà présent en général |

### Installation automatique

**Windows** :
```powershell
.\install.ps1
```

**Linux/macOS** :
```bash
./install.sh
```

Le script vérifie les prérequis, installe les dépendances (composer + npm), crée la BDD SQLite, applique les migrations et seed un super-admin par défaut.

### Démarrage

Depuis la racine du projet, dans **un seul terminal** :

```bash
npm run dev
```

Cette commande lance simultanément :
- **Backend** : http://127.0.0.1:8000
- **Frontend** : http://localhost:5173

Le frontend proxy automatiquement `/api` et `/sanctum` vers le backend, donc on parle uniquement à `http://localhost:5173` côté navigateur.

### Identifiants par défaut

| Email | Mot de passe | Rôle |
|---|---|---|
| `admin@aspha.local` | `admin1234` | super-admin |

> **À changer dès la première connexion réelle.** Définis aussi des comptes managers/employés/clients via le seeder ou l'UI quand le module Rôles sera prêt.

## 📁 Structure du dépôt

```
crm_aspha/
├── backend/                Laravel 11 — API REST
│   ├── app/                Models, Controllers, Services, Jobs
│   ├── config/             Configuration Laravel
│   ├── database/
│   │   ├── migrations/     Schéma BDD (17 migrations métier)
│   │   ├── seeders/        Seeder par défaut
│   │   └── database.sqlite Base de dev (gitignored)
│   ├── routes/api.php      Routes API
│   └── .env / .env.example Configuration env
│
├── frontend/               Vite + React + TS
│   ├── src/
│   │   ├── components/     Composants réutilisables
│   │   ├── lib/            api.ts (axios), utils.ts (cn)
│   │   ├── pages/          Pages routées
│   │   ├── stores/         Zustand (auth, …)
│   │   ├── App.tsx         Routes + layout
│   │   └── index.css       Tailwind + tokens shadcn
│   ├── tailwind.config.js
│   └── vite.config.ts      Proxy /api et /sanctum
│
├── docs/                   Documentation projet (ce fichier + détails)
│   ├── 00-installation.md
│   ├── 01-schema-bdd.md
│   ├── 02-architecture.md
│   ├── 03-auth.md
│   ├── 04-developpement.md
│   └── 05-deploiement-o2switch.md
│
├── install.ps1             Installateur Windows
├── install.sh              Installateur Unix
├── package.json            Scripts npm root (dev, build, fresh, …)
└── README.md               (ce fichier)
```

## 📚 Documentation

| Fichier | Contenu |
|---|---|
| [docs/00-installation.md](docs/00-installation.md) | Installation détaillée pas à pas (Windows + Unix) |
| [docs/01-schema-bdd.md](docs/01-schema-bdd.md) | Schéma complet de la BDD (26 tables) |
| [docs/02-architecture.md](docs/02-architecture.md) | Stack, structure, conventions de code |
| [docs/03-auth.md](docs/03-auth.md) | Authentification Sanctum SPA cookie-based |
| [docs/04-developpement.md](docs/04-developpement.md) | Cheatsheet commandes quotidiennes |
| [docs/05-deploiement-o2switch.md](docs/05-deploiement-o2switch.md) | Déploiement en production o2switch |
| [docs/06-cartographie-fonctionnelle.md](docs/06-cartographie-fonctionnelle.md) | Audit menu Ximi → décisions Aspha (à compléter) |

## 🛠 Commandes utiles (depuis la racine)

```bash
npm run dev          # Lance backend + frontend en parallèle
npm run dev:back     # Backend seul
npm run dev:front    # Frontend seul
npm run fresh        # Reset BDD + seed (DROP toutes les tables)
npm run build:front  # Build prod du frontend
npm run test:back    # Lance les tests PHPUnit
npm run lint:front   # Lint le frontend
```

## ⚖️ Licence

Propriétaire — Aspha & BI Développement. Tous droits réservés.
