# Aspha Pro — Todo

## 📂 2026-05-22 — H : Refonte système Documents (LIVRÉ)

### A. Schéma
- [x] Migration `2026_05_22_150000_add_audience_expiry_and_softdeletes_to_documents`
      — `audience`, `expiry_date`, `softDeletes` (corrige le bug deleted_at)
- [x] Model `Document` : fillable + cast `expiry_date` en `date:Y-m-d`

### B. Backend
- [x] `DocumentController::store` — audience required + expiry_date + is_client_visible
- [x] `DocumentController::index`/`download` — filtre d'accès UNIQUE et cohérent
- [x] Relations `documents()` morphMany sur Employee + Client
- [x] `RequiredDocumentType::checklist` — `$d->document_type` (bug `category` corrigé)
- [x] `serialize()` expose `audience` + `expiry_date`

### C. Frontend DocumentsTab
- [x] Onglets par audience Client/Intervenant/Encadrement
- [x] Dialogue : sélecteur destinataire + champ date expiration
- [x] Date expiration + couleur dépassée/proche + coche verte

### D. Extranet
- [x] Composant `ExtranetDocumentsSection` monté sur ClientHome + IntervenantProfil

### E. Notifications
- [x] Type `document_renewal` (module documents) dans seeder
- [x] Commande `NotifyDocumentRenewals` + anti-spam 7j + schedule quotidien 07:30
- [x] `document` ajouté à la morph map (target des notifs)

### Review
- `php -l` : 0 erreur sur les 10 fichiers PHP touchés.
- `tsc --noEmit` : 24 erreurs = baseline (0 sur mes fichiers).
- Migration NON appliquée (à lancer manuellement). Pas de commit.
- Contrôle d'accès : prédicat unique `extranetAudienceForUser()` ; `index`
  applique le filtre Eloquent, `download` le même prédicat sur 1 document.

---

## 🌟 2026-05-22 — I : Système de notation des intervenants (LIVRÉ)

### A. Levier « faute » sur les tickets
- [x] Migration `2026_05_22_160000_add_fault_employee_to_client_requests`
      — `fault_employee_id` (FK nullable nullOnDelete) + `fault_comment` (text)
- [x] Model `ClientRequest` : fillable + relation `faultEmployee()`
- [x] `ClientRequestController::update` étendu (accepte `fault_employee_id`
      nullable + `fault_comment`) ; retirer la faute purge le commentaire

### B. Service de calcul
- [x] `EmployeeScoringService::computeScore()` — note 0-100 sur 4 critères
      (absences, assiduité, badgeage, relation) + détails lisibles

### C. Endpoint
- [x] `GET /employees/{employee}/score` (permission `employees.view`)

### D. Frontend fiche intervenant
- [x] Onglet « Notation » + hook `useEmployeeScore` + `EmployeeScoreTab`

### E. Frontend désignation de la faute
- [x] `FaultCard` dans `TicketDetailPage` + hook `useSetTicketFault`

### Review
- Formules : chaque critère part de 100 et retranche. Pondération globale
  25 % chacun (neutre, explicable). badgeage = % RDV passés badgés ;
  assiduité = 100 − 2 pts/min de retard moyen ; absences = −25 (non
  justifiée) / −8 (justifiée) par absence ; relation = −20 par ticket fautif.
  Cas « aucune donnée » → note neutre 100 (assiduité/badgeage sans data).
- `php -l` : 0 erreur (6 fichiers). `tsc --noEmit` : 23 erreurs = baseline,
  0 sur mes fichiers. Migration NON appliquée (pretend-run validé). Pas de commit.

---

## 📋 2026-05-22 — Plan post-RDV cliente (EN ATTENTE DE VALIDATION)

> Analyse via 7 sous-agents d'exploration parallèles. **Ne rien implémenter avant accord du client.**
> Risque : 🟢 faible · 🟡 moyen · 🔴 gros chantier / zone sensible.

### LOT 1 — Rapides, faible risque
- [x] **A1** 🟢 Login : reformuler texte B2C → B2B (`LoginPage.tsx` l.69, l.75-77)
- [x] **B2** 🟢 Supprimer la carte « Contacts liés » (`ClientContactsTab.tsx`)
- [x] **B3** 🟢 « Contacts entreprise » : champ NOM obligatoire (migration `client_contacts.name`)
- [x] **B5** 🟢 Contrat intervenant : retirer « Pendant intervention (€/km) »
- [x] **C1** 🟢 Prestations : retirer le sélecteur de catégorie
- [x] **C2** 🟢 Prestations : retirer le champ « Coût »
- [x] **C3** 🟢 TVA : désactiver 10/5,5/0 %, ne garder que 20 %
- [x] **C5** ✅ Produit stock prix de vente : DÉJÀ optionnel — rien à faire
- [x] **C6** 🟢 Produit stock : retirer le champ « Entité ID » (auto)
- [x] **D4** 🟢 Suivi de clés : corriger le bug d'horaire (timezone)

### LOT 2 — Moyens ✅ TERMINÉ (commits 512fa6f, 250f8d7)
- [x] **A2** 🟡 Forcer changement de mot de passe à la 1re connexion
- [x] **B1** 🟡 Entité « Aspha Service » → « Aspha Pro » à Douai
- [x] **B6+F2** 🟡 Champ « consignes intervenants » fiche client + note interne visible intervenant
- [x] **C4** 🟡 Durée standard : du catalogue → ligne de devis/mission
- [x] **D1** 🟡 Multi-adresse dans la création de RDV ponctuel
- [x] **D2** 🟡 Statuts + couleurs planning (rouge/orange/bleu/vert/violet)
- [x] **D3** 🟡 Badgeage manuel → RDV vert « terminé » (+ fix bug 422)
- [x] **E1** 🟡 SIRET + n° TVA entreprise sur devis & factures
- [x] **F1** 🟡 Masquer prix/total à l'intervenant
- [x] **G1** 🟡 Page « Centre de notifications »

### LOT 3 — Gros chantiers ✅ TERMINÉ
- [x] **B4** 🔴 Contrats pour les CLIENTS (table `client_contracts` + onglet fiche)
- [x] **G2** 🔴 Notification heures semaine/mois intervenant (commande planifiée)
- [x] **G3** 🔴 Notification RDV non pointé +30 min (commande 10 min + colonne priority + bip cloche)
- [x] **H** 🔴 Refonte DOCUMENTS (onglets par public, destinataires, expiration, coche verte)
- [x] **I** 🔴 Système de notation des intervenants (greenfield — note auto)

> ✅ Plan post-RDV cliente intégralement livré (LOT 1 + 2 + 3).

> Push mobile (G3) : in-app + email opérationnels ; le canal push FCM reste à
> brancher (credentials Firebase + app mobile requis) — colonne `priority` prête.
> Scheduler : à câbler côté o2switch (`cron php artisan schedule:run` /min).

### Bugs préexistants découverts (à corriger au passage du LOT concerné)
- `documents` : colonne `deleted_at` absente malgré `SoftDeletes`
- `RequiredDocumentType::checklist()` : relation `documents()` + colonne `category` inexistantes
- `EditInterventionDialog::handleValidateBadge` : payload erroné → 422 (badgeage manuel cassé)

### Review
_(à remplir après validation + implémentation)_

---

## 🎯 2026-05-21 — Missions / devis / RDV ponctuels (agent dédié)

### TÂCHE 1 — Bug format horaire à la modification de mission
- [x] Backend `MissionController` : `date_format:H:i,H:i:s` sur `recurrence_start_time`
      et `recurrence_end_time` (`updatePrestation` + `prestationRules`)
- [x] Frontend `PrestationFormCard` : helper `toTimeInput` (tronque les secondes) ;
      `EditMissionPage::toDraft` + `serializePrestation` normalisent en `HH:MM`

