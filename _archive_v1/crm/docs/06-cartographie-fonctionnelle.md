# Cartographie fonctionnelle — Audit Ximi → Aspha CRM

> **Statut** : v0.1 — premier passage sur les menus *CLIENTS*, *RH*, *PLANIFICATION*, *TÉLÉGESTION*, *VENTES* de Ximi.
> Les sections *ÉTATS/DÉCLARATIONS*, *CORRESPONDANCE*, *ORGANISATION*, *RAPPORTS* seront ajoutées ultérieurement.

## Méthodologie

Pour chaque entrée du menu Ximi, on prend une décision parmi :

| Pictogramme | Décision |
|---|---|
| ✅ | Garder en l'état dans Aspha CRM |
| 🔀 | Garder mais **fusionner** avec une autre entrée (onglet, vue détail, sous-section) |
| ❌ | **Supprimer** — hors périmètre Aspha |
| ❓ | **À clarifier** avec la cliente avant arbitrage |

À la fin de chaque section, le **menu cible Aspha** liste ce qui sera développé.

---

## 1. CLIENTS

> **Élargissement Aspha** : les clients peuvent désormais être des **entreprises** (pas uniquement des particuliers comme historiquement chez Aspha).

### Audit Ximi

| Entrée Ximi | Décision | Notes |
|---|---|---|
| Clients | ✅ | Élargi : `type ∈ {individual, company}` |
| Missions | ❌ | Terminologie Ximi non reprise par Aspha |
| Prestations | ✅ | Catalogue de services attribuables aux clients |
| Prises en charge | ❌ | Concept paramédical (CPAM, mutuelle) hors périmètre |
| Modalités de Prises en charge | ❌ | Idem |
| Mandats SEPA | ❌ | Sera géré dans Pennylane (comptabilité externe) |
| Enfants | ❌ | Concept Ximi non applicable |
| Absences client | 🔀 | Fusion avec « Absences client périodiques » sous une seule entrée avec deux onglets |
| Absences client périodiques | 🔀 | Idem |
| Mesures de protection | ❌ | Tutelle/curatelle — hors périmètre |
| Clés | 🔀 | Fusion avec « Mouvements de clés » : la fiche clé contient l'onglet "Historique des mouvements" |
| Mouvements de clés | 🔀 | Idem |
| Tiers-payeurs | ❌ | Pas de tiers-payeur chez Aspha |
| Heures de régularisation | ❌ | Sera géré dans la facturation |

### Menu cible Aspha

```
CLIENTS
├── Clients              (particuliers + entreprises)
├── Prestations          (catalogue de services)
├── Clés                 (avec onglet « Historique des mouvements »)
└── Absences client      (avec onglets « Ponctuelles » / « Périodiques »)
```

---

## 2. RH

### Audit Ximi

| Entrée Ximi | Décision | Notes |
|---|---|---|
| Intervenants | ✅ | = salariés Aspha (terme « intervenant » conservé pour cohérence métier) |
| Formations | ✅ | Conservé — sera utilisé en phase ultérieure (validation cliente) |
| Absences intervenant | 🔀 | Fusion avec « Détails d'absences intervenant » : une seule vue avec liste + détail au clic |
| Détails d'absences intervenant | 🔀 | Idem |
| Diplômes intervenant | ❌ | Hors périmètre (peut-être à reprendre dans Formations plus tard) |
| Complémentaires santé | ❌ | Géré par la paie (Silae) |
| Temps partiels thérapeutiques | ❌ | Géré par la paie (Silae) |
| Indemnités journalières | ❌ | Géré par la paie (Silae) |
| Saisies sur salaire | ✅ | Conservé |

### Menu cible Aspha

```
RH
├── Intervenants
├── Formations              (alimentation progressive — phase ultérieure)
├── Absences intervenant    (vue unique avec détail)
└── Saisies sur salaire
```

---

## 3. PLANIFICATION

> **Tout est conservé** — c'est le cœur métier d'Aspha, le module Ximi à reproduire fidèlement.

### Audit Ximi

