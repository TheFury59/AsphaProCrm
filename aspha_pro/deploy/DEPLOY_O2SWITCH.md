# Déploiement Aspha Pro V1 — o2switch

Procédure complète pour mettre la V1 en production sur o2switch (cPanel + SSH).
**Render reste actif en parallèle** pendant la stabilisation.

## 0 — Pré-requis côté cPanel (étapes à faire AVANT le déploiement)

### A. Base de données MariaDB
1. **cPanel → MySQL® Databases**
2. **Create New Database** :
   - Nom : `aspha_pro` *(préfixé automatiquement, ex. `cpaneluser_aspha_pro`)*
3. **Add New User** :
   - Nom : `aspha_app`
   - Mot de passe : généré (≥ 16 caractères) — **note-le, on en aura besoin**
4. **Add User to Database** → coche **ALL PRIVILEGES**

### B. Domaine
1. **cPanel → Domaines** (ou « Domaines additionnels » / « Sous-domaines »)
2. **Add Domain** : ton domaine
3. **IMPORTANT** : pour le **Document Root**, tape : `aspha_pro/backend/public`
   *(o2switch créera ce répertoire dans le HOME)*

### C. SSH
1. **cPanel → SSH Access**
2. **Manage SSH Keys** → soit générer une paire ici, soit uploader ta clé publique locale
3. Note le **host SSH** (ex. `ssh.cluster033.hosting.ovh.net` ou similaire) et le **port** (souvent `22` ou un port custom o2switch communique)

### D. PHP 8.3
1. **cPanel → Sélecteur de PHP** (ou « MultiPHP Manager »)
2. Sélectionne **PHP 8.3** pour le domaine
3. Active les extensions : `mbstring`, `openssl`, `pdo_mysql`, `xml`, `curl`, `fileinfo`, `gd`, `zip`, `bcmath`, `intl`

### E. Node.js (pour build du frontend sur le serveur)
1. **cPanel → Sélecteur de Node.js** (« Setup Node.js App »)
2. Crée une appli Node 20 dans `~/aspha_pro/frontend/`
3. Note la commande pour activer l'env (généralement `source /home/USER/nodevenv/aspha_pro/frontend/20/bin/activate`)

*Alternative si Node serveur galère : build local + upload du `dist/` via `scp`.*

### F. SSL
1. **cPanel → SSL/TLS Status** (ou « Let's Encrypt™ SSL »)
2. **Run AutoSSL** sur le domaine (gratuit, renouvelé auto)

---

## 1 — Premier déploiement (SSH)

```bash
# Depuis ta machine locale :
ssh user@ssh.o2switch.net   # remplace par tes vrais host/port

# UNE FOIS connecté en SSH :
cd ~
git clone https://github.com/TheFury59/AsphaProCrm.git aspha_pro

# Copie le template .env et édite-le avec tes valeurs
cp aspha_pro/deploy/.env.o2switch.template aspha_pro/backend/.env
nano aspha_pro/backend/.env
# → Remplis : APP_URL=https://TON_DOMAINE, SANCTUM_STATEFUL_DOMAINS=TON_DOMAINE,
#             CORS_ALLOWED_ORIGINS=https://TON_DOMAINE, SESSION_DOMAIN=TON_DOMAINE,
#             DB_DATABASE=cpaneluser_aspha_pro, DB_USERNAME=cpaneluser_aspha_app,
#             DB_PASSWORD=…, MAIL_*

# Active Node si nécessaire (commande exacte donnée par cPanel)
source /home/USER/nodevenv/aspha_pro/frontend/20/bin/activate

# Lance le déploiement automatisé
bash aspha_pro/deploy/o2switch-deploy.sh
```

Le script `o2switch-deploy.sh` enchaîne :
1. `git pull`
2. `composer install --no-dev`
3. `npm ci && npm run build` (frontend)
4. `rsync` du build vers `backend/public/`
5. Vérif/génération de l'APP_KEY
6. Migrations + seed (idempotents)
7. `storage:link` + caches Laravel
8. Permissions `storage/` et `bootstrap/cache/`

**À la fin, vérification :**
```bash
curl -I https://TON_DOMAINE/api/v1/ping
# Doit retourner HTTP/2 200
```

Ouvre `https://TON_DOMAINE` dans le navigateur → login avec `admin@aspha.local` / `admin1234` puis **change le mot de passe immédiatement**.

---

## 2 — Configuration du Cron (planifications)

**cPanel → Cron Jobs → Add New Cron Job**

| Champ | Valeur |
|---|---|
| Minute | `*` |
| Hour | `*` |
| Day | `*` |
| Month | `*` |
| Weekday | `*` |
| Command | `/usr/local/bin/php /home/USER/aspha_pro/backend/artisan schedule:run >> /dev/null 2>&1` |

Remplace `USER` par ton login cPanel.

Active alors les 4 tâches programmées :
- `app:notify-unassigned-interventions` (RDV à pourvoir, quotidien 08:00)
- `app:notify-worked-hours week` (récap hebdo intervenant, lundi 07:00)
- `app:notify-worked-hours month` (récap mensuel, 1er du mois)
- `app:notify-overdue-checkins` (alerte RDV non pointé +30 min, toutes les 10 min)
- `app:notify-document-renewals` (rappels expiration de documents, quotidien 07:30)

---

## 3 — Déploiements suivants (push d'une mise à jour)

Workflow simple :
```bash
# Local : commit + push
git push origin main

# Serveur : pull + redéploie (1 seule commande)
ssh user@o2switch
bash aspha_pro/deploy/o2switch-deploy.sh
```

Le script est **idempotent** : tu peux le relancer autant de fois que nécessaire.

---

## 4 — Premier durcissement post-mise en ligne

À faire dans les 24h après le go-live :

- [ ] **Changer le mot de passe `admin@aspha.local`** depuis l'UI (`/profil`)
- [ ] Créer ton propre compte super_admin (`/admin/users`) et désactiver `admin@aspha.local`
- [ ] **Renseigner l'entité Aspha Pro** : adresse complète (rue / CP / ville), SIRET, n° TVA intra → impactera l'en-tête des PDF devis/factures
- [ ] **Tester un upload de document** (vérifier les permissions de `storage/`)
- [ ] **Tester une notification email** (créer un ticket et vérifier la réception)
- [ ] **Configurer Mailgun/OVH** dans `.env` pour les vrais envois email
- [ ] **Backup** : activer les sauvegardes cPanel quotidiennes sur le compte

---

## 5 — Troubleshooting

### Page 500 / erreur Laravel
```bash
tail -f backend/storage/logs/laravel-$(date +%F).log
```

### Permissions storage cassées
```bash
chmod -R 775 backend/storage backend/bootstrap/cache
```

### Migration foirée
```bash
cd backend && php artisan migrate:status     # voir l'état
php artisan migrate --force                  # ré-essayer
```

### Cache cassé après deploy
```bash
cd backend
php artisan config:clear
php artisan route:clear
php artisan cache:clear
php artisan config:cache && php artisan route:cache
```

### Frontend ne charge pas après build
```bash
ls backend/public/assets/    # doit contenir des .js et .css buildés
ls backend/public/index.html # doit exister
```

Si vide → le build a foiré, relance `cd frontend && npm run build` manuellement.

### Render coupé prématurément
Tant que la V1 o2switch n'est pas validée par la cliente, **garder Render actif** sert de rollback express. Le DNS du domaine pointe sur o2switch ; si o2switch tombe, on peut pointer temporairement sur `aspha-pro.onrender.com` le temps de réparer.
