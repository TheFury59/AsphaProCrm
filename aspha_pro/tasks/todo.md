# Aspha Pro — Todo

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
- [ ] TVA dynamique (champ `vat_rate_id` sur QuoteItem/InvoiceItem au lieu de 20% hardcodé)
- [ ] Numérotation atomique (lock + table de séquence)
- [ ] Anti-double conversion devis→facture (champ `invoice_id` sur Quote)
- [ ] Over-allocation règlement (check `sum(allocations) ≤ amount` + `sum ≤ remaining_to_pay`)
- [ ] Pennylane idempotence + customer_id mapping
- [ ] Factur-X : 422 explicite si SIRET émetteur manquant
- [ ] Cascade `Invoice.destroy` / `Reglement.destroy` (purge allocations)

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

## Reste à faire — voir INTEGRATIONS.md

Tout le travail "additionnel" qui n'est pas du code dans le repo :
- **App mobile intervenant** (React Native) — non développée
- **Comptes externes** à créer : Pennylane prod, Mailgun, Twilio, FCM Firebase, Yousign
- **SEPA** : génération XML (mandats + ordres)
- **Hardware** : impression QR codes physiques pour les adresses
- **Prod** : MariaDB, CORS strict, queue worker, Sentry, backups, RGPD/DPA
- **Tests E2E** : Playwright

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