| Entrée Ximi | Décision | Notes |
|---|---|---|
| Planning | ✅ | Vue calendrier principale (timeGrid + drag-and-drop) |
| Interventions | ✅ | Liste tabulaire des appointments (ponctuelles) |
| Interventions périodiques | ✅ | Liste des `service_assignments` récurrents |
| Historique intervenants | ✅ | Vue passée du planning par intervenant |
| Dispos / Indispos | ✅ | Disponibilités/indisponibilités ponctuelles |
| Dispos / Indispos périodiques | ✅ | Récurrentes |
| Événements intervenant | ✅ | Évènements spécifiques (formation, RDV médical, etc.) |
| Événements intervenant périodiques | ✅ | Récurrents |
| Carte | ✅ | Cartographie clients + intervenants (Leaflet + Google Distance Matrix) |

### Menu cible Aspha

```
PLANIFICATION
├── Planning                              (vue calendrier — cœur du CRM)
├── Interventions                         (ponctuelles)
├── Interventions périodiques             (récurrentes)
├── Historique intervenants
├── Dispos / Indispos
├── Dispos / Indispos périodiques
├── Événements intervenant
├── Événements intervenant périodiques
└── Carte
```

> **Note technique** : « Interventions », « Interventions périodiques », « Dispos », « Événements » et leurs variantes périodiques peuvent partager une logique commune via l'entité `service_assignment` étendue + types d'évènement (intervention / dispo / événement).

---

## 4. TÉLÉGESTION

> **Tout conservé pour l'instant** — pas encore tous les détails fonctionnels côté cliente. Recap à venir.

### Audit Ximi

| Entrée Ximi | Décision | Notes |
|---|---|---|
| Télégestion | ✅ | Module global de pointage QR (= QR scans dans notre BDD) |
| Messagerie | ✅ | Échanges intervenant ↔ administration |
| Messages de Télégestion | ✅ | Messages liés au pointage spécifiquement |
| Codes de Télégestion | ✅ | Référentiel des codes/QR codes (= notre table `qr_codes`) |
| Connexions mobiles | ✅ | Suivi des sessions mobiles intervenants |

### Menu cible Aspha

```
TÉLÉGESTION
├── Télégestion              (vue principale — historique badgeages)
├── Messagerie               (chat/notifications)
├── Messages de Télégestion  (messages liés à un badgeage)
├── Codes de Télégestion     (= QR codes par adresse)
└── Connexions mobiles       (sessions actives intervenants)
```

> **À clarifier avec la cliente** : différence exacte entre « Messagerie » (général) et « Messages de Télégestion » (lié au pointage), pour valider qu'il faut bien deux modules distincts ou si on peut fusionner.

---

## 5. VENTES

> **Principe** : on **fusionne les "articles"** dans la fiche parente (Devis/Facture) — un devis affiche directement ses lignes dans la même page (pas une entrée de menu séparée). On **regroupe** les encaissements liés (Règlements / SEPA / Bordereaux) sous une seule rubrique.

### Audit Ximi

| Entrée Ximi | Décision | Notes |
|---|---|---|
| Devis | ✅ | |
| Articles de devis | 🔀 | Affichés inline dans la page d'un devis (lignes du devis) |
| Factures | ✅ | |
| Articles de facture | 🔀 | Affichés inline dans la page d'une facture |
| Règlements | 🔀 | Regroupés dans **« Encaissements »** |
| Prélèvements SEPA | 🔀 | Regroupés dans **« Encaissements »** |
| Ventilations | ❓ | À clarifier : est-ce de la ventilation comptable analytique ? Si oui, **probablement à externaliser dans Pennylane** plutôt que dans le CRM |
| Bordereaux | 🔀 | Regroupés dans **« Encaissements »** (bordereaux de remise) |

### Menu cible Aspha

```
VENTES
├── Devis                       (fiche complète avec lignes inline)
├── Factures                    (fiche complète avec lignes inline)
└── Encaissements
    ├── Règlements              (paiements reçus)
    ├── Prélèvements SEPA       (mandats + opérations)
    └── Bordereaux              (remise de chèques / espèces)
```

> **Note** : si le sous-menu « Encaissements » paraît trop profond pour 3 entrées, on peut aussi mettre les 3 à plat avec un préfixe visuel (ex. « Encaissements › Règlements »).

