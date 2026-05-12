# Aspha Pro — Todo

## Phases livrées (✅)

- [x] **Phase 0** — Bootstrap Laravel 11 + Sanctum + Vite/React + Tailwind v4 + shadcn
- [x] **Phase 1** — Schéma BDD (78 migrations, 76 modèles, soft deletes, audit log, polymorphes)
- [x] **Phase 2** — Clients / Intervenants / Prestations
- [x] **Phase 2.5 Sprint A** — Contacts, adresses polym., absences, clés, documents, compétences, formations
- [x] **Phase 2.5 Sprint B** — Contrats intervenant + saisies sur salaire
- [x] **Phase 3** — Planning (FullCalendar + drag-drop), récurrences matérialisées via `InterventionExpander`, Ventes (Devis/Factures/Règlements), Factur-X PDF/A-3, sync Pennylane (mock + réel)
- [x] **Phase 4** — Télégestion : QR codes, badgeages, saisie manuelle admin
- [x] **Phase 5** — Portail client : réclamations + réassorts + signatures + contrôles qualité
- [x] **Phase 6** — Stock par entité : produits, mouvements, alertes seuil
- [x] **Cartographie** Leaflet (clients/intervenants/interventions)
- [x] **Notifications** : bell topbar + unread count + mark read

## Reste à faire

- [ ] **Phase 7** — Messagerie mobile-first
- [ ] **Phase 8** — Notifications multi-canal (jobs push/email/SMS)
- [ ] **Phase 9** — Gestion flotte véhicule
- [ ] **Phase 10** — Matching auto intervenant (skills + proximité + dispo)
- [ ] Édition inline des champs principaux dans les fiches (au-delà des dialogs)
- [ ] Génération SEPA (mandats + ordres XML)
- [ ] Tests E2E Playwright

## Review (session 2026-05-12)

**Objectif** : enchaîner toutes les phases 4-6 + carte + drag-drop occurrences + notifications.

**Livré** :
- Drag-and-drop d'une occurrence virtuelle crée automatiquement une exception sur la série (UX clé)
- 4 nouveaux controllers backend (TelemanagementController, ClientPortalController, StockController, NotificationController)
- 4 nouvelles pages UI (Stock, Télégestion, Portail, Carte) avec dialogs CRUD complets
- NotificationsBell dans le topbar avec polling
- Sidebar étendue (groupe "Opérations" + Carte)
- ~30 routes API ajoutées

**Métriques** : ~125 routes V1, 78 migrations, 76 modèles, frontend tsc clean.
