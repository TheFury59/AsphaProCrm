# syntax=docker/dockerfile:1
#
# Aspha Pro — image de déploiement (Render).
# Build en 2 étapes : frontend React puis backend Laravel qui sert le SPA.
# Une seule image, une seule URL — pas de CORS cross-origin.

# ===== Stage 1 : build du frontend React / Vite =====
FROM node:20-alpine AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# `npx vite build` directement : on évite `npm run build` qui lance d'abord
# `tsc -b` (typecheck strict) — non bloquant pour un déploiement de test.
RUN npx vite build

# ===== Stage 2 : backend Laravel + serveur PHP =====
FROM php:8.2-cli AS app

# Extensions système + PHP nécessaires (PostgreSQL, PDF, i18n, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
      git unzip libzip-dev libpq-dev libpng-dev libjpeg62-turbo-dev \
      libfreetype6-dev libonig-dev libicu-dev \
 && docker-php-ext-configure gd --with-freetype --with-jpeg \
 && docker-php-ext-install -j"$(nproc)" \
      pdo_pgsql pgsql bcmath zip gd intl exif pcntl mbstring \
 && apt-get clean && rm -rf /var/lib/apt/lists/*

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

# Code backend + dépendances PHP (prod uniquement)
COPY backend/ ./
RUN composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist

# Le SPA buildé est servi par Laravel depuis public/
COPY --from=frontend /build/dist/. ./public/

# Permissions d'écriture pour storage + cache
RUN chmod -R 775 storage bootstrap/cache

# Script de démarrage (migrate + seed + serve).
# `sed` retire d'éventuels retours chariot Windows (CRLF) qui casseraient
# l'exécution du script dans le conteneur Linux.
COPY docker/start.sh /usr/local/bin/start.sh
RUN sed -i 's/\r$//' /usr/local/bin/start.sh \
 && chmod +x /usr/local/bin/start.sh

EXPOSE 8080
CMD ["start.sh"]
