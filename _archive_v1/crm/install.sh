#!/usr/bin/env bash
# Aspha CRM — Installateur (Linux/macOS)
#
# Vérifie les prérequis, installe les dépendances PHP/Node, prépare la BDD SQLite et lance les seeders.
# Usage : ./install.sh
# Requiert : PHP 8.3+, Composer 2.x, Node.js 20+, npm 10+, Git

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

check_cmd() {
    if command -v "$1" >/dev/null 2>&1; then
        echo "[OK] $1 : $(command -v "$1")"
    else
        echo "[X] $1 introuvable dans le PATH"
        return 1
    fi
}

echo "=== Vérification des prérequis ==="
ok=true
check_cmd php || ok=false
check_cmd composer || ok=false
check_cmd node || ok=false
check_cmd npm || ok=false
check_cmd git || ok=false

if [ "$ok" = "false" ]; then
    echo ""
    echo "Installe les outils manquants puis relance le script."
    exit 1
fi

echo ""
echo "=== Backend Laravel ==="

cd "$ROOT/backend"

if [ ! -f .env ]; then
    cp .env.example .env
    echo "[OK] .env créé depuis .env.example"
fi

echo "[..] composer install"
composer install --no-interaction --prefer-dist

echo "[..] artisan key:generate"
php artisan key:generate --no-interaction

if [ ! -f database/database.sqlite ]; then
    touch database/database.sqlite
    echo "[OK] SQLite créé : database/database.sqlite"
fi

echo "[..] artisan migrate:fresh --seed"
php artisan migrate:fresh --seed --no-interaction

echo ""
echo "=== Frontend React ==="

cd "$ROOT/frontend"
echo "[..] npm install"
npm install --silent

cd "$ROOT"
echo "[..] npm install (root, concurrently)"
npm install --silent

echo ""
echo "=== Installation terminée ==="
echo ""
echo "Identifiants par défaut :"
echo "  Email    : admin@aspha.local"
echo "  Password : admin1234"
echo ""
echo "Pour démarrer (depuis ce dossier) :"
echo "  npm run dev"
echo ""
echo "  Backend  : http://127.0.0.1:8000"
echo "  Frontend : http://localhost:5173"
