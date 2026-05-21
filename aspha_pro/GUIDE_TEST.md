# Aspha ERP — Guide de test (3 rôles)

> Application de test en ligne : **https://aspha-pro.onrender.com**
>
> ⚠️ Hébergement gratuit : si personne n'a utilisé l'app depuis 15 min, le
> premier chargement prend **30 à 60 secondes** (le serveur se réveille).
> Patiente, c'est normal. Ensuite tout est fluide.

---

## Ordre de test recommandé

Les 3 parcours s'enchaînent : **l'admin doit faire son parcours EN PREMIER**,
car c'est lui qui crée le client, l'intervenant et leurs accès extranet.
Une fois ses accès générés, les testeurs « client » et « intervenant »
peuvent se connecter.

| Rôle | Qui teste | Identifiants |
|---|---|---|
| **Admin** | Toi | `admin@aspha.local` / `admin1234` |
| **Client** | Collègue 1 | générés par l'admin à l'étape A-4 |
| **Intervenant** | Collègue 2 | générés par l'admin à l'étape A-6 |

---

# 🔵 PARCOURS 1 — ADMIN

Connecté avec `admin@aspha.local` / `admin1234`.

### A-1. Connexion & tableau de bord
- [ ] Se connecter → on arrive sur le **Tableau de bord**
- [ ] Vérifier les chiffres : clients actifs, intervenants, RDV à venir, RDV à pourvoir, factures impayées, CA du mois
- *Attendu : des chiffres réels (0 partout au début, c'est normal)*

### A-2. Catalogue de prestations
- [ ] Menu **Prestations** → la liste affiche **19 prestations** (nettoyage de bureaux, vitrerie, etc.)
- [ ] Cliquer **« Nouvelle prestation »** → taper un nom (ex. « Test nettoyage »)
- [ ] Vérifier que le **Code se génère tout seul** (ex. `TEST-NETTOYAGE`)
- [ ] Choisir un prix, une TVA → **Créer**
- *Attendu : la prestation apparaît dans la liste*

### A-3. Créer un client
- [ ] Menu **Clients** → bouton **« Nouveau client »**
- [ ] Vérifier : **pas de champ « Code »** (généré auto), **« Entité »** pré-remplie (« Aspha Service — Siège »)
- [ ] Remplir Raison sociale (ex. « Société Test SAS »), SIRET, email → **Créer**
- [ ] Ouvrir la fiche du client créé → vérifier le code auto `CLI-000X`
- *Attendu : fiche client avec onglets (Général, Contacts, Adresses, Missions, Devis & factures…)*

### A-4. Créer l'accès extranet du client ⭐
- [ ] Sur la fiche client, onglet **Général** → carte **« Accès portail »**
- [ ] Renseigner un email → **Créer l'accès**
- [ ] **📝 NOTER l'email + le mot de passe affichés** → à donner au testeur « client »

### A-5. Créer un intervenant
- [ ] Menu **Intervenants** → **« Nouvel intervenant »**
- [ ] Vérifier « Entité » pré-remplie → remplir nom, prénom → **Créer**
- [ ] Ouvrir la fiche → onglet **Contrat** → créer un contrat (durée hebdo, poste…)
- *Attendu : fiche intervenant complète*

### A-6. Créer l'accès extranet de l'intervenant ⭐
- [ ] Sur la fiche intervenant → carte **« Accès portail »** → **Créer l'accès**
- [ ] **📝 NOTER l'email + le mot de passe** → à donner au testeur « intervenant »

### A-7. Créer une mission avec prestations
- [ ] Fiche client → onglet **Missions** → **« Nouvelle mission »**
- [ ] Nommer la mission, choisir le rythme de facturation
- [ ] **Ajouter une prestation** depuis le catalogue → vérifier que le **prix est verrouillé** sur le tarif catalogue
- [ ] Cocher **« Prix personnalisé »** → le prix devient modifiable
- [ ] Passer la prestation en **« Récurrente »** → définir fréquence (hebdo), jour, horaires
- [ ] Cliquer **« Assigner un intervenant »** → une **carte** s'ouvre avec les intervenants proches/dispos → en choisir un
- [ ] Ajouter un **produit du stock** dans la zone « Produits / consommables »
- [ ] **« Tout enregistrer »**
- *Attendu : message de confirmation « Mission enregistrée · X récurrence(s) synchronisée(s) »*

### A-8. Vérifier le planning
- [ ] Menu **Planning** → filtrer sur le client
- [ ] *Attendu : les **RDV récurrents** de la mission apparaissent, à la **bonne heure** (celle choisie en A-7)*
- [ ] Clic droit sur un créneau vide → créer une intervention ponctuelle
- [ ] Glisser-déposer un RDV pour le déplacer

### A-9. Modifier la mission
- [ ] Onglet Missions → **« Modifier »** sur la mission créée
- [ ] Changer une info, modifier une prestation → **« Tout enregistrer »**
- *Attendu : les modifications sont bien sauvegardées (recharger pour vérifier)*

### A-10. Créer et envoyer un devis
- [ ] Menu **Devis** → **« Nouveau devis »**
- [ ] Choisir le client → ajouter des lignes : **prestation du catalogue**, **ligne libre**, **produit du stock**
- [ ] **Créer le devis** → l'ouvrir → le passer au statut **« Envoyé »**
- *Attendu : le client reçoit une notification (vérifiable au parcours 2)*
- [ ] Tester le bouton **« Télécharger PDF »** → un devis PDF au format Aspha s'ouvre

### A-11. Après validation du devis par le client
*(à faire APRÈS que le testeur client ait validé le devis — parcours 2, étape C-4)*
- [ ] Cliquer la **notification 🔔 « Devis validé »** → ouvre la fiche devis
- [ ] Bouton **« Créer la mission »** → la mission est générée depuis le devis et s'ouvre en édition

### A-12. Factures & règlements
- [ ] Menu **Factures** → créer une facture → **« Télécharger PDF »**
- [ ] Menu **Règlements** → enregistrer un paiement

### A-13. Notifications & messagerie
- [ ] Cliquer la **cloche 🔔** en haut → vérifier les notifications (devis validé, ticket, etc.)
- [ ] Menu **Messagerie** → créer une conversation, envoyer un message

---

# 🟢 PARCOURS 2 — CLIENT (extranet)

Connecté avec les identifiants notés à l'étape **A-4**.

### C-1. Connexion
- [ ] Se connecter → on arrive directement sur **l'extranet client** (vue limitée à ses données)

### C-2. Notification de devis
- [ ] Cliquer la **cloche 🔔** → une notification **« Devis à valider »** est présente

### C-3. Consulter le devis
- [ ] Aller dans la section **Devis** → la liste des devis avec leur statut
- [ ] Ouvrir le devis « Envoyé » → voir le détail des lignes + total
- [ ] **Télécharger le PDF**

### C-4. Valider le devis ⭐
- [ ] Cliquer **« Valider le devis »**
- *Attendu : le devis passe en « Validé », et l'admin reçoit une notification (parcours 1, étape A-11)*

### C-5. Factures
- [ ] Section **Factures** → consulter ses factures, télécharger un PDF

### C-6. Créer une réclamation / ticket
- [ ] Section **Demandes / Tickets** → créer une réclamation ou un signalement
- *Attendu : l'admin reçoit une notification du nouveau ticket*

### C-7. Messagerie & notifications
- [ ] Vérifier la **cloche 🔔**
- [ ] **Messagerie** → échanger un message avec l'équipe

> 🔒 Test de sécurité (optionnel) : le client ne doit voir **que ses propres**
> devis, factures et données — jamais celles d'un autre client.

---

# 🟠 PARCOURS 3 — INTERVENANT (extranet)

Connecté avec les identifiants notés à l'étape **A-6**.

### I-1. Connexion & page d'accueil
- [ ] Se connecter → la page d'accueil affiche directement **le planning**
- [ ] Vérifier que les **2 blocs** (Remplissage contrat + Trajets) sont **sur le côté droit**
- *Attendu : l'intervenant voit uniquement SON planning*

### I-2. Consulter son planning
- [ ] Naviguer entre les semaines, changer de vue (Jour / Semaine / Mois)
- [ ] Si des RDV lui ont été assignés (étape A-7) → ils apparaissent
- [ ] Survoler un RDV → infobulle avec les détails

### I-3. Mon profil
- [ ] Menu **« Mon profil »** → voir ses infos, son contrat, le lien Silae

### I-4. Créer un signalement
- [ ] Menu **Signalements** → créer un signalement (problème chez un client)
- *Attendu : l'admin reçoit une notification*

### I-5. Messagerie & notifications
- [ ] Vérifier la **cloche 🔔**
- [ ] **Messagerie** → échanger un message avec l'équipe

> 🔒 Test de sécurité (optionnel) : l'intervenant ne doit voir **que son
> propre** planning et ses données — jamais ceux d'un collègue.

---

## 🐞 Comment remonter un bug

Pour chaque problème rencontré, noter :
1. **Le rôle** (admin / client / intervenant) et **l'étape** (ex. A-7)
2. **Ce qui était attendu** vs **ce qui s'est passé**
3. Une **capture d'écran** si possible
4. L'**heure** approximative (pour retrouver dans les logs)