### TÂCHE 2 — Mission créée → devis brouillon auto
- [x] Service `MissionQuoteGenerator` : génère un `Quote` draft à la création de
      mission avec prestations (1 `QuoteItem` par prestation, réf `QUO`, anti-doublon)
- [x] `MissionController::store` appelle le service en transaction ; le devis
      pointe la mission via `missions.quote_id`

### TÂCHE 3 — RDV ponctuel → mission + devis auto
- [x] `CreateInterventionDialog` (`MissionLinkStep`) : picker multi-prestations
      catalogue pour le mode ponctuel standalone
- [x] `InterventionController::store` : si prestations choisies + RDV ponctuel non
      lié → crée mission active + `client_prestations` (nature `punctual`) + devis
      draft (via `MissionQuoteGenerator`) + lie l'intervention
- [x] RDV sans prestation + RDV récurrent = comportement inchangé (testé)

### Review (vérifié end-to-end : php -l, tsc, tinker, navigateur réel)
- **Cause racine bug horaire** : `MissionController` validait `recurrence_*_time`
  en `date_format:H:i` (strict `HH:MM`). À la création OK (input time). À la
  modification, l'heure rechargée depuis la colonne SQL `time` (PostgreSQL la
  renvoie `09:00:00`) est rejetée → 422. Fix backend : `date_format:H:i,H:i:s`.
  Fix front : helper `toTimeInput` tronque les secondes pour l'`<input time>`.
  Preuve : ancienne règle rejette `09:00:00` (422), nouvelle l'accepte (OK) ;
  PATCH navigateur `recurrence_start_time:'09:00:00'` → 200.
- **Service `MissionQuoteGenerator`** (réutilisé par les tâches 2 et 3) : crée un
  `Quote` draft, une `QuoteItem` par prestation (label, qté 1, prix résolu
  custom>base, `product_id`, `item_type` mappé du `billing_type`), réf via
  `DocumentSequenceService::next('QUO')`, lie `missions.quote_id`. Anti-doublon :
  no-op si la mission a déjà un `quote_id`. Pas de devis si 0 prestation ou
  client sans entité. Prix castés en string (évite la dépréciation brick/math).
- **Tâche 3** : `InterventionController::store` accepte un tableau `prestations`
  optionnel ; déclenche la création mission+devis UNIQUEMENT pour un RDV
  ponctuel (`is_recurring` false), avec client, non lié à une mission. Tout en
  `DB::transaction`. Front : `MissionLinkStep` affiche un picker de prestations
  (catalogue) en mode standalone, payload `prestations` ajouté au submit.
- **Tests** : tinker — re-save presta récurrente (plus de 422), mission+presta →
  devis draft (total/lignes/quote_id OK, anti-doublon null au 2e appel), RDV
  ponctuel HTTP → mission active + 2 prestations punctual + devis 200€ + iv liée.
  Non-régression : RDV ponctuel sans presta = one-shot (mission_id null), RDV
  récurrent intact. Navigateur réel : login super_admin, RDV ponctuel avec
  prestation 150€ → mission/devis `QUO-202605-0002` créés (vérifié en base),
  édition mission récurrente → inputs time affichent `09:00`/`11:00`, 0 erreur
  console. `php -l` 0 erreur, `tsc --noEmit` 0 erreur, `migrate` (rien à migrer),
  suite de tests 2/2.

## 💰 2026-05-21 — Champs produits stock + retrait billing_mode catalogue

### Tâche 1 — Champs produits de stock
- [x] Migration idempotente : purchase_price, selling_price, supplier_id sur stock_products
- [x] Modèle StockProduct : fillable + casts decimal + relation supplier()
- [x] StockController::store + update : valider/persister les 3 champs
- [x] Endpoint référentiel suppliers + route
- [x] Hook useSuppliers
- [x] Formulaire StockPage : 2 champs prix + Select fournisseur
- [x] Type StockProduct frontend

### Tâche 2 — Retrait billing_mode catalogue
- [x] ProductsListPage : retirer champ Facturation + BILLING_MODE_LABELS
- [x] ProductController : billing_mode nullable + défaut per_intervention
- [x] Vérifier devis/missions non cassés

### Vérification
- [x] php -l (5 fichiers) 0 erreur, tsc --noEmit 0 erreur, migrate OK, suite 2/2

### Review
- Migration `2026_05_21_160000_add_prices_and_supplier_to_stock_products` :
  `purchase_price`/`selling_price` decimal(12,2) nullable + `supplier_id` FK
  nullable `nullOnDelete` vers `suppliers`. Idempotente (`Schema::hasColumn`),
  pas de SQL spécifique → OK PostgreSQL/SQLite. Appliquée (batch 25).
- `StockProduct` : 3 champs au `$fillable`, casts `decimal:2`, relation
  `supplier()`. `StockController::store` (nullable numeric/exists) + `update`
  (sometimes nullable) persistent les 3 champs ; eager-load `supplier:id,name`.
- Endpoint `GET /referentials/suppliers` (fournisseurs actifs id+name) + route.
- Front : hook `useSuppliers` (use-operations.ts), type `StockProduct` enrichi,
  `CreateProductDialog` : 2 champs prix + Select fournisseur (« — Aucun — »),
  validation au clic des prix (toast, submit jamais disabled).
- Tâche 2 : `billing_mode` retiré du `ProductFormDialog` (champ Facturation,
  state, payload, constante `BILLING_MODE_LABELS`). `ProductController` :
  `billing_mode` passé `required`→`nullable`, défaut `per_intervention` au
  store. Colonne `products.billing_mode` CONSERVÉE (rétro-compat) ;
  `ProductResource`/`Product` model/type front intacts → devis/missions OK.
- Tests tinker : StockProduct + 3 champs (relation supplier OK) ; StockCtrl
  store 201 (prix+fournisseur) + update (prix modifié, supplier nulé) ;
  ProductCtrl store sans billing_mode → 201, défaut `per_intervention` appliqué.

## 📦 2026-05-21 — Produits de stock dans les devis et les missions

Objectif : ajouter des produits de stock (consommables/matériel) aux devis
(chiffrage seul, 0 mouvement) et aux missions (décompte immédiat du stock).

### Plan
- [x] Étape 0 — Exploration (StockController, modèles, QuoteController, MissionController)
- [x] Étape 1a — Migration : `stock_product_id` nullable sur `quote_items` + `invoice_items`
- [x] Étape 1b — Modèles QuoteItem/InvoiceItem : fillable + relation `stockProduct`
- [x] Étape 1c — QuoteController store/update : accepter/persister `stock_product_id` (0 mouvement)
- [x] Étape 1d — convertToInvoice / convertToMission : propager les lignes produit stock
- [x] Étape 1e — CreateQuoteDialog : 3e bouton « Produit du stock »
- [x] Étape 2a — Migration : table `mission_stock_items`
- [x] Étape 2b — Modèle MissionStockItem + relation `Mission::stockItems()`
- [x] Étape 2c — Services `StockMovementService` + `MissionStockService` (factorisation)
- [x] Étape 2d — Endpoints REST `missions/{mission}/stock-items` (GET/POST/PATCH/DELETE)
      avec décompte automatique en transaction
- [x] Étape 2e — Hooks frontend `use-mission-stock` + `useStockProductOptions`
- [x] Étape 2f — Zone « Produits / consommables » dans Create + EditMissionPage
- [x] Étape 3 — Vérif : php -l, tsc, migrate, tinker, navigateur réel

### Review (vérifié end-to-end via tinker + navigateur)

**Migrations** (idempotentes, PostgreSQL/SQLite, rollback+up testé) :
- `2026_05_21_150000_add_stock_product_to_quote_and_invoice_items` — FK nullable
  `stock_product_id` (`nullOnDelete`) sur `quote_items` ET `invoice_items`.
