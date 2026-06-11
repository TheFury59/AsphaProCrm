# Commandes de déploiement Aspha Pro

Référence rapide des commandes one-liner pour déployer en preprod et promouvoir en prod sur o2switch.

## Pré-requis

- Compte cPanel o2switch sur `ssh.o2switch.net`
- Apps Node.js cPanel créées :
  - **Prod** : Application root `aspha_pro/aspha_pro/frontend`, Application mode = **Development** (pas Production — sinon devDeps absents, build vite plante)
  - **Preprod** : Application root `aspha_pro_preprod/aspha_pro/frontend`, Application mode = **Development**
- Sous-domaine `preprod.asphapro-erp.fr` créé + SSL Let's Encrypt
- BDD preprod isolée : `jabi3423_aspha_preprod`
- `.env` preprod indépendant avec `MAIL_MAILER=log` (pas de vrais emails depuis preprod)

## 1. Déploiement preprod

```bash
ssh jabi3423@ssh.o2switch.net
```

```bash
cd ~/aspha_pro_preprod && git pull origin main && source ~/nodevenv/aspha_pro_preprod/aspha_pro/frontend/20/bin/activate && cd aspha_pro/frontend && NODE_ENV=development npm run build && cd ~/aspha_pro_preprod/aspha_pro && rsync -av --exclude=".htaccess" --exclude="index.php" frontend/dist/ backend/public/ && cd backend && php artisan migrate --force && php artisan config:cache && php artisan route:cache && php artisan view:cache && curl -I https://preprod.asphapro-erp.fr/api/v1/ping && echo "✅ PREPROD DEPLOY OK"
```

**Si erreur `npm : commande introuvable`** : le venv Node n'est pas activé. Lance avant :
```bash
source ~/nodevenv/aspha_pro_preprod/aspha_pro/frontend/20/bin/activate
```

**Si erreur Cloudlinux `node_modules doit être un symlink`** :
1. `rm -rf ~/aspha_pro_preprod/aspha_pro/frontend/node_modules`
2. cPanel → Setup Node.js App → app preprod → bouton **Run NPM Install**
3. Relancer la commande

**Si build échoue avec `@vitejs/plugin-react` introuvable** : l'app Node cPanel est en mode Production (devDeps exclus). Change le mode en **Development** dans cPanel → Re-run NPM Install → relancer.

## 2. Promotion preprod → prod

```bash
ssh jabi3423@ssh.o2switch.net
```

```bash
cd ~/aspha_pro && git pull origin main && source ~/nodevenv/aspha_pro/aspha_pro/frontend/20/bin/activate && cd aspha_pro/frontend && NODE_ENV=development npm run build && cd ~/aspha_pro/aspha_pro && rsync -av --exclude=".htaccess" --exclude="index.php" frontend/dist/ backend/public/ && cd backend && php artisan migrate --force && php artisan config:cache && php artisan route:cache && php artisan view:cache && curl -I https://asphapro-erp.fr/api/v1/ping && echo "✅ PROD DEPLOY OK"
```

**Variante avec backup auto + tag GitHub** : utiliser le script dédié
```bash
bash ~/aspha_pro/aspha_pro/deploy/promote-to-prod.sh
```
Mais ce script appelle `o2switch-deploy.sh` qui ne propage pas le venv Node → préférer la commande one-liner ci-dessus pour l'instant.

## 3. Rollback prod en cas de pb

Le hash du dernier commit prod est sauvegardé par `promote-to-prod.sh` dans `~/backups/prod-rollback-<timestamp>.txt`. Pour rollback :
```bash
cat ~/backups/prod-rollback-<TS>.txt  # te donne le hash
cd ~/aspha_pro
git reset --hard <hash>
# Puis re-déployer
```

Et pour rollback la BDD prod (snapshot pris automatiquement par `promote-to-prod.sh`) :
```bash
gunzip < ~/backups/db-prod-<TS>.sql.gz | mysql -u jabi3423_aspha_app -p<mdp> jabi3423_aspha_pro
```

## 4. Données de test preprod (idempotent)

Pour repeupler la preprod avec des clients/intervenants/RDV/devis/factures fictifs :
```bash
cd ~/aspha_pro_preprod/aspha_pro/backend
php artisan db:seed --class=PreprodTestDataSeeder --force
```

Le seeder a un guard `abort_if` qui l'empêche de tourner en prod. Re-runnable sans doublons.

## 5. Comptes de test preprod

| Email | Mot de passe | Rôle |
|---|---|---|
| `atelier.textil@aspha-test.local` | `Preprod2026!` | client |
| `boulangerie.centre@aspha-test.local` | `Preprod2026!` | client |
| `cabinet.saint-roch@aspha-test.local` | `Preprod2026!` | client |
| `adeline.muret@aspha-test.local` | `Preprod2026!` | intervenant |
| `mehdi.lambert@aspha-test.local` | `Preprod2026!` | intervenant |

Plus un compte super_admin créé via tinker sur la preprod (à toi de le set up si tu n'en as pas encore).

## 6. Builds APK mobile

Les profils EAS sont définis dans `mobile/eas.json`. Chaque profil a son URL API en `env.EXPO_PUBLIC_API_URL`.

### APK preprod (pointe sur preprod.asphapro-erp.fr)
```powershell
cd "F:\Pro\BiDEv\Projet CRM aspha service\aspha_pro\mobile"
npx eas-cli build --profile preprod --platform android
```

### APK prod (pointe sur asphapro-erp.fr)
```powershell
cd "F:\Pro\BiDEv\Projet CRM aspha service\aspha_pro\mobile"
npx eas-cli build --profile preview --platform android
```

### AAB prod (pour Google Play Store, plus tard)
```powershell
cd "F:\Pro\BiDEv\Projet CRM aspha service\aspha_pro\mobile"
npx eas-cli build --profile production --platform android
```

## Pièges connus (à ne pas refaire)

- ❌ `npm ci` plante si le lock n'est pas à jour (qrcode.react manquant dans le lock même si dans package.json) → utilise `npm install --legacy-peer-deps`
- ❌ cPanel "Run NPM Install" en mode Production omet les devDeps → build vite plante sur `@vitejs/plugin-react` introuvable
- ❌ Cloudlinux NodeJS Selector refuse un `node_modules` réel à la racine de l'app Node — doit être un symlink vers le venv
- ❌ Le script `o2switch-deploy.sh` lancé sans venv actif planted sur `npm : commande introuvable`
- ❌ L'erreur post-install cPanel "500 Internal Server Error" est non-bloquante (juste la vérif URL Node)

Voir aussi `aspha_pro/deploy/SETUP_PREPROD.md` pour le setup initial de l'environnement preprod.
