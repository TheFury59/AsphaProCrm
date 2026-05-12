# 🔌 Aspha Pro — Intégrations externes & étapes additionnelles

Ce document liste **tout ce qui n'est pas codé** dans le repo mais qui doit être mis en place pour exploiter le CRM en production : comptes externes à créer, clés API à obtenir, contrats à signer, hardware à acheter, apps mobile à publier.

Statut conventions :
- 🟢 **Prêt** : code en place, juste à connecter
- 🟡 **À acheter / configurer** : un compte ou matériel à créer
- 🔴 **À développer** : nécessite encore du code (typiquement une app mobile)

---

## 1. Comptes & API externes

### 1.1 Pennylane (comptabilité) 🟢
- **Pourquoi** : sync auto des devis et factures vers la compta.
- **Ce qui est codé** : `PennylaneSyncService` + endpoints `/quotes/{id}/sync-pennylane` et `/invoices/{id}/sync-pennylane`. Mode mock activé si la clé est absente (`pennylane_id` rempli avec `pl-mock-XXX`).
- **À faire** :
  1. Souscrire un compte Pennylane Pro (≈ 30 €/mois selon le forfait)
  2. Demander la clé API à Pennylane (Pennylane → Paramètres → API)
  3. Mettre dans `backend/.env` :
     ```
     PENNYLANE_API_KEY=ply_xxxxxxx
     PENNYLANE_API_URL=https://app.pennylane.com/api/external/v1
     ```
  4. Vérifier en cliquant le bouton "cloud" sur une facture : doit retourner un vrai `pennylane_id`.

### 1.2 Géocodage BAN.gouv.fr 🟢
- **Pourquoi** : remplir `latitude/longitude` automatiquement sur les adresses (pour la carte et le matching).
- **Ce qui est codé** : `GeocodingService` + observer sur `Address` (auto-trigger à la sauvegarde).
- **À faire** : **rien** — l'API BAN est publique, gratuite, sans clé, limite 50 req/sec/IP.
- **Limite** : ne marche qu'en France métropolitaine. Pour l'international : passer à Nominatim (OSM) ou Photon.

### 1.3 Factur-X / Chorus Pro 🟢 (privé) / 🟡 (B2G)
- **Pourquoi** : conformité légale au 1er septembre 2026 (réforme facturation électronique).
- **Ce qui est codé** : `FacturXGenerator` produit le PDF/A-3 EN16931 conforme, endpoint `/invoices/{id}/facturx`.
- **À faire pour le B2B privé** : rien — le client peut télécharger le PDF lui-même.
- **À faire pour le B2G (administrations)** :
  1. Créer un compte sur **Chorus Pro** (chorus-pro.gouv.fr) pour la société Aspha
  2. Obtenir un certificat technique (TLS)
  3. Implémenter le push automatique (à coder) : endpoint Chorus Pro `POST /factures`
- **À faire pour le B2B via PDP** (Plateformes de Dématérialisation Partenaires) :
  - À partir de fin 2026, toutes les factures B2B doivent transiter via une PDP agréée
  - Sélectionner une PDP (Pennylane sera PDP, ou Iopole, Docaposte, Sage, etc.)
  - Le push se fait alors via l'API de la PDP

### 1.4 Push notifications mobiles (FCM) 🟡
- **Pourquoi** : notifier l'app mobile intervenant (Phase 8).
- **Ce qui est codé** : `SendPushNotificationJob` prêt à appeler FCM. Mode mock si clé absente.
- **À faire** :
  1. Créer un projet Firebase sur https://console.firebase.google.com
  2. Activer Cloud Messaging (gratuit)
  3. Récupérer la "Server key" dans Project Settings → Cloud Messaging
  4. Mettre dans `.env` :
     ```
     FCM_SERVER_KEY=AAAAxxxxxx:APA91bxxxxxxxx
     ```
  5. **Côté app mobile** : intégrer Firebase SDK, récupérer le device token et l'envoyer à un endpoint `/me/push-device` (**endpoint à coder**, pas encore fait).
  6. **Table `push_devices` à créer** (user_id, token, platform, last_seen).

