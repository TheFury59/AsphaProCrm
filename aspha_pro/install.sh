#!/usr/bin/env bash
# Aspha Pro — Installateur Unix
# Usage : ./install.sh

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
    echo "Installe les outils manquants puis relance."
    exit 1
fi

echo ""
echo "=== Backend Laravel ==="
cd "$ROOT/backend"

if [ ! -f .env ]; then
    cp .env.example .env
    echo "[OK] .env créé"
fi

composer install --no-interaction --prefer-dist
php artisan key:generate --no-interaction

if [ ! -f database/database.sqlite ]; then
    touch database/database.sqlite
fi

php artisan migrate:fresh --seed --no-interaction

echo ""
echo "=== Frontend React ==="
cd "$ROOT/frontend"
npm install --silent

cd "$ROOT"
npm install --silent

echo ""
echo "=== Installation terminée ==="
echo "  Email    : admin@aspha.local"
echo "  Password : admin1234"
echo ""
echo "Démarrer : npm run dev"