- `2026_05_21_150100_create_mission_stock_items_table` — table de liaison
  `mission_stock_items` : `mission_id` (cascade), `stock_product_id` (nullable
  `nullOnDelete` — null = ligne libre), `label`, `quantity` decimal, `unit_price`
  decimal, timestamps.

**Backend** :
- `StockMovementService` — factorise l'application d'un mouvement (delta +
  `current_quantity` clampée à 0). `MissionStockService` — add/update/remove
  d'une ligne mission AVEC décompte (sortie à l'ajout, entrée au retrait,
  ajustement par delta à la modif de quantité ; ligne libre = 0 mouvement).
- DEVIS : `QuoteController::store/update` accepte `items.*.stock_product_id`.
  AUCUN mouvement de stock. `convertToInvoice` propage `stock_product_id` ;
  `convertToMission` transforme les lignes produit-stock en `mission_stock_items`
  (et déclenche alors le décompte) — les autres lignes restent des prestations.
- MISSION : 4 endpoints `GET/POST/PATCH/DELETE /missions/{mission}/stock-items`.
  Décompte en transaction. Stock insuffisant NON bloquant (clamp à 0, cohérent
  avec `StockController` existant) — info `low_stock` renvoyée.
- `StockController::options` + route `GET /stock/products/options` (liste plate
  pour les sélecteurs).

**Frontend** :
- `CreateQuoteDialog` : 3e bouton « Produit du stock » à côté de « Prestation du
  catalogue » / « Ligne libre ». Sélecteur catalogue stock, badge « Stock »,
  hint « chiffrage seul ». `stock_product_id` envoyé dans le payload.
- `MissionStockSection` (composant partagé, 2 modes) : `Draft` pour
  CreateMissionPage (collecté en local, persisté après création de la mission),
  `Live` pour EditMissionPage (mutations immédiates → décompte temps réel).
- Hooks `use-mission-stock.ts` (CRUD) + `useStockProductOptions`.