### 1.5 Email (SMTP / Mailgun / SendGrid) 🟡
- **Pourquoi** : canal email du dispatcher de notifications.
- **Ce qui est codé** : `SendEmailNotificationJob` utilise `Mail::raw`. Driver pilotable par `.env`.
- **À faire** : choisir un provider et configurer `.env` :
  ```
  MAIL_MAILER=smtp
  MAIL_HOST=smtp.mailgun.org
  MAIL_PORT=587
  MAIL_USERNAME=postmaster@mg.aspha.fr
  MAIL_PASSWORD=xxx
  MAIL_ENCRYPTION=tls
  MAIL_FROM_ADDRESS=noreply@aspha.fr
  MAIL_FROM_NAME="Aspha Pro"
  ```
- **Recommandation** : Mailgun (5000 emails gratuits/mois) ou Postmark (paye à l'usage, excellent deliverability).

### 1.6 SMS (Twilio ou OVH) 🟡
- **Pourquoi** : canal SMS du dispatcher (urgences, retards de badgeage, etc.).
- **Ce qui est codé** : `SendSmsNotificationJob` avec drivers `twilio | ovh | mock`.
- **À faire — Twilio** :
  1. Compte sur twilio.com (env. 0,075 €/SMS France)
  2. Acheter un numéro France (≈ 1 €/mois)
  3. `.env` :
     ```
     SMS_DRIVER=twilio
     TWILIO_ACCOUNT_SID=ACxxxxxx
     TWILIO_AUTH_TOKEN=xxxxxx
     TWILIO_FROM=+33756123456
     ```
- **À faire — OVH SMS** (alternative française moins chère ~0,047 €/SMS) :
  - Le driver OVH est stubé, **à implémenter** dans `SendSmsNotificationJob::sendViaOvh()`.
  - OVH utilise une authentification signée (timestamp + signature SHA1), pas du Basic Auth.

### 1.7 Signature électronique (Yousign / DocuSign) 🟡
- **Pourquoi** : valeur juridique eIDAS pour les contrats clients, devis signés en ligne.
- **Ce qui est codé** : module signatures dans `ClientPortalController` (request + sign via token public) — **mais c'est une signature applicative sans valeur juridique forte**.
- **À faire** : intégrer Yousign API (~0,90 €/signature simple, ~3 €/signature avancée eIDAS) :
  1. Compte sur yousign.com
  2. Clé API + sandbox d'abord
  3. Remplacer la logique de `sign()` par un appel Yousign create-signature-request
  4. Webhook Yousign → callback Aspha qui marque le doc comme signé

### 1.8 Prélèvement SEPA 🔴
- **Pourquoi** : automatiser les paiements récurrents clients (mandat + ordres mensuels).
- **Ce qui est codé** : **rien**. Tables `sepa_mandates` et `sepa_orders` à créer.
- **À faire** :
  1. Demander à la banque le contrat ICS (Identifiant Créancier SEPA) — démarche bancaire
  2. Coder la génération XML `pain.001` (ordres) et `pacs.008` (mandats)
  3. Upload des fichiers XML dans l'interface bancaire (ou via API si la banque en propose une — peu courant en France hors Qonto/Shine)

---

## 2. Hardware

### 2.1 QR codes physiques (télégestion sur place) 🟡
- **Pourquoi** : Phase 4 télégestion — badgeage in/out par scan QR à l'arrivée chez le client.
- **Ce qui est codé** : génération du code QR côté backend (`POST /telemanagement/qr-codes`), badgeage via app.
- **À acheter / faire imprimer** :
  - **Étiquettes autocollantes plastifiées** (15×15 cm, environ 1-2 €/étiquette en commande groupée chez Vistaprint / Onlineprinters)
  - 1 QR par adresse client
  - Lien embarqué : URL de l'app mobile avec deep-link `aspha://badge?code=XXXX` (à coder dans l'app)
  - Apposer à l'entrée du domicile (autorisation client à obtenir)

