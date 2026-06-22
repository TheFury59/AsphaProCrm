# Aspha Pro — Mise en ligne Google Play Store

Ce dossier contient tous les textes et briefs à coller dans Play Console
lors de la création de la fiche store.

---

## 1. Identité de l'app

| Champ Play Console | Valeur |
|---|---|
| **Nom de l'application** (max 30c) | `Aspha Pro` |
| **Description courte** (max 80c) | `L'app des intervenants et clients d'Aspha : planning, badgeage, devis.` |
| **Nom du package** | `fr.asphapro.mobile` |
| **Catégorie principale** | `Productivité` (Business si refusé) |
| **Tag de contenu** | `Tous publics` (PEGI 3) — aucune violence, achat, ni contenu adulte |
| **Site web** | `https://asphapro-erp.fr` |
| **E-mail de contact** | `contact@asphapro-erp.fr` |
| **Politique de confidentialité** | `https://asphapro-erp.fr/privacy.html` |

---

## 2. Description complète (FR — à coller tel quel, max 4000c)

```
Aspha Pro est l'application mobile officielle de l'ERP Aspha. Elle accompagne
au quotidien les intervenants sur le terrain et les clients professionnels
qui font appel aux services d'Aspha.

POUR LES INTERVENANTS
• Consultez votre planning du jour et des 7 jours suivants en un coup d'œil
• Visualisez chaque RDV en détail : adresse, client, prestations à réaliser,
  consignes spécifiques, accès au site
• Lancez l'itinéraire vers le lieu d'intervention dans votre application
  cartes habituelle
• Badgez votre arrivée et votre départ en scannant le QR code du site —
  preuve de présence horodatée et géolocalisée (avec votre accord)
• Recevez des notifications instantanées pour les nouveaux RDV, les
  modifications de planning ou les alertes urgentes
• Signalez un incident ou une difficulté directement depuis l'app
• Échangez avec votre encadrant via la messagerie intégrée
• Consultez vos documents (contrat, fiches de poste, attestations)
• Suivez le compteur d'heures effectuées dans la semaine et le mois

POUR LES CLIENTS
• Tableau de bord clair : prestations en cours, devis à valider, factures,
  demandes ouvertes
• Validez vos devis en un clic et téléchargez les PDF
• Suivez vos factures et leur statut de paiement
• Créez des demandes (réclamation, demande complémentaire, signalement)
  et suivez le fil d'échange avec votre interlocuteur
• Consultez l'historique des prestations effectuées sur vos sites
• Accédez à tous vos documents partagés par Aspha

SÉCURITÉ ET DONNÉES
• Connexion sécurisée par identifiants personnels (jamais d'accès sans
  authentification)
• Mot de passe stocké chiffré, jeton de session protégé dans le coffre-fort
  du système (Keystore Android)
• Communications chiffrées HTTPS de bout en bout
• Aucune donnée personnelle vendue, aucune publicité, aucun pistage
• Conforme RGPD — politique de confidentialité accessible à tout moment

PRÉREQUIS
Aspha Pro est un outil professionnel. Pour l'utiliser vous devez avoir un
compte créé par Aspha (intervenant salarié ou client de l'entreprise).
L'application n'est pas destinée au grand public et ne propose pas
d'inscription libre.

Vous êtes un professionnel intéressé par les services d'Aspha ?
Contactez-nous via asphapro-erp.fr
```

---

## 3. Screenshots — Checklist

### Formats requis par Play Console

| Type | Quantité | Format |
|---|---|---|
| Téléphone | **2 minimum, 8 max** | PNG ou JPEG, ratio 16:9 ou 9:16, **min 320 px**, **max 3840 px** côté le plus long. Recommandé : **1080×1920** (portrait) |
| Tablette 7" (optionnel) | 1-8 | idem, ratio + large |
| Tablette 10" (optionnel) | 1-8 | idem |
| **Feature graphic** (obligatoire) | 1 | **1024×500 PNG ou JPEG**, sans transparence, sans bord blanc |
| **Icône** (déjà fournie via app.json) | 1 | 512×512 PNG, fond opaque |

### Écrans à capturer dans l'ordre (priorité descendante)

À faire sur un téléphone réel ou émulateur Pixel 7 (1080×2400) en mode portrait :

