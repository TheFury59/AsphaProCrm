#!/usr/bin/env sh
#
# Démarrage du conteneur Aspha Pro sur Render.
# Migrations + seed (idempotents) puis serveur HTTP.
set -e

echo "==> Aspha Pro — initialisation"

# On repart de caches propres (les env vars Render ont pu changer)
php artisan config:clear || true

# Schéma + données de base. Tous les seeders sont idempotents
# (firstOrCreate) — ré-exécutables sans doublon à chaque démarrage.
echo "==> Migrations"
php artisan migrate --force

echo "==> Seed (données de base + catalogue)"
php artisan db:seed --force

# Lien symbolique storage public (avatars, logos)
php artisan storage:link || true

# Cache de configuration pour la performance
php artisan config:cache || true

# Serveur HTTP — Render fournit le port via $PORT
echo "==> Serveur sur le port ${PORT:-8080}"
exec php artisan serve --host=0.0.0.0 --port="${PORT:-8080}"
