# Déploiement — o2switch

> **Statut** : ce document est un guide de référence. Le déploiement effectif sera réalisé en fin de phase 1, une fois les modules de base stabilisés.

## Contexte

o2switch propose principalement de l'hébergement **mutualisé "Cloud"** (cPanel, Apache + PHP-FPM, MariaDB). C'est la cible prévue pour Aspha CRM. Quelques contraintes importantes :

- Pas d'accès root, mais SSH disponible (à activer dans cPanel)
- Pas de queue worker permanent (pas de Redis, pas de daemon → utiliser `database` driver + cron)
- Pas de Docker
- PHP 8.3 disponible via cPanel
- MariaDB 10.x

## Stratégie de déploiement

Deux URLs cibles à valider avec le client :

| URL | Rôle |
|---|---|
| `https://app.aspha.fr` | Frontend (build statique React) |
| `https://api.aspha.fr` | Backend Laravel |

> Alternative mono-domaine : `aspha.fr` racine = front, `aspha.fr/api/` = back. Plus simple côté DNS mais demande une config Apache un peu retouchée.

### Variables d'environnement de prod (`backend/.env`)

```env
APP_NAME="Aspha CRM"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.aspha.fr
FRONTEND_URL=https://app.aspha.fr
APP_TIMEZONE=Europe/Paris
APP_LOCALE=fr

# BDD MariaDB (cf cPanel → MySQL Databases)
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=aspha_crm_prod
DB_USERNAME=aspha_user
DB_PASSWORD=<généré>

# Sanctum SPA cross-subdomain
SANCTUM_STATEFUL_DOMAINS=app.aspha.fr
SESSION_DOMAIN=.aspha.fr
SESSION_SECURE_COOKIE=true
SESSION_DRIVER=database

# Cache / Queue (mutualisé : pas de Redis)
CACHE_STORE=database
QUEUE_CONNECTION=database

# Mail (à configurer selon le client — SMTP o2switch ou SendGrid/Mailgun)
MAIL_MAILER=smtp
MAIL_HOST=...
MAIL_PORT=587
MAIL_USERNAME=...
MAIL_PASSWORD=...
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=no-reply@aspha.fr
MAIL_FROM_NAME="${APP_NAME}"

# Google Maps Distance Matrix (clé séparée pour la prod)
GOOGLE_MAPS_API_KEY=...

# Logs niveau warning en prod
LOG_LEVEL=warning
```

## Étapes de déploiement (manuel SSH)

### 1. Côté DNS (à faire avant)

Pointer `app.aspha.fr` et `api.aspha.fr` vers o2switch (CNAME ou A record selon config).

### 2. Côté cPanel

1. **Activer SSH** (Sécurité → Accès SSH)
2. **Créer la BDD MariaDB** (Bases de données → MySQL → créer `aspha_crm_prod` + utilisateur + mot de passe + privilèges complets sur cette BDD)
3. **Créer les sous-domaines** `app.aspha.fr` et `api.aspha.fr`
4. **Activer PHP 8.3** sur le sous-domaine `api.aspha.fr` (Sélecteur PHP)
5. **Lettre encrypt SSL** sur les deux sous-domaines (cPanel → SSL/TLS Status → Run AutoSSL)

### 3. Backend (SSH)

```bash
# Cloner le projet (zone hors public_html, pour ne pas exposer le code)
cd ~
git clone <url-du-repo> aspha-crm
cd aspha-crm/backend

# Installer dépendances
composer install --optimize-autoloader --no-dev

# Configurer .env (copier depuis .env.example puis adapter)
cp .env.example .env
nano .env   # remplir les valeurs production (cf section au-dessus)
php artisan key:generate

# Migrer la BDD (PAS migrate:fresh en prod — ce serait destructeur)
php artisan migrate --force

# Seed le super-admin (uniquement la première fois)
php artisan db:seed --force --class=DatabaseSeeder

# Optimisations
php artisan config:cache
php artisan route:cache
php artisan event:cache
php artisan view:cache
php artisan storage:link

# Permissions storage et cache
chmod -R 775 storage bootstrap/cache
```

### 4. Configurer Apache pour `api.aspha.fr`

Le DocumentRoot doit pointer vers `~/aspha-crm/backend/public/`. Dans cPanel : **Sous-domaines** → modifier la racine du document.

Ajouter un `.htaccess` à la racine du sous-domaine si pas généré :

```apache
<IfModule mod_rewrite.c>
    <IfModule mod_negotiation.c>
        Options -MultiViews -Indexes
    </IfModule>

    RewriteEngine On
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^ index.php [L]
</IfModule>
```

(Laravel fournit ce fichier dans `public/.htaccess`.)

### 5. Frontend (build local + upload)

```bash
# En local
cd frontend
npm run build
# → produit `dist/`
```

Configurer l'API URL **avant** le build (variable env Vite) :

```env
# frontend/.env.production
VITE_API_BASE_URL=https://api.aspha.fr
```

Et adapter `src/lib/api.ts` pour utiliser cette variable :

```ts
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api",
  withCredentials: true,
  withXSRFToken: true,
});
```

Puis upload `dist/` vers le DocumentRoot de `app.aspha.fr` (FTP, SCP, ou cPanel File Manager).

### 6. Configurer Apache pour `app.aspha.fr`

Pour que le routing client React fonctionne (sinon F5 sur `/planning` → 404), ajouter un `.htaccess` :

```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_FILENAME} !-l
    RewriteRule . /index.html [L]
</IfModule>
```

### 7. Cron Laravel (cPanel → Tâches Cron)

Pour les jobs récurrents (matérialisation des appointments, queues, etc.) :

```cron
* * * * * cd /home/<user>/aspha-crm/backend && php artisan schedule:run >> /dev/null 2>&1
```

Le scheduler Laravel fait tourner les jobs définis dans `app/Console/Kernel.php`.

### 8. Premières vérifications

```bash
# Tester l'API depuis ton poste
curl https://api.aspha.fr/api/ping
# → { "status": "ok", "time": "...", "app": "Aspha CRM" }

# Tester le front
# Ouvre https://app.aspha.fr → écran de login
```

## Checklist de mise en prod

- [ ] DNS `app.aspha.fr` et `api.aspha.fr` configurés
- [ ] SSL Let's Encrypt activé sur les deux sous-domaines
- [ ] BDD MariaDB créée + utilisateur dédié avec mot de passe fort
- [ ] `.env` production complété (pas de valeurs `local` traînantes)
- [ ] `APP_DEBUG=false` (sinon stack traces exposées au public !)
- [ ] `APP_KEY` généré (différent de la dev)
- [ ] Mot de passe super-admin **changé** dès la première connexion
- [ ] Cron `schedule:run` configuré
- [ ] Logs accessibles (`storage/logs/laravel.log`) et rotation configurée
- [ ] Sauvegarde automatique BDD (cPanel → Backup ou script SQL via cron quotidien)
- [ ] Tests fumée :
  - [ ] Login avec compte test
  - [ ] Création d'un client
  - [ ] Création d'un service_assignment ponctuel + récurrent
  - [ ] Affichage du planning sur `/planning`
  - [ ] Logout

## Pipeline de déploiement (à automatiser plus tard)

Une fois le projet stabilisé, on automatisera avec **GitHub Actions** :

1. Push sur `main` → CI lance les tests
2. Si OK → SSH déploiement automatique sur o2switch :
   - `git pull` sur le serveur
   - `composer install --no-dev`
   - `php artisan migrate --force`
   - `php artisan optimize`
   - Upload du `dist/` frontend

Pour l'instant, déploiement manuel.