### 2.2 Badges NFC (alternative aux QR) 🟡 (optionnel)
- **Pourquoi** : alternative plus rapide au QR (juste poser le téléphone).
- **À acheter** : tags NFC programmables NTAG215 (≈ 0,30 €/tag en gros).
- **À faire** : programmer chaque tag avec une URL `aspha://badge?nfc=XXXX` via app Android (NFC Tools, gratuite).
- **À coder dans l'app mobile** : handler du NFC URI intent.

### 2.3 Téléphones intervenants 🟡
- **Pourquoi** : usage de l'app mobile (badgeage, planning, messages).
- **Recommandation** : laisser BYOD (Bring Your Own Device) avec règle CSE/CSSCT.
- **Si flotte fournie** : tablette 8" Android 4G entrée de gamme (Lenovo M8 ≈ 130 €) ou téléphone Android Galaxy A15 ≈ 180 €.

### 2.4 Imprimante factures 🟡 (optionnel)
- Sauf cas particulier, les factures sont en PDF (Factur-X). Pas besoin d'imprimante physique.

---

## 3. App mobile intervenant 🔴

**État** : **non développée**. C'est l'élément qui manque le plus pour exploiter pleinement la télégestion + matching + messagerie + notifications push.

### 3.1 Périmètre minimal V1
- Login Sanctum
- Planning du jour / semaine (lecture seule)
- Badgeage in/out (scan QR de l'adresse)
- Messages reçus + envoi
- Notifications push (reçoit les pushes FCM, ouvre l'app au bon écran)

### 3.2 Stack recommandée
- **React Native + Expo** (cohérent avec la stack React du front, single codebase iOS+Android).
- Alternative : Flutter (perf un peu meilleure, mais autre stack).
- Backend déjà compatible : API REST V1 + Sanctum (le mobile utilisera un Personal Access Token au lieu du cookie SPA).

### 3.3 À coder côté API
- **Endpoint `/auth/mobile-login`** : variant qui renvoie un Personal Access Token (au lieu du cookie SPA).
- **Endpoint `/me/push-devices`** : enregistrer le device FCM token.
- **Table `push_devices`** : user_id, fcm_token, platform (ios/android), app_version, last_seen.

### 3.4 Publication
- Compte Apple Developer : 99 $/an
- Compte Google Play : 25 $ one-shot
- Build via Expo EAS ~5 $/build ou gratuit en self-host
- Délai de review : 1–3 jours iOS, 1 jour Android

---

## 4. Hébergement & production

### 4.1 Migration SQLite → MariaDB 🟡
- **Actuel** : SQLite (fichier local, OK pour dev seulement).
- **À faire** :
  1. Provisionner la BDD MariaDB chez o2switch (incluse dans l'offre cPanel)
  2. Adapter `.env` : `DB_CONNECTION=mysql`, `DB_HOST`, `DB_DATABASE`, etc.
  3. Lancer `php artisan migrate --force` puis re-seeder
  4. **Vérifier** : SQLite est laxiste sur les contraintes / les dates, MariaDB beaucoup moins. Tester en E2E.

### 4.2 Domaine + SSL 🟡
- Acheter `aspha.fr` (~10 €/an) si pas déjà fait
- Configurer DNS chez o2switch
- SSL Let's Encrypt automatique chez o2switch

### 4.3 CORS strict (prod) 🟡
- **Actuel** : `allowed_origins_patterns: ['/.*/']` (tout autorisé pour dev).
- **À faire** : remplacer par les domaines réels :
  ```php
  'allowed_origins' => ['https://app.aspha.fr', 'https://crm.aspha.fr'],
  ```

### 4.4 Queue worker 🟡
- **Pourquoi** : les jobs `SendPushNotificationJob`, `SendEmailNotificationJob`, `SendSmsNotificationJob` tournent sur la queue.
- **Actuel** : `QUEUE_CONNECTION=sync` (tout est synchrone, bloque les requêtes HTTP).
- **À faire en prod** :
  1. `QUEUE_CONNECTION=database` ou `redis`
  2. Lancer un worker permanent : `php artisan queue:work --tries=3 --sleep=3`
  3. Sous o2switch / cPanel : configurer un cron qui relance le worker s'il meurt, ou utiliser Supervisor.
  4. Alternative serverless : Laravel Vapor (AWS Lambda).

### 4.5 Sentry / monitoring 🟡
- Compte sur sentry.io (gratuit jusqu'à 5k events/mois)
- `composer require sentry/sentry-laravel`
- Mettre `SENTRY_LARAVEL_DSN` dans `.env`
- Côté frontend : `@sentry/react` avec le même DSN

### 4.6 Backups BDD 🟡
- **Recommandation** : `spatie/laravel-backup` → backup quotidien zip vers S3 ou Dropbox
- ou solution o2switch native (cron + mysqldump + rsync vers second serveur)

---

## 5. Conformité légale & RGPD

### 5.1 DPA + registre RGPD 🟡
- Réaliser un registre des traitements (CNIL fournit un modèle)
- Signer un DPA (Data Processing Agreement) avec :
  - o2switch (hébergeur — DPA standard à demander)
  - Pennylane, Mailgun/Twilio si activés
- Publier une politique de confidentialité sur le site (`/privacy`)
- Bouton "exporter mes données" + "supprimer mon compte" côté portail client (**à coder**)

### 5.2 Conservation Factur-X (10 ans) 🟡
- Stocker tous les PDF Factur-X générés
- **À faire** : créer un job mensuel qui zippe + upload vers un stockage à valeur probante (Box, Tessi…)

### 5.3 Mentions légales 🟡
- Faire un onglet "Mentions légales" listant :
  - Société Aspha (SIRET, capital, RCS)
  - Hébergeur (o2switch)
  - DPO

---

## 6. Phases / fonctionnalités encore à coder

| Item | Phase | Effort | Bloquant prod ? |
|------|-------|--------|-----------------|
| App mobile intervenant | — | 4-6 semaines | Oui pour télégestion réelle |
| Push device token endpoint | 8 | 1 jour | Oui pour push |
| Push devices table + model | 8 | 1 jour | Oui pour push |
| OVH SMS driver complet | 8 | 1 jour | Non (Twilio fait le job) |
| SEPA génération XML | — | 1 semaine | Non |
| Tests E2E Playwright | — | 1 semaine | Non |
| Compétences requises ↔ produits (mapping) | 10 | 2 jours | Améliore le matching |
| Onglets "Réclamations/Réassorts" en sidebar du portail intervenant | — | 1 jour | Non |
| Notifs push automatiques (intervention assignée, alerte stock) | 8 | 2 jours | Non (mais important) |
| Calendrier des entretiens prévus (vue calendaire flotte) | 9 | 2 jours | Non |
| Géocodage en bulk pour les adresses existantes | — | 1 jour | Non (les nouvelles le sont auto) |

---

## 7. Coûts mensuels estimés (production)

| Poste | Coût | Notes |
|-------|------|-------|
| Hébergement o2switch | 7 €/mois | offre Cloud |
| Domaine | 1 €/mois | aspha.fr |
| Pennylane | 30 €/mois | Pro |
| Mailgun | 0 €/mois | 5k emails inclus |
| Twilio SMS | ~15 €/mois | 200 SMS estimés |
| Firebase FCM | 0 €/mois | gratuit illimité |
| Sentry | 0 €/mois | tier gratuit |
| **Total** | **~55 €/mois** | hors signatures électroniques |

Yousign à l'usage : 0,90 €/signature simple. À calibrer selon volume.

---

## 8. Checklist avant la mise en prod

- [ ] Migration BDD vers MariaDB testée
- [ ] CORS strict configuré
- [ ] Queue worker tourne (cron / supervisor)
- [ ] Backups quotidiens en place
- [ ] Pennylane connectée (clé réelle)
- [ ] Mailgun ou équivalent configuré
- [ ] Twilio configuré si SMS attendus
- [ ] Firebase + app mobile publiées (ou plan : "mobile en v2")
- [ ] Sentry connecté côté front + back
- [ ] Politique RGPD publiée
- [ ] DPA signés avec sous-traitants
- [ ] Test E2E manuel : créer client → planifier → badger → facturer → encaisser
- [ ] Formation utilisateurs Aspha (2h)
