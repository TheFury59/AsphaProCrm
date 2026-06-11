# Setup environnement de PREPROD sur o2switch

Guide step-by-step pour créer une instance préprod isolée de la prod, avec
promotion auto preprod → prod.

## Architecture cible

```
~/aspha_pro/              ← PROD     → asphapro-erp.fr
   ├── backend/.env       (clés prod, DB prod)
   └── …
~/aspha_pro_preprod/      ← PREPROD  → preprod.asphapro-erp.fr
   ├── backend/.env       (clés preprod, DB preprod, MAIL_MAILER=log)
   └── …
~/backups/                ← rollback DB + commit hashes
```

**Avantages** :
- 2 dossiers isolés, 2 BDD distinctes, 2 `.env` indépendants
- Modifs en preprod = zéro impact sur la prod
- Promotion preprod → prod via 1 commande quand validé

## Pré-requis cPanel (UNE FOIS)

### 1. Créer le sous-domaine `preprod.asphapro-erp.fr`

- cPanel → **Domaines** → **Sous-domaines**
- Sous-domaine : `preprod`
- Domaine : `asphapro-erp.fr`
- Document Root : `aspha_pro_preprod/aspha_pro/backend/public` (chemin
  RELATIF au home, sans `/` au début)
- Save

cPanel demande peut-être de propager le DNS — quelques minutes.

### 2. Activer SSL Let's Encrypt sur le sous-domaine

- cPanel → **Sécurité** → **SSL/TLS Status**
- Cocher `preprod.asphapro-erp.fr` → **Run AutoSSL**
- Quelques minutes plus tard : HTTPS actif

### 3. Créer la BDD preprod

- cPanel → **MySQL® Databases**
- Nouvelle BDD : `<cpanel_user>_aspha_preprod`
- Nouvel utilisateur : `<cpanel_user>_aspha_pp` + mot de passe fort
- **Add User to Database** : assigne avec tous les privilèges sauf GRANT

Note les 3 valeurs (DB name / user / pass), tu en auras besoin pour `.env`.

### 4. (Optionnel) Application Node.js preprod

Si tu veux le build du frontend côté serveur depuis preprod (recommandé) :
- cPanel → **Node.js Apps**
- Create Application :
  - Node.js version : 20 (ou plus)
  - Application root : `aspha_pro_preprod/aspha_pro/frontend`
  - Application URL : peu importe, on n'utilise pas le serveur Node
  - Pas d'Application startup file requis

Tu pourras lancer le build via SSH plutôt qu'en passant par cette interface,
mais l'app cPanel installe Node + npm dans le PATH, c'est utile.

## Clonage initial (en SSH)

```bash
ssh <user>@ssh.o2switch.net
cd ~
git clone https://github.com/TheFury59/AsphaProCrm.git aspha_pro_preprod
```

Le dépôt a une structure imbriquée — le code Laravel/React est dans
`aspha_pro_preprod/aspha_pro/`.

## Configurer le `.env` preprod

```bash
cd ~/aspha_pro_preprod/aspha_pro/backend
cp ../deploy/.env.o2switch.template .env
nano .env
```

**Valeurs à adapter par rapport à la prod** :

```ini
APP_NAME="Aspha Pro (PREPROD)"
APP_ENV=production              # ← reste "production" pour le bon comportement Laravel
APP_DEBUG=false
APP_URL=https://preprod.asphapro-erp.fr

# Cache : on isole la preprod via un préfixe différent
CACHE_PREFIX=aspha_preprod_

# BDD preprod (créée à l'étape cPanel 3)
DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=<cpanel_user>_aspha_preprod
DB_USERNAME=<cpanel_user>_aspha_pp
DB_PASSWORD=<mdp_fort>

# MAILER preprod — STRATÉGIE IMPORTANTE :
# Pas de vrais mails depuis preprod (sinon tu spammes Adeline avec des
# notifs de test). On log dans storage/logs/laravel.log.
MAIL_MAILER=log

# Autres clés API : à garder identiques à la prod si tu veux pouvoir
# tester l'intégration réelle, OU mettre en mock/sandbox
# PENNYLANE_TOKEN=... (laisse vide si pas utilisé en preprod)
```

**Pour récupérer les valeurs sensibles de la prod** sans tout retaper :
```bash
grep -E '^(PENNYLANE_|SILAE_|GOOGLE_|EXPO_)' ~/aspha_pro/aspha_pro/backend/.env
```
…et copie-colle dans `.env` preprod si pertinent.