1. **Login screen** — montre que c'est un outil professionnel, pas un app grand public
2. **Planning intervenant** — la vue la plus représentative : liste des RDV du jour avec couleurs de statut
3. **Détail d'un RDV** — adresse + bouton itinéraire + bouton « Lancer badgeage »
4. **Écran de badgeage QR** — viseur caméra centré
5. **Confirmation badgeage** — coche verte + horaire + GPS
6. **Tableau de bord client** — stats devis/factures/demandes
7. **Détail devis client** — bouton « Valider le devis »
8. **Centre de notifications** — liste alertes (nouveau RDV, document à renouveler, etc.)

### Captures — comment les prendre proprement

- **Sur Android** : ouvrir l'app en mode production (ou preprod avec données réelles), Volume bas + Power.
- **Sur émulateur** : `adb shell screencap -p /sdcard/screen.png && adb pull /sdcard/screen.png`
- **Effacer les infos sensibles** : utiliser des données de démo (clients fictifs). NE PAS capturer avec de vraies adresses client.
- **Cohérence visuelle** : même thème (clair), même device, même heure dans la barre status si possible.

### Feature graphic — brief

- Taille : **1024×500 px**
- Fond : dégradé vert→bleu Aspha (couleurs de la marque)
- À gauche : logo Aspha + texte « Aspha Pro » (32-48 px, blanc gras)
- À droite : mockup d'un téléphone affichant la vue planning
- Sous-titre court : « Le terrain au bout des doigts. »
- À générer dans Figma / Canva — pas de génération auto possible ici.

---

## 4. Data Safety form — Réponses pré-remplies

Le formulaire Data Safety est interactif dans Play Console. Réponses à donner section par section :

### Section 1 : Collecte de données

**Q : Votre app collecte-t-elle ou partage-t-elle des types de données utilisateur requis ?**
→ **OUI**

### Section 2 : Données collectées

Cocher EN COLLECTÉ (et expliquer dans chaque sous-question) :

