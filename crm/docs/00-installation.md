# Installation détaillée

Ce document explique pas à pas comment installer le projet sur une machine vide. Le script `install.ps1` (Windows) ou `install.sh` (Unix) automatise tout ça — ce document est la référence si quelque chose plante.

## 1. Prérequis système

### Windows 10 / 11

```powershell
# PHP 8.3 (avec extensions Laravel par défaut)
winget install PHP.PHP.8.3

# Node.js 20 LTS + npm
winget install OpenJS.NodeJS.LTS

# Git (souvent déjà installé)
winget install Git.Git
```

**Composer** ne se trouve pas dans winget — utilise l'installeur officiel : https://getcomposer.org/Composer-Setup.exe

> **Important** : après installation, **ferme et rouvre tes terminaux** pour que les nouveaux exécutables soient dans le `PATH`.

### Linux (Ubuntu/Debian)

```bash
sudo add-apt-repository ppa:ondrej/php
sudo apt update
sudo apt install -y php8.3 php8.3-cli php8.3-mbstring php8.3-xml php8.3-curl \
    php8.3-zip php8.3-gd php8.3-intl php8.3-bcmath php8.3-sqlite3 php8.3-mysql \
    composer git

# Node.js 20 LTS via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

### macOS

```bash
brew install php composer node@20 git
```

### Vérification

```bash
php -v        # PHP 8.3.x
composer -V   # Composer 2.x
node -v       # v20.x ou +
npm -v        # 10.x ou +
git --version
```

Toutes les commandes doivent répondre. Si une commande est introuvable, vérifie le `PATH`.

## 2. Configuration PHP

Le projet a besoin des extensions suivantes (toutes incluses dans le PHP officiel mais parfois désactivées dans `php.ini`) :

```
bcmath, curl, fileinfo, gd, intl, mbstring, openssl, pdo, pdo_mysql, pdo_sqlite, sodium, zip
```

Pour vérifier :

```bash
php -m
```

Pour les activer (Windows, install winget) — édite `C:\Users\<TonUser>\AppData\Local\Microsoft\WinGet\Packages\PHP.PHP.8.3_*\php.ini` et décommente les lignes `;extension=...` correspondantes.

## 3. Cloner et installer le projet

```bash
git clone <url-du-repo> crm_aspha
cd crm_aspha
```

### Option A — Script automatique (recommandé)

```powershell
# Windows
.\install.ps1
```
```bash
# Linux/macOS
./install.sh
```

### Option B — Manuel

```bash
# Backend
cd backend
cp .env.example .env
composer install
php artisan key:generate
touch database/database.sqlite        # Linux/macOS
# OU sous Windows : New-Item database\database.sqlite -ItemType File
php artisan migrate:fresh --seed
cd ..

# Frontend
cd frontend
npm install
cd ..

# Root (concurrently pour npm run dev)
npm install
```

Le seeder crée :
- 1 site `ASPHA-MAIN`
- 1 super-admin : `admin@aspha.local` / `admin1234`
- Les 5 rôles Spatie (`super-admin`, `admin`, `manager`, `employee`, `client`)

## 4. Premier lancement

```bash
npm run dev
```

Tu dois voir dans ton terminal :

```
[BACK]  Server running on [http://127.0.0.1:8000].
[FRONT]   VITE v8.x  ready in xxx ms
[FRONT]   ➜  Local:   http://127.0.0.1:5173/
```

Ouvre `http://localhost:5173` dans ton navigateur. Tu seras redirigé vers `/login`. Connecte-toi avec `admin@aspha.local` / `admin1234`.

## 5. Cas d'erreur fréquents

### `php: command not found` après install winget
Ferme **tous** les terminaux ouverts (y compris ton IDE) et rouvre-les. Le `PATH` n'est rafraîchi que pour les nouveaux processus.

### Sur Windows : `Permission denied` lors de `composer install`
Lance le terminal en mode Administrateur, ou pose le projet ailleurs que dans `C:\Program Files\` ou un dossier protégé.

### `Class "PDO" not found` ou `could not find driver`
L'extension `pdo_sqlite` (ou `pdo_mysql` selon la BDD configurée) n'est pas activée dans `php.ini`. Voir section 2.

### `Vite: ERR_CONNECTION_REFUSED` sur `/api/...`
Le backend Laravel n'est pas lancé. Vérifie qu'il tourne sur `http://127.0.0.1:8000` (`npm run dev:back`) avant de tester le front.

### `419 Page Expired` au login
Le cookie XSRF n'a pas été récupéré. Le store appelle `csrf()` avant `POST /api/login`. Si le problème persiste, vérifie :
- `SANCTUM_STATEFUL_DOMAINS=localhost:5173,127.0.0.1:5173` dans `backend/.env`
- Pas de `SESSION_DOMAIN` ou bien à `null` (en dev local)
- Que tu ouvres l'app via `http://localhost:5173` (pas `127.0.0.1` — ou alors mets aussi `127.0.0.1` dans STATEFUL_DOMAINS)

### `database is locked` (SQLite, Windows)
SQLite tolère mal les accès concurrents avec certains antivirus. Solutions :
- Exclure le dossier `backend/database/` de l'antivirus
- Passer en MySQL local (modifier `.env`, créer la BDD, `php artisan migrate:fresh --seed`)

### Le port 8000 ou 5173 est déjà pris
- Pour Laravel : `npm run dev:back -- --port=8001` puis ajuster le proxy dans `frontend/vite.config.ts`
- Pour Vite : édite `vite.config.ts` (clé `server.port`)

## 6. Reset complet de la BDD

À tout moment, pour repartir d'une BDD propre avec les données seed :

```bash
npm run fresh
```

Équivalent à `php backend/artisan migrate:fresh --seed` — **DROP toutes les tables** et recrée tout.
