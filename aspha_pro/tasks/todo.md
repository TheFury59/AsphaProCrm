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