**Preuve des tests** :
- tinker service : add (100→88, 1 mvt out), update 12→20 (→80), 20→5 (→95),
  remove (→100), ligne libre (0 mvt), devis avec produit stock (0 mvt),
  stock insuffisant 250/100 (clamp à 0, pas d'exception). 7/7 OK.
- tinker HTTP : POST/GET/PATCH/DELETE stock-items (201/200/200/204), décompte
  50→42→47→50, options 200. OK.
- tinker conversion : devis accepté → mission, ligne produit-stock devient
  `mission_stock_item` + 1 mouvement, ligne prestation reste `client_prestation`,
  devis lui-même 0 mouvement. OK.
- Navigateur réel : CreateMissionPage → mission créée avec produit stock,
  `stock_products.current_quantity` 40→39 ; EditMissionPage affiche la zone
  produits + delete → 39→40. Validation « choisis un produit du stock » OK.
  0 erreur console.
- `php -l` 0 erreur (11 fichiers), `tsc --noEmit` 0 erreur, `migrate` OK,
  suite de tests passe (2/2).

## ✅ 2026-05-21 — Workflow de validation des devis par le client (extranet)

Objectif : admin envoie un devis (`sent`) → client notifié → client consulte +
valide depuis l'extranet (`accepted`) → admin notifié → conversion en mission.

### Plan
- [x] Étape 1 — Backend validation : `POST /extranet/client/quotes/{quote}/accept`
      + `refuse` + `GET /extranet/client/quotes/{quote}/pdf` (ownership strict)
- [x] Étape 2 — Notifications : QuoteObserver texte « Devis à valider » ;
      nouveau type `quote_accepted` ; notif admins à la validation
- [x] Étape 3 — `POST /quotes/{quote}/convert-to-mission` (mission + prestations
      depuis les lignes, anti-doublon `missions.quote_id`, devis `accepted` only)
- [x] Étape 4 — Frontend extranet : section Devis + page dédiée, boutons
      consulter/valider/refuser/PDF, hooks `useAcceptClientQuote` etc.
- [x] Étape 4bis — Bell deep-link extranet-aware + bouton « Créer la mission »
      admin sur devis `accepted`

### Review (vérifié end-to-end via tinker)
- **Endpoints créés** :
  - `POST /extranet/client/quotes/{quote}/accept` — ownership strict
    (`quote.client_id` == client du `portal_user_id`), 409 si pas `sent`.
  - `POST /extranet/client/quotes/{quote}/refuse` — symétrique → `refused`.
  - `GET /extranet/client/quotes/{quote}/pdf` — `QuotePdfGenerator`, ownership.
  - `POST /quotes/{quote}/convert-to-mission` — admin, `accepted` only,
    anti-doublon `missions.quote_id`, mapping items → prestations.
- **Notifications** : `QuoteObserver` réécrit — `sent` → client « Devis à
  valider » ; `accepted` → admins « Devis validé » (exclut l'auteur). Nouveau
  type `quote_accepted` (seeder relancé, idempotent).
- **Tests tinker** : devis sent → notif client OK ; accept → `accepted` +
  notif admin OK, client non auto-notifié ; convert → mission + 2 prestations
  (forfait/default/base, frais/custom/custom) ; anti-doublon (2e appel = même
  mission, status 200, `already_existed`) ; gardes 409 (draft, déjà accepted)
  et 403 (accept/PDF cross-client) ; PDF propriétaire 200 (879 KB).
- **Frontend** : section/page « Mes devis » extranet (consulter/valider/
  refuser/PDF blob), hooks `useAcceptClientQuote`/`useRefuseClientQuote`/
  `useConvertQuoteToMission`, bell deep-link extranet-aware (client → pages
  extranet, jamais routes admin), bouton « Créer la mission » sur le devis
  admin `accepted` → ouvre `EditMissionPage`.
- `php -l` 0 erreur, `tsc --noEmit` 0 erreur, `migrate:status` OK (aucune
  migration nécessaire — colonnes existantes réutilisées).

## 🐛 2026-05-21 — Bug édition de mission : la sauvegarde ne persiste rien (perçu)

### Causes racines (vérifiées via preview + tinker)
- **C1 — dérive des dates** : `client_prestations.start_date/end_date` sont des
  casts `date`. Eloquent les sérialise en JSON comme datetime ISO complet
  (`2026-05-20T22:00:00.000000Z`). Le front stocke ce datetime brut comme valeur
  du champ → `<input type=date>` ne peut PAS l'afficher (champ vide → « rien
  saisi ») et au re-save la date dérive de −1 jour à chaque aller-retour
  (timezone Europe/Paris).
- **C2 — bouton trompeur** : « Enregistrer la mission » (gros bouton haut-droite)
  ne persiste QUE les infos mission. Chaque prestation a son propre petit bouton
  `h-6 text-[11px]`. L'utilisateur édite tout, clique le gros bouton → les
  prestations ne sont jamais sauvegardées.

### Plan correctif
- [x] C1 backend : caster `start_date`/`end_date` en `date:Y-m-d` (ClientPrestation)
      → JSON renvoie `YYYY-MM-DD`. Idem `recurrence_start_date` sur Intervention.
- [x] C1 front : `toDraft` + `serializePrestation` normalisent toute date en `Y-m-d`.
- [x] C2 : bouton « Enregistrer la mission » → enregistre mission + TOUTES les
      prestations en un clic ; toast récap. Bouton par prestation conservé.
- [x] Re-hydratation de la ligne après save (id + draft depuis la réponse).
- [x] Vérif end-to-end : save mission+presta OK, presta récurrente → intervention
      générée → occurrences au planning.

## ✨ 2026-05-21 — Assignation d'intervenant depuis la prestation (carte suggestion)
- [x] Migration `default_employee_id` (nullable FK employees) sur client_prestations
- [x] Validation + fillable + relation `defaultEmployee`
- [x] `RecurringInterventionGenerator` assigne `employee_id`/statut depuis default
- [x] `PrestationFormCard` : bouton « Assigner un intervenant » + Dialog carte
- [x] Affichage intervenant choisi + retrait

### Review (vérifié end-to-end via preview navigateur + tinker)
- **Cause racine confirmée** : le bug n'était PAS un échec API. Les PATCH/POST
  renvoyaient 200/201. Deux défauts cumulés donnaient l'illusion « rien n'est
  sauvegardé » : (C1) cast `date` sérialisé en datetime ISO → `<input date>` vide
  + dérive -1j au re-save ; (C2) le bouton « Enregistrer la mission » ne sauvait
  que les infos mission, jamais les prestations.
- **C1 corrigé** : casts `date:Y-m-d` (ClientPrestation + Intervention) + helper
  front `toDateInput()`. Vérifié : re-PATCH d'une date → STABLE (0 dérive).
- **C2 corrigé** : « Tout enregistrer » → 1 clic = PATCH mission + PATCH/POST de
  chaque prestation + toast récap. Vérifié navigateur : 2 PATCH 200, données en
  base, toast « Mission enregistrée · 1 prestation(s) · 1 récurrence(s) ».
- **Récurrence** : prestation regular → intervention `is_recurring` générée → 5
  occurrences visibles sur le planning (calendar endpoint). Sans default employee
  → `a_pourvoir`/`employee_id=null` ; avec default → `planifiee`/affecté.
- **P2** : carte de suggestion réutilise `AvailableEmployeesMap` + endpoint
  `availableEmployees` existants. Migration idempotente (rollback+up testé).
- Non cassé : CreateMissionPage, planning (calendar OK, 0 erreur console), tsc 0
  erreur, `php -l` 0 erreur, `php artisan migrate` OK, suite de tests passe.

## 🧹 2026-05-21 — Clarté des formulaires de création (champs « Code » et « Entité »)

Contexte : « Code » oblige l'utilisateur à inventer un identifiant ; « Entité »
affiche un ID numérique brut. Incompréhensible.

### Plan
- [x] Recensement : `CreateClientDialog` (Code + Entité), `CreateEmployeeDialog`
      (Entité seul — pas de colonne `code` côté employees). Invoice/Reglement :
      `entity_id` hardcodé en state, jamais affiché → dérivé du client backend.
- [x] Code : `clients.code` rendu `nullable` ; généré `CLI-{id zero-pad 4}`
      après insert si vide ; unicité conservée si fourni. Champ retiré du dialog.
- [x] Entité : `Select` shadcn par nom via `useEntities` ; pré-sélection auto si
      une seule entité ; description « Agence / société de rattachement ».
- [x] Invoice/Reglement : `entity_id` dérivé du client côté backend (plus de
      dépendance au hardcode `"1"`).
- [x] Revue clarté générale des 2 dialogs de création.

### Review
- Migration `2026_05_21_120000_make_clients_code_nullable` : `clients.code`
  rendu nullable. Idempotente, pas de SQL spécifique → OK PostgreSQL/SQLite.
  L'index `unique` est conservé (Postgres autorise plusieurs NULL).
- `StoreClientRequest` : `code` passé de `required` à `nullable` ; unicité
  conservée. `prepareForValidation` durci (`filled` + cast string).
- `ClientController::store` : génère `CLI-{id zero-pad 4}` après l'insert si
  `code` vide. Pas de race condition (l'id est unique).
- `CreateClientDialog` : champ « Code » retiré du formulaire (le code reste
  visible sur la fiche, ex. « Code CLI-0012 »). « Entité » → `Select` shadcn
  par nom, pré-sélection auto si une seule entité, indice « Agence / société
  de rattachement ». Placeholders ajoutés (gérant, email, téléphone).
- `CreateEmployeeDialog` : « Entité » input number brut → `Select` shadcn
  identique. Pas de champ « Code » côté employés (la table `employees` n'a
  pas de colonne `code` — rien à générer).
- Invoice/Reglement : `entity_id` était hardcodé `"1"` dans le state (jamais
  affiché). Retiré du frontend ; les controllers le dérivent de
  `client.entity_id`. Validation `entity_id` passée `nullable`.
- Tests : `php -l` OK, `php artisan migrate` OK, génération `CLI-XXXX` testée
  en tinker (code généré + unique, code manuel conservé), `tsc --noEmit` 0
  erreur. Test navigateur réel (login super_admin) : création client →
  « Code CLI-0012 » auto + entité rattachée ; création intervenant OK ;
  0 erreur console.

## ✏️ 2026-05-21 — Édition d'une mission existante

Contexte : on pouvait créer une mission mais pas y revenir pour l'éditer.

### Fait
- [x] Composant partagé `components/missions/PrestationFormCard.tsx` : extrait du
      `PrestationCard` de CreateMissionPage. Exporte aussi `emptyPrestation`,
      `validatePrestation`, `serializePrestation`, `BILLING_TYPES`,
      `PAYMENT_METHODS`, `BILLING_RHYTHMS`, `WEEKDAYS`, `todayStr`.
- [x] `CreateMissionPage` refactorisée pour consommer le composant partagé
      (suppression de ~400 lignes dupliquées, comportement identique).
- [x] Nouvelle page `pages/missions/EditMissionPage.tsx` : route
      `/clients/:id/missions/:missionId`. Charge mission + prestations, pré-remplit.
      Infos mission via `useUpdateMission` (bouton « Enregistrer la mission »).
      Prestations gérées pièce par pièce : create/update/delete par carte.
      Skeleton pendant le fetch, flag `hydrated` pour ne pas écraser les
      modifications en cours après le refetch déclenché par une mutation.
- [x] Confirmation de suppression d'une prestation via `Dialog` shadcn.
- [x] Route ajoutée dans `App.tsx`.
- [x] Accès : `MissionsListPage` (clic ligne + bouton crayon → page d'édition),
      `ClientMissionsTab` (bouton « Modifier » inline + item dropdown).
      Accès création `/clients/:id/missions/new` intact.

### Review
- `tsc --noEmit` : 0 erreur. Test navigateur réel (login admin) : édition infos
  mission OK, update prestation OK, ajout prestation OK, suppression avec dialog
  de confirmation OK, validation au clic (submit jamais disabled métier) OK,
  3 chemins d'accès vérifiés, 0 erreur console.
- Note dette préexistante : `npm run build` (`tsc -b`, règle `noUnusedLocals`)
  remonte des erreurs dans des fichiers NON touchés (PlanningPage,
  ProductsListPage, StockPage, TicketDetailPage, ContextMenuEvent, MapPage,
  LongAbsenceBanner). `tsc --noEmit` (exigence projet) reste à 0.

## 🔁 2026-05-21 — Refonte nature des prestations + récurrences au niveau mission

Contexte : la « nature » (régulier/ponctuel) était un champ du catalogue
`products.nature`. Erreur de conception : la nature dépend du contrat client,
pas de la prestation. Refonte : nature portée par `client_prestations` +
génération auto des interventions récurrentes à la création/maj de mission.

### Plan
- [x] Étape 1 — Retirer la nature du catalogue (front ProductFormDialog + back ProductController nullable défaut 'regular')
- [x] Étape 2 — Migration `client_prestations.nature` + champs récurrence ; formulaire mission par prestation
- [x] Étape 3 — Génération auto interventions récurrentes dans MissionController (transaction, anti-doublon)
- [x] Étape 4 — Notif RDV à pourvoir + commande artisan `app:notify-unassigned-interventions` quotidienne
- [x] Étape 5 — Vérification système d'id InterventionExpander (anti-collision)
- [x] Étape 6 — Verrouillage du prix dans la mission (case « Prix personnalisé »)

### Review
- Migration `2026_05_21_101153_add_nature_and_recurrence_to_client_prestations` :
  ajoute `nature` (défaut punctual) + 7 colonnes de récurrence. Idempotente
  (`Schema::hasColumn`), pas de SQL spécifique → OK PostgreSQL + SQLite.
- Service `RecurringInterventionGenerator` : crée/maj UNE intervention récurrente
  modèle par prestation `regular` (anti-doublon : update si déjà générée, sans
  réécraser status/intervenant). Supprime la récurrence si la prestation repasse
  ponctuelle. `MissionController` l'appelle en transaction (store/storePrestation/
  updatePrestation/destroyPrestation).
- Notif : nouveau type `intervention_unassigned`. `InterventionObserver::created`
  notifie les admins si `status=a_pourvoir` + `employee_id=null` (au lieu de la
  notif "nouveau RDV" classique). Commande `app:notify-unassigned-interventions`
  (récap quotidien groupé 7j, schedulée 08:00) — déclencheur Render à câbler.
- Système d'id InterventionExpander vérifié : occurrence = `{id}-{Ymd}`, réel =
  `{id}`. Pas de collision possible (le `-` est un délimiteur non ambigu, la date
  est toujours 8 chiffres). Testé : 19 occurrences, 19 ids uniques.
- Tests tinker : création mission HTTP (201, 1 récurrente générée a_pourvoir +
  notif admin, 0 pour ponctuelle), idempotence (re-sync ×2 = 1 iv), flip
  regular→punctual (récurrence supprimée), produit sans nature (défaut regular).
  `php -l` OK partout, `php artisan migrate` OK, `tsc --noEmit` 0 erreur.

## 🔔 2026-05-20 — Matrice de notifications in-app (cloche)

Contexte : la cloche existait mais ne couvrait qu'une fraction des events
métier. Objectif : couvrir tous les events importants pour les 3 publics
(admin / intervenant / client), via observers Eloquent + NotificationDispatcher.

### Fait
- [x] Audit : `NotificationDispatcher`, 3 observers existants, seeder, `MessagingController`
- [x] `InterventionObserver` étendu : notifie aussi le **client** (`portal_user_id`)
      + nouvel event **changement de date/heure** (`intervention_modified`)
- [x] `ClientRequestObserver` réécrit : création → **admins + owner** (jamais le
      créateur) ; ajout event **changement de statut** → créateur du ticket
- [x] `MissionObserver` créé : mission créée → admins + client
- [x] `InvoiceObserver` créé : facture émise (status → sent) → client
- [x] `QuoteObserver` créé : devis envoyé (status → sent) → client
- [x] `MessageObserver` créé : message posté → tous les participants sauf l'expéditeur
- [x] `MessagingController::postMessage` : suppression du `Notification::create()`
      en direct → délégué à `MessageObserver` (passe par le Dispatcher)
- [x] Morph map : ajout `mission` (`invoice`/`quote` déjà présents)
- [x] `NotificationTypesSeeder` : ajout `mission_created`, `invoice_issued`,
      `quote_sent`, `client_request_status` (idempotent, relancé)
- [x] Tests tinker : tous les events vérifiés (bons `user_id`, bon `target_type`)

---

## 🧩 2026-05-20 — Refonte formulaire de création de devis + UI types de devis

Contexte : le `CreateQuoteDialog` faisait tout saisir à la main (désignation
libre, qté, prix), déconnecté du catalogue de prestations. Refonte pour piloter
les lignes par le catalogue + permettre les devis depuis une mission.

### Frontend (ce qui a été fait)
- [x] Nouveau hook `use-quote-types.ts` : `useQuoteTypes / useCreateQuoteType /
      useUpdateQuoteType / useDeleteQuoteType` (CRUD `/quote-types`)
- [x] `useClientMissions` / `useMissionPrestations` réutilisés (déjà dans `use-missions.ts`)
- [x] Type `QuoteType` ajouté à `types/api.ts` ; `product_id`/`vat_rate_id` sur
      `QuoteItem`, `quote_type_id`/`mission_id` sur `Quote` (`use-phase3.ts`)
- [x] Refonte `CreateQuoteDialog` : Client → Type de devis (pré-remplit nature) →
      Nature → Mission d'origine (si régulière, bouton « Charger les prestations »)
      → Lignes catalogue (select prestation → pré-remplit label/prix/TVA/type) +
      lignes libres → dates/commentaire → Total HT. `entity_id` n'est plus envoyé
      (dérivé backend). Validation au clic (toast), submit jamais disabled hors `isPending`.
- [x] Nouveau `QuoteTypesDialog` : bouton « Types de devis » dans le header,
      CRUD inline (création/édition/désactivation/réactivation)
- [x] Nettoyage type mort `Paginated<T>` dans `use-phase3.ts`
- [x] Vérif : `tsc --noEmit` 0 erreur ; test navigateur réel (login admin →
      création type de devis → création devis avec ligne catalogue → PDF intact)

### Reste éventuel (non bloquant)
- Le catalogue de prestations était vide en BDD de démo → prévoir un seeder
  `CatalogSeeder` qui crée quelques prestations actives pour les démos.

---

## 🧾 2026-05-20 — Devis/Factures autonomes + Prestations + PDF B2B

Contexte : les API Pennylane/Silae ne seront pas dispo tout de suite (conformité
facturation électronique en cours). L'ERP doit créer devis/factures de façon
autonome. Templates adaptés aux clients ENTREPRISES (B2B).

### Volet PDF B2B (commit 5d23fca)
- [x] Refonte `invoices/pdf.blade.php` au format Aspha B2B
- [x] Nouveau `quotes/pdf.blade.php` (zone "Bon pour accord")
- [x] `SalesPdfPresenter` (calcul TVA dynamique par taux) + `QuotePdfGenerator`
- [x] `config/aspha.php` (constantes société, surchargeable .env)
- [x] Routes `GET /quotes/{quote}/pdf` + `GET /invoices/{invoice}/pdf`
- [x] Front : bouton "Télécharger PDF" QuotesListPage + InvoicesListPage (blob)
- [x] Fix bug : `<a href>` direct vers /facturx perdait l'auth Sanctum → blob

### Volet Prestations (commit 23258f2)
- [x] `ProductController` : store/update validation stricte + paliers dégressifs
- [x] Permission élargie super_admin → super_admin + admin
- [x] Front : bouton "Nouvelle prestation" + ProductFormDialog complet
- [x] Hooks référentiels (vat-rates, product-categories, entities)
- [x] Test fonctionnel : création produit + paliers OK

### Volet "devis/factures sans Pennylane"
- [x] Déjà acquis : numérotation via `DocumentSequenceService`, Pennylane = sync
      optionnel séparé. Création autonome confirmée.

### Reste éventuel (non bloquant)
- [ ] En-tête agence : l'`Entity` n'a pas d'adresse ni N° agrément en BDD →
      fallback `config/aspha.php`. Si besoin, migration pour stocker ces
      champs par entité (adresse, tel, N° agrément/autorisation).

---

## Toutes les phases du plan initial sont livrées ✅

- [x] **Phase 0** — Bootstrap (Laravel 11, Sanctum, Vite/React, Tailwind v4, shadcn)
- [x] **Phase 1** — Schéma BDD (78+ migrations, 80+ modèles)
- [x] **Phase 2** — Clients / Intervenants / Prestations
- [x] **Phase 2.5 Sprint A** — Sous-modules fiches
- [x] **Phase 2.5 Sprint B** — Contrats + saisies sur salaire
- [x] **Phase 3** — Planning (FullCalendar + récurrences) + Ventes (Factur-X + Pennylane)
- [x] **Phase 4** — Télégestion (QR + badgeages + saisie manuelle)
- [x] **Phase 5** — Portail client (réclamations + réassorts + signatures + qualité)
- [x] **Phase 6** — Stock par entité
- [x] **Phase 7** — Messagerie interne
- [x] **Phase 8** — Notifications multi-canal (push FCM + email + SMS)
- [x] **Phase 9** — Flotte véhicule
- [x] **Phase 10** — Matching auto intervenant (score composite skills+géo+dispo+préférence)
- [x] **Cartographie** Leaflet
- [x] **Géocodage auto** BAN.gouv.fr
- [x] **Tab Portail intégré** dans fiche client
- [x] **Édition inline généralisée** (Entreprise, Gérant, Identité, Diplômes, Contact facturation)

## 🔥 Audit complet 2026-05-19 — chasse aux bugs

11 sous-agents lancés en 2 vagues sur la totalité du code (back + front + BDD + config). Total : **~37 CRIT, ~81 HIGH, ~78 MED, ~54 LOW**.

Plan de correction (en cours) :

### Phase A — Sécurité critique (failles isolation / IDOR / RGPD)
- [ ] Verrouiller permissions controllers : `ClientController`, `EmployeeController`, `InvoiceController`, `QuoteController`, `InterventionController.show`, `MessagingController.store`
- [ ] Ajouter ownership check sur `ClientPortalController` (vérifier `{client}` appartient au user)
- [ ] Gating role sur `PlanningSummaryController` (intervenant/client → forcer filtre par leur id)
- [ ] Gating role sur `SettingsController.index` + `publicSettings` (intervenant/client : ne pas exposer `silae_portal_url`)
- [ ] Page `/carte` : masquer adresses employés pour non-admin
- [ ] Documents : storage `local` (privé), download via controller, ownership check, MIME whitelist
- [ ] `Contract::logFillable()` : retirer `monthly_salary` du log activity
- [ ] Login : bloquer users `status=inactive`
- [ ] `MessageThreadParticipant` : PK composite ou ID
- [ ] `NotificationDispatcher.target_id` : autoriser null en DB

### Phase B — Config production
- [ ] CORS env-aware (wildcard dev uniquement, liste fermée en prod)
- [ ] Rate limiting `/login` (5/min) + `/api` (60/min) avec les vars existantes
- [ ] `APP_DEBUG=false` par défaut, `.env.example` propre
- [ ] Headers sécurité (HSTS, X-Frame-Options, CSP basique)
- [ ] `SESSION_SECURE_COOKIE` documenté dans `.env.example`

### Phase C — Finances
- [x] TVA dynamique (`vat_rate_id` sur QuoteItem/InvoiceItem + relation `vatRate`) — 2026-05-19
- [x] Numérotation atomique (table `document_sequences` + `DocumentSequenceService` lockForUpdate) — 2026-05-19
- [x] Anti-double conversion devis→facture (`quotes.invoice_id` + abort 409) — 2026-05-19
- [x] Over-allocation règlement (`sum(allocations) ≤ amount` + `sum ≤ TTC dû par facture`) — 2026-05-19
- [ ] Pennylane idempotence + customer_id mapping
- [ ] Factur-X : 422 explicite si SIRET émetteur manquant
- [x] Cascade `Invoice.destroy` / `Reglement.destroy` (purge `reglement_invoice_lines`) — 2026-05-19
- [x] `QuoteController.update` bloque modif devis converti (abort 409) — 2026-05-19

### Phase D — Bugs UX bloquants
- [x] EditableField : null OK (toast + restore), single save (ref-flag), draft preserved (editingRef) — fix 2026-05-19
- [x] `ClientController.update` : pas de DELETE billing_contact sur vidage de champ — fix 2026-05-19
- [x] `updateOrCreate` company : require `company_name` minimum à la création — fix 2026-05-19
- [x] EditInterventionDialog : payload complet pour occurrence virtuelle (key/address/contact/transport/vehicle/flags/internal_comment) — fix 2026-05-19
- [ ] Drag-drop : propager `employee_id`
- [x] Tickets observer : fallback sur super_admins en dernier recours (jamais l'expéditeur) — fix 2026-05-19
- [x] Cascade Client/Employee.destroy : 409 si interventions futures liées, bypass `?force=1` super_admin — fix 2026-05-19
- [ ] `RoleRouter` : gérer `role=null`, robuste au flash
- [ ] `Sidebar` : filtrer items par rôle (ne plus rien afficher pour intervenant/client en /)
- [ ] Route `*` 404 + ErrorBoundary global

### Phase E — Modules cassés
- [ ] Télégestion : aligner front (`scanned_at` → `checkin_time`, etc.) ou back
- [ ] Push FCM : désactiver proprement (sans crasher) ou migrer HTTP v1
- [ ] Matching skills : implémenter `$requiredSkillIds` réel + exclure absences

### Phase F — Schéma BDD
- [ ] Migration : `contacts` table (ref par `interventions.contact_id`) — vérifier vs existence
- [ ] Index manquants sur tables coeur (interventions, invoices, reglements, telemanagement_logs, etc.)
- [ ] Timestamps manquants : `checkins`, `qr_codes`, `addresses`, `messages`, `invoice_items`
- [ ] Unique composite : `employee_skills`, `notification_preferences`, `message_thread_participants`
- [ ] `Intervention` SoftDeletes
- [ ] `notifications` polymorphe : index composite `(target_type, target_id)`

### Phase G — Polish (MED + LOW)
- [ ] Cache invalidation hooks (`useDeleteClient` etc.)
- [ ] Polling pause sur `document.hidden`
- [ ] Confirmations natives → AlertDialog shadcn
- [ ] Dashboard KPIs réels (backend dédié)

---

## 🌅 À reprendre demain — 2026-05-20

État au soir du 2026-05-19 : **Phases A→F livrées (5 commits, ~50 bugs CRIT/HIGH corrigés)**. Working tree clean, 0 erreur TS, migrations appliquées.

### Items qui restent à corriger (priorisés)

**🔴 Reste de Phase C — Finances (2 items HIGH)**
- [ ] **Pennylane idempotence** — actuellement, un re-sync recrée une nouvelle facture côté Pennylane (doublon comptable). Ajouter une vérif `if ($invoice->pennylane_id) { skip ou PUT update }` au lieu de POST systématique. Aussi : table `pennylane_sync_logs` pour traçabilité.
- [ ] **Pennylane customer_id mapping** — actuellement `'customer_id' => $invoice->client_id` envoie l'ID local. Créer une colonne `clients.pennylane_id` (nullable), résoudre lors du sync (créer le client Pennylane si absent, stocker l'id retourné).
- [ ] **Factur-X 422 si SIRET émetteur manquant** — au lieu de générer un XML non conforme silencieux, abort 422 explicite "SIRET émetteur (entité) requis pour Factur-X EN16931".

**🟠 Reste de Phase D — UX bloquants (4 items HIGH/MED)**
- [ ] **Drag-drop propager `employee_id`** — `PlanningPage.handleEventDrop` ne lit jamais le nouvel employé si l'utilisateur drag sur une autre ligne (resourceTimeGrid). Lire `arg.event.getResources()` et propager dans le PATCH/exception.
- [ ] **`RoleRouter` gérer `role=null`** — actuellement laisse passer si `user.role === null`. Forcer redirect login ou écran d'erreur explicite.
- [ ] **`Sidebar` filtrer items par rôle** — un intervenant/client qui charge `/` (avant que RoleRouter redirige) voit clignoter la sidebar admin complète. Ajouter `if (!user.role.startsWith('admin')) return null` au début de `AppSidebar`.
- [ ] **Route `*` 404 + ErrorBoundary global** — actuellement toute URL inconnue = page blanche. Ajouter `<Route path="*" element={<NotFound />} />` + un ErrorBoundary qui catch les exceptions React.

**🟡 Phase G — Polish (4 items MED/LOW)**
- [ ] Cache invalidation hooks (`useDeleteClient`, `useDeleteEmployee` → ne purgent pas `["clients", id]` ni `["employees", id]` → données fantômes au back).
- [ ] Polling pause sur `document.hidden` (économise bande passante quand l'onglet est inactif).
- [ ] Confirmations natives `confirm(...)` → `AlertDialog` shadcn (UX cohérente, i18n-able).
- [ ] Dashboard KPIs : backend dédié `DashboardController::stats()` au lieu des 3 calls `useClients/Employees/Interventions{per_page:1}` actuels (lourd + faux si RLS).

### Items reportés à plus tard (non bloquants prod immédiate)

**Modules secondaires + admins** (MED/LOW)
- Stock : mouvement `out` sans stock dispo silencieusement clampé à 0 (historique incohérent) — `StockController.php:113`.
- Stock : ajustement à 0 unité bloqué par `min:1` (légitime pour inventaire physique vide).
- Flotte : `FleetController` aucune permission `abort_unless` (tout user authentifié peut assigner véhicules).
- Flotte : `incident_at` validé `date` mais colonne `dateTime` (heure perdue).
- Matching front court-circuite `PATCH /matching-requests/{id}/assign` → historique vide.
- `UsersController` : permet créer `super_admin` sans audit log + pas de garde-fou "dernier super_admin actif".
- `ClientPortalAccessController.sendEmail` retourne le password en JSON même si email pas envoyé.

**Headers sécurité + .env**
- [ ] Headers HSTS / X-Frame-Options / CSP basique (middleware dédié).
- [ ] `SESSION_SECURE_COOKIE` documenté dans `.env.example`.
- [ ] `APP_DEBUG=false` par défaut dans `.env.example` + check au démarrage en prod.
- [ ] Commande artisan `documents:migrate-to-local` pour migrer les fichiers existants du disk `public` vers `local`.

**Notifications & messagerie** (MED)
- [ ] `MessagingController.totalUnread` N+1 (50 threads = 50 queries) → utiliser sub-query SQL.
- [ ] Pagination messages : actuellement `paginate(50)` mais front pas de scroll → historique > 50 perdu.
- [ ] `with(['messages' => fn $q => $q->limit(1)])` Eloquent bug → renvoie 1 message TOTAL, pas 1 par thread.

**Schéma BDD (reste après Phase F)** (LOW)
- [ ] `notifications` polymorphe : `morphs('target')` au lieu de l'index composite manuel (déjà ajouté en Phase F mais nom à standardiser).
- [ ] `vehicle_assignments` unicité `(employee_id) WHERE end_date IS NULL` (partial unique index).

### Comment reprendre demain

1. `git status` (working tree clean au moment de la pause)
2. `git log --oneline -10` pour relire les 5 commits d'audit
3. Choisir une phase à finir (priorité Phase C reste = Pennylane idempotence + customer_id mapping + Factur-X SIRET)
4. Sinon : faire un test manuel des flows critiques (login intervenant/client extranet, drag-drop planning, création facture, upload document) avant de continuer à corriger — pour valider qu'aucune régression n'a été introduite par les 5 commits

## Reste à faire — voir INTEGRATIONS.md

Tout le travail "additionnel" qui n'est pas du code dans le repo :
- **App mobile intervenant** (React Native) — non développée
- **Comptes externes** à créer : Pennylane prod, Mailgun, Twilio, FCM Firebase, Yousign
- **SEPA** : génération XML (mandats + ordres)
- **Hardware** : impression QR codes physiques pour les adresses
- **Prod** : MariaDB, CORS strict, queue worker, Sentry, backups, RGPD/DPA
- **Tests E2E** : Playwright

## Review session 2026-05-19 — Audit complet + Phases A→F livrées

**Contexte** : avant cette session, le projet était "fonctionnellement complet" (157 routes, 10 phases) mais jamais audité sous l'angle sécurité/RGPD/cohérence schéma. Demandé un tour complet.

**Méthode** : 11 sous-agents en parallèle (2 vagues), format strict `[SEV] file:line — bug + preuve`, max 25 items/agent. Résultat consolidé : **~250 bugs (37 CRIT, 81 HIGH, 78 MED, 54 LOW)**. ~30 min de wall-clock pour l'audit complet.

**Volume corrigé** : ~50 bugs CRIT/HIGH en 5 commits sur la même journée.

**Top failles neutralisées** :
1. Rôles `client`/`intervenant` avaient les permissions admin (`sales.*.view`, `planning.view`) → leak inter-tenants total
2. Documents stockés sur disk `public` symlinké → accessibles sans auth via URL directe + `file_path` exposé en JSON
3. Salaires loggés en clair dans `activity_log` (Contract `logFillable`)
4. CORS wildcard `/.*/` + credentials → CSRF cross-origin trivial
5. TVA 20% hardcodée partout, numérotation `count()+1` race condition, over-allocation règlements non détectée
6. Télégestion totalement cassée (front/back schemas incompatibles)
7. FCM push mort silencieusement (token=null hardcodé + endpoint déprécié)
8. Matching skills jamais fonctionnel ($requiredSkillIds=[] hardcodé)
9. `MessageThreadParticipant` sans primary key
10. ClientPortalController sans ownership check (client A pouvait voir réclamations de B)

**Décisions structurantes prises** :
- **Séparer endpoints admin vs extranet stricto sensu** : les rôles non-admin ne possèdent QUE les permissions de leur extranet. Pas de partage.
- **Pattern `enforceEmployeeScope()`** : pour les endpoints de planning summary partagés admin/intervenant, force le filtre côté backend si non-admin.
- **`Storage::disk('local')` obligatoire pour tout upload** : jamais `public`. Download via controller avec ownership.
- **Toujours `logFillable()->logExcept([...])`** sur les models Spatie ActivityLog (salaires, secrets, IBAN).
- **CORS env-aware** dès la création du fichier, pas en TODO.
- **Numérotation atomique via `DocumentSequenceService`** + table `document_sequences` (lockForUpdate). Plus de `count()+1`.

**LRN ajoutés au Brain** : LRN-099 (permissions vs ownership), LRN-100 (storage public CRIT), LRN-101 (logFillable trompeur), LRN-102 (CORS wildcard CSRF), LRN-103 (méthode audit massif sous-agents parallèles).

**État technique au soir** :
- ~165 routes V1 (ajout `extranet/*` + endpoints existants verrouillés)
- 88 migrations (+8 cette session)
- ~95 modèles
- 0 erreur TypeScript
- Working tree clean

## Review session 2026-05-12 — finale

**Volume** : 9 phases complètes en 2 sessions.

**Stack finale** :
- ~157 routes V1
- 80+ migrations, 85+ modèles Eloquent
- 14+ pages frontend (clients, intervenants, planning, carte, stock, télégestion, portail, messagerie, flotte, devis, factures, règlements, prestations, dashboard)
- 0 erreur TypeScript
- Auto-géocodage BAN, matching composite, Factur-X EN16931, Pennylane sync, FCM/Twilio/Mail jobs

**Décisions structurantes** :
- Notification : 3 jobs séparés (push/email/SMS) plutôt qu'un dispatcher en ligne → permet retry/backoff par canal
- Matching : score composite hardcodé 40/30/20/10 → simple et expliquable, ajustable plus tard
- Géocodage : observer sur le model Address → transparent pour toutes les sources (création, update, import)
- Messagerie : participants comme model standard (pas Pivot Spatie/Eloquent) → besoin d'updater last_read_at indépendamment

## 🎫 2026-05-21 — Fil de discussion dans les tickets (ClientRequest)

Objectif : transformer les tickets en outil d'échange avec fil de discussion,
affectation d'intervenant(s), accès des 3 publics (admin/client/intervenant).

### Plan
- [ ] Migration `client_request_messages` (chat) — idempotente PG/SQLite
- [ ] Migration `client_request_employee` (pivot affectation) — unique composite
- [ ] Modèle `ClientRequestMessage` + relations `ClientRequest::messages()` / `assignedEmployees()`
- [ ] `ClientRequestMessageObserver` → notifie tous les participants sauf l'auteur
- [ ] `NotificationTypesSeeder` : type `client_request_message` (idempotent)
- [ ] Endpoints admin : GET/POST messages + attach/detach intervenants
- [ ] Endpoints extranet client : list/post message (ownership strict)
- [ ] Endpoints extranet intervenant : list tickets affectés/créés + list/post message
- [ ] Routes api.php
- [ ] Frontend : hooks messages + intervenants + extranet
- [ ] Frontend : fil de discussion dans TicketDetailPage (admin) + gestion intervenants
- [ ] Frontend : fil dans extranet client + intervenant
- [ ] Frontend : onglet tickets fiche intervenant (admin)
- [ ] Vérif : php -l, tsc, migrate, tinker, navigateur

### Review (vérifié end-to-end via tinker + HTTP + navigateur réel)

**Migrations** (idempotentes `Schema::hasTable`, PostgreSQL/SQLite, rollback+up testé) :
- `2026_05_21_160000_create_client_request_messages_table` — fil de discussion
  (`client_request_id` cascade, `sender_id` nullOnDelete, `body` text, index).
- `2026_05_21_160100_create_client_request_employee_table` — pivot affectation
  intervenants (`client_request_id`+`employee_id` cascade, unique composite).

**Backend** :
- `ClientRequestMessage` + relations `ClientRequest::messages()` / `assignedEmployees()`
  + helper `participantUserIds()` (client owner + créateur + assigned_to + admins
  + intervenants affectés).
- `ClientRequestMessageObserver` → notif `client_request_message` à TOUS les
  participants sauf l'auteur (point d'émission unique).
- `NotificationTypesSeeder` : types `client_request_message` + `client_request_assigned`.
- Endpoints admin : `GET/POST /client-requests/{id}/messages`,
  `POST /client-requests/{id}/employees`, `DELETE .../employees/{empId}`,
  `GET /employees/{id}/client-requests` (tickets affectés OU créés).
- Endpoints extranet client : `GET/POST /extranet/client/tickets/{id}/messages`
  — ownership strict (ticket.client_id == client lié au portal_user_id).
- Endpoints extranet intervenant : idem + `intervenantTickets` étendu aux
  tickets affectés. Ownership strict (créateur OU affecté → sinon 403).

**Frontend** :
- `TicketThread` (composant partagé 3 publics) : bulles alignées, auto-scroll,
  Ctrl+Entrée, disabled si ticket clôturé.
- TicketDetailPage admin : fil de discussion + `AssignedEmployeesCard`
  (affecter/retirer intervenant, picker, notif auto).
- ClientPortalTab (fiche client admin) : onglet Réclamations cliquable → dialog fil.
- EmployeeFichePage : onglet "Tickets" (affectés + créés, deep-link).
- Extranet client/intervenant : lignes ticket cliquables → dialog fil.

**Preuve des tests** :
- HTTP : POST message admin 201, GET/POST client (son ticket) 200/201,
  intervenant affecté 200, ownership non-participant → 403, attach/detach 200.
- Navigateur réel : admin poste message + affecte Adeline Muret (Intervenants 1) ;
  client extranet ouvre son ticket, voit le fil, répond ; intervenant affecté
  voit le ticket, lit le message client, répond. 0 erreur console.
- Notifs : client poste → 2 notifs (admin+intervenant, pas l'auteur) ;
  intervenant poste → 2 notifs (admin+client). Auteur toujours exclu. 4 total.
- Cascade delete ticket → messages + pivot purgés. Migration rollback+up OK.
- `php -l` 0 erreur, `tsc --noEmit` 0 erreur, suite de tests 2/2.

---

## 2026-05-22 — Lot planning + extranet intervenant (D1/D2/D3/F1/B6+F2)

- [x] D2 — helper `statusColor(iv)` + légende planning (a_pourvoir orange,
      planifiee bleu, realisee+checkin vert, realisee sans checkin violet,
      annulee rouge, draft/terminated gris).
- [x] D3 — `handleValidateBadge` : payload aligné sur `manualEntry`
      (employee_id + checkin_time naïf + comment) + PATCH status 'realisee'.
- [x] D1 — sélecteur d'adresse dans `CreateInterventionDialog` (hook
      `useClientAddresses`) + `address_id` au payload.
- [x] F1 — `intervenantPlanning` retire unit_price/pricing_type/billing_type
      + flags facturation ; `EventTooltip` prop `hidePricing`.
- [x] B6+F2 — migration `intervenant_notes` (clients), model/Requests/Resource,
      champ éditable fiche client, exposé extranet + affiché dans `EventTooltip`
      (Note interne RDV + Consignes client).

### Review
- `php -l` : 0 erreur sur les 8 fichiers PHP touchés.
- `tsc --noEmit` : 24 erreurs = baseline (aucune nouvelle, 0 sur mes fichiers).
- Migration NON appliquée (à lancer manuellement). Pas de commit.

---

## 2026-05-22 — G1 : Centre de notifications (page dédiée)

- [x] Backend `NotificationController::history` — endpoint paginé+filtrable
      SÉPARÉ (la cloche garde `index`, intacte). Filtres `status`/`type`/
      `search`, `per_page` 25 (max 100), tri récent d'abord, eager-load
      `notificationType`.
- [x] Backend `NotificationController::types` — référentiel léger des types
      actifs (alimente le filtre).
- [x] Routes `GET /notifications/history` + `/notifications/types` dans le
      groupe auth notifications.
- [x] Hook `useNotificationHistory(params)` + `useNotificationTypes` dans
      `use-operations.ts` ; mutations `useMarkRead`/`useMarkAllRead` réutilisées.
- [x] Page `pages/notifications/NotificationCenterPage.tsx` : PageHeader,
      filtres tout/non lues/lues + type (groupé par module) + recherche,
      liste paginée avec icône/couleur via `notification-styles.ts`, badge
      « Non lu », deep-link au clic (logique de la cloche), bouton « Tout
      marquer comme lu », Skeleton + état vide.
- [x] Route `/notifications` dans `App.tsx` (layout admin) + entrée sidebar
      « Notifications » (icône `Bell`, groupe Administration).
- [x] Lien « Voir toutes les notifications » en bas du dropdown de la cloche
      (admin uniquement — les extranets n'ont pas la route).
- [x] `notification-styles.ts` : ajout des styles manquants
      `client_request_message` + `client_request_assigned` (module Ticket).

### Review
- La cloche reste intacte : `NotificationsBell` consomme toujours
  `useNotifications` → `/notifications` (`index`, limité à 50). Le nouvel
  endpoint `history` est totalement séparé. Seul ajout au composant cloche :
  un lien de bas de panneau, sans toucher au rendu des notifications.
- Fix au passage : l'injection dynamique de « Utilisateurs » (super_admin)
  dans la sidebar reposait sur `g.items[0]` = Paramètres ; l'ajout de
  « Notifications » en tête du groupe l'aurait cassée → remplacé par une
  recherche de l'index de `/parametres`.
- `php -l` : 0 erreur (NotificationController, api.php).
- `tsc --noEmit` : 24 erreurs = baseline (aucune nouvelle, 0 sur mes fichiers).
- Pas de migration nécessaire. Pas de commit.