## Premier déploiement preprod

```bash
bash ~/aspha_pro_preprod/aspha_pro/deploy/o2switch-deploy.sh ~/aspha_pro_preprod
```

Ce script :
- Pull main
- composer install
- npm ci + build frontend
- Copie le build dans `backend/public/`
- Migrate (la BDD preprod est créée fresh)
- Seed
- Génère APP_KEY si vide
- Cache config / routes / views
- `chmod 775` storage

Test rapide :
```bash
curl -I https://preprod.asphapro-erp.fr/api/v1/ping
```

Tu dois voir `200 OK`.

## Configurer le cron Laravel preprod

Le scheduler Laravel doit aussi tourner en preprod pour les rappels badgeage,
notifications, etc. — sinon les workflows asynchrones ne sont pas testables.

cPanel → **Cron Jobs** → ajouter :

```
* * * * * /usr/local/bin/php $HOME/aspha_pro_preprod/aspha_pro/backend/artisan schedule:run >> /dev/null 2>&1
```

(adapte le PATH `/usr/local/bin/php` selon ton PHP cPanel — voir `which php`)

## Build mobile preprod (côté local Windows)

```powershell
cd "F:\Pro\BiDEv\Projet CRM aspha service\aspha_pro\mobile"
npx eas-cli build --profile preprod --platform android
```

`eas.json` profil **preprod** est configuré pour pointer sur
`https://preprod.asphapro-erp.fr/api/v1`. L'APK généré est distinct de la
prod : tu peux installer les 2 en parallèle sur ton tél (`fr.asphapro.mobile`
vs `fr.asphapro.mobile` — ils ont le même bundleId donc ils s'écrasent
mutuellement… si tu veux les avoir simultanément, change `android.package`
en `fr.asphapro.mobile.preprod` dans `app.json` côté build preprod).

## Workflow récurrent

1. **Développement** : push sur `main` depuis ton poste
2. **Preprod auto pull** :
   ```bash
   ssh <user>@ssh.o2switch.net
   bash ~/aspha_pro_preprod/aspha_pro/deploy/o2switch-deploy.sh ~/aspha_pro_preprod
   ```
3. **Test sur l'APK mobile preprod** + URL preprod web
4. **Validation OK ?**
5. **Promotion preprod → prod** :
   ```bash
   bash ~/aspha_pro/aspha_pro/deploy/promote-to-prod.sh
   ```
   Le script aligne la prod sur le **même commit** que ce qui tourne en
   preprod, backupe la DB prod, redéploie, et tag GitHub `release-YYYYMMDD-HHMM`.

## Rollback en cas de pb après promotion

Le script `promote-to-prod.sh` sauvegarde **le hash du commit prod avant
promotion** dans `~/backups/prod-rollback-<TS>.txt`. Pour rollback :

```bash
cd ~/aspha_pro
cat ~/backups/prod-rollback-<TS>.txt  # récupère le hash
git reset --hard <hash>
bash aspha_pro/deploy/o2switch-deploy.sh
```

Et pour rollback la DB :
```bash
gunzip < ~/backups/db-prod-<TS>.sql.gz | mysql -u<user> -p<pass> <db_name>
```

## FAQ

**Q: La preprod et la prod partagent la même BDD ?**
Non. Chaque a sa propre BDD MariaDB. Définies séparément dans cPanel.

**Q: Les fichiers uploadés (avatars, documents) sont partagés ?**
Non. Chaque instance a son propre `storage/app/public/`. Les avatars uploadés
en preprod n'existent pas en prod.

**Q: Le `.env` préprod est écrasé par les déploiements ?**
Non. `o2switch-deploy.sh` ne touche jamais `.env`. Seul `php artisan
key:generate` est lancé une seule fois si APP_KEY est vide. Les clés API
restent intactes à vie sauf si tu les modifies manuellement.

**Q: Combien de temps prend une promotion preprod → prod ?**
~3-5 min : ~30s git fetch, ~1min composer, ~2min npm build, ~30s migrate +
caches. Pendant ces 3-5 min, la prod sert encore l'ancien build (jusqu'à
l'étape rsync). Downtime visible : moins de 30s.

**Q: Comment je sais sur quel commit tourne la prod / la preprod ?**
```bash
cd ~/aspha_pro && git rev-parse --short HEAD          # prod
cd ~/aspha_pro_preprod && git rev-parse --short HEAD  # preprod
```