> **À clarifier — Ventilations** : à valider avec la cliente. Trois interprétations possibles :
> 1. **Ventilation comptable** (répartition par compte/centre de coût) → externaliser dans Pennylane
> 2. **Ventilation des règlements** (un règlement applicable à plusieurs factures) → garder, sous Encaissements
> 3. **Autre** → demander à la cliente

---

## Synthèse — Menu Aspha CRM cible (parties auditées)

```
┌── CLIENTS
│    ├── Clients
│    ├── Prestations
│    ├── Clés
│    └── Absences client
│
├── RH
│    ├── Intervenants
│    ├── Formations
│    ├── Absences intervenant
│    └── Saisies sur salaire
│
├── PLANIFICATION
│    ├── Planning
│    ├── Interventions
│    ├── Interventions périodiques
│    ├── Historique intervenants
│    ├── Dispos / Indispos
│    ├── Dispos / Indispos périodiques
│    ├── Événements intervenant
│    ├── Événements intervenant périodiques
│    └── Carte
│
├── TÉLÉGESTION
│    ├── Télégestion
│    ├── Messagerie
│    ├── Messages de Télégestion
│    ├── Codes de Télégestion
│    └── Connexions mobiles
│
└── VENTES
     ├── Devis
     ├── Factures
     └── Encaissements
          ├── Règlements
          ├── Prélèvements SEPA
          └── Bordereaux
```

**Volumétrie** : 5 sections, 21 entrées de menu (vs 51 dans Ximi pour ces mêmes 5 sections → réduction d'environ 60%).

---

## Sections en attente d'arbitrage cliente

Ces 4 sections Ximi nécessitent une **discussion préalable avec la cliente** avant de prendre les décisions de cartographie. Elles seront documentées dans une prochaine version de ce fichier après le prochain rendez-vous.

| Section Ximi | Statut | À aborder |
|---|---|---|
| ÉTATS / DÉCLARATIONS | ⏸ En attente cliente | Quels états/déclarations sont réellement utilisés ? Lesquels remplacés par Pennylane / Silae ? |
| CORRESPONDANCE | ⏸ En attente cliente | Périmètre : courriers types ? mailing ? historique d'envoi ? |
| ORGANISATION | ⏸ En attente cliente | Paramétrage agence (sites, équipes, droits) — déjà partiellement couvert par notre module Rôles |
| RAPPORTS | ⏸ En attente cliente | Quels rapports sont vraiment exploités au quotidien ? Format (PDF/Excel) ? Fréquence ? |

---

## Points à clarifier avec la cliente

| # | Sujet | Question |
|---|---|---|
| Q1 | TÉLÉGESTION — Messagerie vs Messages de Télégestion | Différence exacte ? Faut-il deux modules ou un seul ? |
| Q2 | VENTES — Ventilations | À quoi sert cette entrée précisément ? Comptable ou applicative ? |
| Q3 | RH — Diplômes intervenant | Vraiment hors périmètre ou à intégrer dans Formations en phase 2 ? |
| Q4 | CLIENTS — Heures de régularisation | Confirmer que le besoin est couvert par la facturation (ajustements) |
| Q5 | RH — Saisies sur salaire | Faut-il un suivi détaillé dans le CRM ou simple champ libre dans la fiche intervenant ? |
| Q6 | ÉTATS / DÉCLARATIONS | Lister les états/déclarations réellement utilisés au quotidien |
| Q7 | CORRESPONDANCE | Périmètre attendu : modèles de courriers ? envoi mail ? historique ? |
| Q8 | ORGANISATION | Détailler le besoin de paramétrage agence (sites, équipes, droits) au-delà du module Rôles déjà prévu |
| Q9 | RAPPORTS | Lister les rapports indispensables et leur format/fréquence cible |

---

## Historique des décisions

| Date | Auteur | Décisions |
|---|---|---|
| 2026-04-30 | Téo Debay | Premier passage : 5 sections (CLIENTS, RH, PLANIFICATION, TÉLÉGESTION, VENTES) |
| 2026-04-30 | Téo Debay | Sections ÉTATS/DÉCLARATIONS, CORRESPONDANCE, ORGANISATION, RAPPORTS marquées en attente d'arbitrage cliente |
