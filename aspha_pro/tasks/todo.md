# Aspha Pro — Todo

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