| Catégorie | Type | Collecté ? | Partagé avec tiers ? | Optionnel ? | Finalité |
|---|---|---|---|---|---|
| **Infos personnelles** | Nom | ✅ | ❌ | Non (requis pour identification) | Fonctionnalité de l'app |
| **Infos personnelles** | E-mail | ✅ | ❌ | Non | Compte utilisateur, communication |
| **Infos personnelles** | Identifiants utilisateur (user ID) | ✅ | ❌ | Non | Authentification |
| **Localisation** | Position approximative | ✅ | ❌ | **Oui** (l'utilisateur peut refuser) | Fonctionnalité de l'app (preuve de présence sur site) |
| **Localisation** | Position précise | ✅ | ❌ | **Oui** | Idem |
| **Photos & vidéos** | Photos | ✅ | ❌ | **Oui** | Photo de profil utilisateur |
| **Activité in-app** | Interactions in-app | ✅ | ❌ | Non | Analytics opérationnels (RDV badgés, retards) |
| **Identifiants appareil ou autre** | Token push | ✅ | ❌ | Non | Notifications |

**Non collectés (à NE PAS cocher)** :
- Données financières (pas de paiement intégré)
- Santé et fitness
- Messages (SMS, e-mails) — non lus par l'app
- Audio
- Fichiers et documents (en dehors des PDF métier dématérialisés)
- Contacts du téléphone
- Historique d'apps
- Historique web ou de recherche

### Section 3 : Pratiques de sécurité

| Question | Réponse |
|---|---|
| Les données sont-elles chiffrées en transit ? | **OUI** (HTTPS / TLS 1.2+) |
| Les utilisateurs peuvent-ils demander la suppression de leurs données ? | **OUI** (par e-mail à contact@asphapro-erp.fr) |
| Vous suivez les Play Families Policy ? | **N/A** (app pas destinée aux enfants) |
| Données validées par un tiers indépendant ? | **NON** |

### Section 4 : Pratiques de partage

→ **NON, aucune donnée partagée avec des tiers à des fins de marketing/analytics tiers.**

(Expo, Google et Apple sont des *sous-traitants techniques* nécessaires au fonctionnement de l'app, pas des partenaires de partage de données.)

---

## 5. Content Rating (questionnaire IARC)

Réponses pour obtenir le rating **PEGI 3 / IARC 3+** (tout public) :

| Question | Réponse |
|---|---|
| Catégorie | **Productivité / Utilities** |
| Violence | Non |
| Sexualité | Non |
| Langage | Non |
| Substances contrôlées | Non |
| Jeux d'argent | Non |
| Achats intégrés | Non |
| Localisation partagée avec autres utilisateurs | Non (la position n'est lue que par l'admin Aspha) |
| Contenu généré par utilisateurs | Non (pas de forum, pas de profils publics) |
| UI permettant interactions sociales | Non (messagerie 1-to-1 avec l'encadrant uniquement) |

---

## 6. Target Audience and Content

| Champ | Valeur |
|---|---|
| Target age groups | **18+ uniquement** (outil professionnel) |
| Appeals to children ? | **NO** |
| Government, financial, gambling app ? | **NO** |
| News app ? | **NO** |

---

## 7. Ads

| Champ | Valeur |
|---|---|
| Does your app contain ads ? | **NO** |

---

## 8. Pricing & Distribution

| Champ | Valeur |
|---|---|
| Pricing | **Free** |
| Countries | **France** (à étendre plus tard si besoin) |
| Contains ads | **No** |
| In-app purchases | **No** |
| Eligible for Google Play for Education | **No** |

---

## 9. App Access (review accounts pour Google)

Google demande des identifiants de test pour reviewer ton app vu qu'elle nécessite un compte.

**Créer 2 comptes de démo sur preprod ou prod** :

```
Intervenant démo :
  Email : demo.intervenant@asphapro-erp.fr
  Mot de passe : DemoAspha2026!
  Rôle : intervenant (avec au moins 3 RDV programmés en démo)

Client démo :
  Email : demo.client@asphapro-erp.fr
  Mot de passe : DemoAspha2026!
  Rôle : client (avec 1 devis à valider + 2 factures)
```

→ À renseigner dans Play Console > **App access** > « All or some functionality is restricted »
→ Joindre cette note : « Login requis pour tester. Identifiants de démo fournis. Les données affichées sont fictives. »

---

## 10. Checklist finale avant submission

- [ ] AAB uploadé (depuis `eas build --platform android --profile production`)
- [ ] Description courte + longue collées
- [ ] 4 screenshots minimum + feature graphic 1024×500
- [ ] Privacy policy URL en ligne : https://asphapro-erp.fr/privacy.html
- [ ] Data Safety form complété
- [ ] Content Rating questionnaire passé → rating attribué
- [ ] Target audience : 18+
- [ ] Ads : No
- [ ] Pricing : Free, France
- [ ] App Access : comptes démo intervenant + client fournis
- [ ] Internal testing track validé sur 1-2 testeurs avant Production
- [ ] Promotion vers Production track
- [ ] Soumission → review Google (1 à 7 jours en moyenne)

---

## 11. Build EAS — Commande à lancer

Pré-requis :
- Tu es loggé EAS (`npx eas-cli whoami` doit afficher `himelys-team` ou ton compte)
- Tu es dans `aspha_pro/mobile/`

```bash
cd "F:/Pro/BiDEv/Projet CRM aspha service/aspha_pro/mobile"
npx eas-cli build --platform android --profile production
```

EAS va te demander :
1. **Generate a new Android Keystore ?** → **Yes** (EAS le génère et le garde en sécurité côté serveur — important : NE PAS le perdre, c'est la clé qui signe l'app pour le Play Store à vie)
2. Build lancé en cloud EAS (~15-25 min) → URL de suivi affichée
3. À la fin : **fichier .aab** téléchargeable depuis le dashboard EAS

Une fois l'AAB téléchargé :
- Aller sur https://play.google.com/console
- Créer une nouvelle app → coller les infos de la section 1
- Production track → Create release → Upload l'AAB
- Compléter toutes les sections (sidebar gauche) jusqu'à 100%
- Send for review

---

## 12. Mise à jour future (versioning)

Pour publier une mise à jour :

1. Modifier le code mobile
2. Le `versionCode` Android est **auto-incrémenté** par EAS (cf. `autoIncrement: true` dans `eas.json`)
3. Bumper `expo.version` dans `app.json` si version sémantique différente (ex: `0.1.0` → `0.2.0`)
4. `npx eas-cli build --platform android --profile production` → nouvel AAB
5. Play Console → Production → Create release → Upload nouveau AAB → Send for review

OTA updates (Expo Updates) pour les changements JS-only sans passer par la review Google :
```bash
npx eas-cli update --channel production --message "Description du fix"
```
Les utilisateurs reçoivent le nouveau JS au prochain ouverture de l'app, sans nouvel install.
