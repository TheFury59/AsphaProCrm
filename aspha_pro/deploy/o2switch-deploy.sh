#!/usr/bin/env bash
#
# Script de déploiement Aspha Pro sur o2switch (cPanel + SSH).
#
# À exécuter depuis le HOME du compte cPanel :
#   ssh user@ssh.o2switch.net
#   cd ~
#   bash aspha_pro/deploy/o2switch-deploy.sh
#
# Pré-requis (à faire UNE FOIS via cPanel avant le 1er run) :
#   1. cPanel → MySQL Databases : créer la BDD + l'utilisateur + assigner.
#   2. cPanel → Domaines : pointer le domaine sur ~/aspha_pro/backend/public.
#   3. cPanel → SSH Access : générer/uploader la clé SSH.
#   4. cPanel → Versions de PHP : PHP 8.3+ activé sur le domaine.
#   5. cPanel → Activer Node.js (versions ≥ 20) si build serveur.
#   6. Cloner le repo : `git clone https://github.com/TheFury59/AsphaProCrm.git ~/aspha_pro`
#   7. Copier `.env.o2switch.template` → `backend/.env` et remplir les valeurs.

set -euo pipefail

APP_DIR="$HOME/aspha_pro"

# Le dépôt GitHub a une structure imbriquée : le code Laravel/React est dans
# le sous-dossier `aspha_pro/` du clone (cf. racine du repo). On détecte
# automatiquement où se trouve le VRAI Laravel en cherchant un composer.json
# (et pas juste un dossier `backend/` — un dossier vide ou résiduel suffirait
# à induire la mauvaise détection en erreur).
if [ -f "$APP_DIR/aspha_pro/backend/composer.json" ]; then
  APP_DIR="$APP_DIR/aspha_pro"
fi

BACKEND="$APP_DIR/backend"
FRONTEND="$APP_DIR/frontend"

echo "==> Détection : APP_DIR=$APP_DIR"
cd "$APP_DIR"

echo "==> 1/8 — git pull"
# Le `git pull` doit être lancé depuis la racine du dépôt, pas depuis le
# sous-dossier `aspha_pro/`. On remonte d'un niveau si on a auto-détecté
# l'imbrication.
GIT_ROOT="$APP_DIR"
[ -d "$APP_DIR/../.git" ] && GIT_ROOT="$(dirname "$APP_DIR")"
(cd "$GIT_ROOT" && git pull --ff-only origin main)

echo "==> 2/8 — composer install (prod, no-dev)"
cd "$BACKEND"
composer install --no-dev --optimize-autoloader --no-interaction

echo "==> 3/8 — build du frontend"
cd "$FRONTEND"
# Si Node n'est pas dans le PATH par défaut, source ton NVM ou module load ici :
#   . ~/.nvm/nvm.sh && nvm use 20
#
# `--include=dev` est OBLIGATOIRE : sur o2switch, l'app Node est créée en
# mode "production" (= `NODE_ENV=production`), ce qui pousse npm à ignorer
# les devDependencies par défaut. Or `@vitejs/plugin-react`, `vite`,
# `typescript` et toute la chaîne de build vivent en devDependencies.
# Sans ce flag, le `vite build` plante avec "Cannot find package
# '@vitejs/plugin-react'".
NODE_ENV=development npm ci --include=dev
NODE_ENV=development npm run build

echo "==> 4/8 — copie du build dans backend/public/"
# On copie le contenu de dist/ DANS backend/public/ SANS écraser .htaccess
# ni les fichiers Laravel (index.php, favicon.ico, etc.).
rsync -av --exclude=".htaccess" --exclude="index.php" "$FRONTEND/dist/" "$BACKEND/public/"

echo "==> 5/8 — vérification du .env"
cd "$BACKEND"
if [ ! -f .env ]; then
  echo "❌ backend/.env absent. Copie deploy/.env.o2switch.template → backend/.env et remplis-le."
  exit 1
fi
if [ -z "$(grep '^APP_KEY=.\+' .env)" ]; then
  echo "==> APP_KEY vide, génération…"
  php artisan key:generate --force
fi

echo "==> 6/8 — migrations + seeders (idempotents)"
php artisan migrate --force
php artisan db:seed --force

echo "==> 7/8 — caches + storage link"
php artisan storage:link || true
php artisan config:cache
php artisan route:cache
php artisan view:cache

echo "==> 8/8 — permissions"
chmod -R 775 storage bootstrap/cache

echo ""
echo "✅ Déploiement terminé. Test rapide :"
echo "    curl -I https://\$(grep APP_URL .env | cut -d= -f2 | tr -d '\"' | sed 's|https://||')/api/v1/ping"
echo ""
echo "📅 Cron scheduler (à configurer UNE FOIS dans cPanel → Cron Jobs) :"
echo "    * * * * * /usr/local/bin/php $BACKEND/artisan schedule:run >> /dev/null 2>&1"
