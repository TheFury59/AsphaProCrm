<?php

namespace Database\Seeders;

use App\Models\HelpArticle;
use Illuminate\Database\Seeder;

/**
 * Catalogue de documentation utilisateur in-app pour Aspha Pro.
 *
 * Pattern : updateOrCreate(['slug' => ...]) → re-run safe (idempotent).
 * Toujours conserver ce pattern ; pour étendre, ajouter un article au tableau
 * `$articles` avec un slug unique. Les `body` sont en Markdown via heredoc
 * nowdoc <<<'MD' ... MD pour ne pas avoir à échapper $ ni les guillemets.
 *
 * Convention captures d'écran (à insérer par le dev quand les images existent) :
 *   > 📸 *Capture d'écran à venir : [description courte]*
 *
 * Audiences : all | admin | intervenant | client | encadrement
 */
class HelpArticlesSeeder extends Seeder
{
    public function run(): void
    {
        $articles = $this->articles();

        foreach ($articles as $a) {
            HelpArticle::updateOrCreate(
                ['slug' => $a['slug']],
                $a + ['published' => true],
            );
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function articles(): array
    {
        return [
            // ============================================================
            // DÉMARRAGE (4)
            // ============================================================
            [
                'slug' => 'demarrage-premiere-connexion',
                'title' => 'Se connecter pour la première fois',
                'summary' => "Accéder à Aspha Pro avec ton identifiant et ton mot de passe initial.",
                'category' => 'demarrage',
                'audience' => 'all',
                'display_order' => 10,
                'body' => <<<'MD'
# Se connecter pour la première fois

Bienvenue dans Aspha Pro. Cette page t'explique comment te connecter pour la
première fois à l'ERP, que tu sois administrateur, intervenant ou client.

## Étapes

1. Ouvre l'URL communiquée par ton administrateur (par exemple
   `https://aspha.exemple.com`). La page de connexion s'affiche.
2. Saisis ton **adresse e-mail** professionnelle (celle qui a été utilisée pour
   créer ton compte).
3. Saisis le **mot de passe temporaire** reçu par e-mail (objet « Accès à votre
   espace Aspha Pro »). Il est généré aléatoirement, copie-le tel quel.
4. Clique sur **Se connecter**.

> 📸 *Capture d'écran à venir : écran de login Aspha Pro*

À la première connexion, l'application te demandera **obligatoirement** de
changer ce mot de passe temporaire pour un mot de passe personnel. Tu es alors
redirigé sur la page d'accueil correspondant à ton rôle :

- **Admin / super-admin** : tableau de bord
- **Intervenant** : extranet intervenant (planning du jour)
- **Client** : extranet client (accueil)

## À savoir

- Le mot de passe temporaire **n'est affiché qu'une seule fois** côté admin
  lorsque ton compte est créé. S'il a été perdu, demande à ton admin de le
  régénérer (un nouveau sera envoyé par e-mail).
- L'application bloque les comptes marqués comme **inactifs** : si tu vois
  « Compte désactivé » à la connexion, contacte ton administrateur.
- Les sessions sont sécurisées par un cookie ; si tu fermes l'onglet, tu seras
  reconnecté automatiquement tant que tu n'as pas explicitement cliqué sur
  **Se déconnecter**.

## Astuces

- Coche la case « Se souvenir de moi » sur ton ordinateur personnel pour rester
  connecté plus longtemps.
- Si tu reçois une erreur « Identifiants invalides » alors que tu es certain
  d'eux, vérifie qu'il n'y a pas d'espace en début/fin de saisie (cas fréquent
  avec un copier-coller depuis l'e-mail).

**Voir aussi :** [Changer son mot de passe](#) · [Tour rapide de l'ERP](#)
MD,
            ],
            [
                'slug' => 'demarrage-changer-mot-passe',
                'title' => 'Changer son mot de passe',
                'summary' => "Modifier ton mot de passe lors de la première connexion ou à tout moment depuis ton profil.",
                'category' => 'demarrage',
                'audience' => 'all',
                'display_order' => 20,
                'body' => <<<'MD'
# Changer son mot de passe

Aspha Pro impose un changement de mot de passe à la première connexion et te
laisse en changer à tout moment depuis ton profil.

## Cas n°1 — Changement forcé à la 1re connexion

Immédiatement après ta toute première connexion, l'application affiche un
écran dédié « Changer votre mot de passe ». Tu ne peux pas accéder au reste
de l'ERP tant que tu n'as pas effectué ce changement.

1. Saisis ton **mot de passe actuel** (le temporaire reçu par e-mail).
2. Saisis ton **nouveau mot de passe** (8 caractères minimum, recommandé :
   12+ avec majuscule, chiffre et caractère spécial).
3. Confirme-le dans le champ **Confirmation**.
4. Clique sur **Mettre à jour**.

> 📸 *Capture d'écran à venir : écran de changement forcé du mot de passe*

Tu es ensuite redirigé sur la page d'accueil correspondant à ton rôle.

## Cas n°2 — Changement volontaire depuis /profil

À tout moment, tu peux modifier ton mot de passe :

1. Clique sur ton **avatar** en haut à droite de l'écran.
2. Choisis **Mon profil** dans le menu déroulant.
3. Sur la page profil, descends jusqu'à la carte **Sécurité**.
4. Renseigne ton **mot de passe actuel** puis le **nouveau** (deux fois).
5. Clique sur **Enregistrer**.

> 📸 *Capture d'écran à venir : carte Sécurité de la page Mon profil*

## À savoir

- Le mot de passe est **chiffré** dans la base de données. Personne, pas même
  ton administrateur, ne peut le lire en clair.
- En cas d'oubli, ton admin peut **régénérer** un mot de passe temporaire (qui
  te sera envoyé par e-mail). L'ancien sera invalidé immédiatement.
- Évite de réutiliser un mot de passe déjà utilisé pour un autre service.

## Astuces

- Utilise un **gestionnaire de mots de passe** (Bitwarden, 1Password, le
  trousseau du navigateur) pour ne jamais avoir à mémoriser le mot de passe.
- Si ton entreprise utilise une politique de rotation, planifie un rappel
  trimestriel dans ton agenda.

**Voir aussi :** [Première connexion](#) · [Gestion des utilisateurs](#)
MD,
            ],
            [
                'slug' => 'demarrage-mon-entreprise',
                'title' => 'Configurer son entreprise (Mon entreprise)',
                'summary' => "Renseigner les informations légales de ton entreprise pour qu'elles apparaissent sur les devis et factures.",
                'category' => 'demarrage',
                'audience' => 'admin',
                'display_order' => 30,
                'body' => <<<'MD'
# Configurer son entreprise

L'écran **Paramètres → Mon entreprise** centralise les informations légales et
de contact de ton entité (raison sociale, SIRET, TVA intracommunautaire,
adresse, coordonnées). Ces informations alimentent automatiquement les
**en-têtes de devis et de factures PDF** : il est donc essentiel de les
renseigner avant d'éditer ton premier document commercial.

## Étapes

1. Ouvre le menu **Paramètres** dans la sidebar de gauche.
2. Clique sur l'onglet **Mon entreprise** (premier onglet).
3. Renseigne les champs ci-dessous, puis clique sur **Enregistrer** en bas.

### Champs disponibles

| Champ | Description |
|---|---|
| Raison sociale | Le nom légal qui apparaîtra sur tes PDF (ex. *Aspha Services SAS*). |
| Forme juridique | SAS, SARL, EI, etc. |
| SIRET | 14 chiffres, **obligatoire** pour la Factur-X B2B. |
| TVA intracommunautaire | Format `FR` + 11 chiffres. Obligatoire B2B. |
| Capital social | Affiché sur les factures (ex. *10 000 €*). |
| Adresse, code postal, ville, pays | Adresse du siège social. |
| Téléphone, e-mail, site web | Contacts affichés sur les PDF. |
| Logo | Image PNG ou JPG, max 2 Mo, **recommandé 400×120 px** pour un rendu net. |
| Coordonnées GPS | Latitude/longitude (auto-géocodées depuis l'adresse). |

> 📸 *Capture d'écran à venir : onglet Mon entreprise complété*

## À savoir

- **Le SIRET et le numéro de TVA sont indispensables** pour la conformité
  Factur-X (norme EN 16931). Sans eux, la génération d'une facture B2B au
  format Factur-X est bloquée par un message explicite (HTTP 422).
- Le logo doit être au format **PNG transparent** de préférence (rendu propre
  sur fond clair comme sur fond imprimé).
- Les coordonnées GPS sont calculées automatiquement par le géocodeur BAN
  (Base Adresse Nationale) ; tu peux les corriger manuellement.

## Astuces

- Si tu opères avec **plusieurs entités juridiques** (Aspha Pro Lille, Aspha
  Pro Lyon...), une page admin dédiée permet d'en créer plusieurs. Sur chaque
  client tu choisis ensuite à quelle entité il est rattaché.
- Vérifie immédiatement le rendu d'une facture après modification : génère un
  PDF de test depuis Ventes → Factures → un brouillon → bouton PDF.

**Voir aussi :** [Créer une facture](#) · [PDF Factur-X / Pennylane](#)
MD,
            ],
            [
                'slug' => 'demarrage-tour-rapide',
                'title' => 'Tour rapide : où trouver quoi dans l\'ERP ?',
                'summary' => "Survol des modules principaux d'Aspha Pro pour s'orienter rapidement.",
                'category' => 'demarrage',
                'audience' => 'admin',
                'display_order' => 40,
                'body' => <<<'MD'
# Tour rapide de l'ERP

Avant de plonger dans les détails, voici une vue d'ensemble des principaux
modules d'Aspha Pro et de leur emplacement dans la sidebar de gauche.

## Modules essentiels

| Module | Description | Pour qui |
|---|---|---|
| **Tableau de bord** | Vue d'ensemble (KPI, RDV du jour, alertes). | Admin |
| **Clients** | Annuaire clients, fiches, contrats, contacts, adresses. | Admin |
| **Intervenants** | Annuaire intervenants, contrats, compétences, notation. | Admin |
| **Missions** | Contrats de prestation client (parent des prestations récurrentes). | Admin |
| **Planning** | Calendrier de tous les RDV (jour/semaine/mois). | Admin, intervenant |
| **Ventes** | Devis, factures, règlements, prestations catalogue. | Admin |
| **Stock** | Produits consommables/matériel + mouvements d'inventaire. | Admin |
| **Tickets** | Réclamations, signalements, suivi qualité. | Admin, client, intervenant |
| **Messagerie** | Conversations internes admin ↔ intervenants. | Admin, intervenant |
| **Documents** | Documents clients/intervenants/internes + renouvellement. | Admin |
| **Notifications** | Cloche en haut à droite + centre de notifications. | Tous |
| **Carte** | Visualisation géographique des clients & intervenants. | Admin |
| **Flotte** | Véhicules de société + affectations. | Admin |
| **Télégestion** | QR codes, badgeages, saisies manuelles. | Admin |
| **Paramètres** | Mon entreprise, permissions, documents requis. | Admin |
| **Aide** | Cette documentation 🙂. | Tous |

> 📸 *Capture d'écran à venir : sidebar admin avec les modules visibles*

## Workflow type d'utilisation

1. **Créer un client** depuis Clients → Nouveau client.
2. **Lui créer une mission** (contrat de prestation) depuis sa fiche.
3. **Ajouter des prestations** à cette mission (récurrentes ou ponctuelles).
4. **Affecter un intervenant** à chaque prestation.
5. Les **RDV apparaissent automatiquement** dans le planning à l'horizon choisi.
6. L'intervenant **badge** (QR code ou saisie manuelle).
7. Tu **génères la facture** et le **règlement** depuis Ventes.

## Astuces

- Les **raccourcis clavier** ne sont pas (encore) déployés, mais la barre de
  recherche globale arrive bientôt.
- La **sidebar peut être pliée** (icône en haut à gauche) si tu veux maximiser
  l'espace de travail.
- Toutes les listes (clients, intervenants, RDV…) sont **filtrables** et
  exportables CSV pour partage avec ton expert-comptable ou ton DAF.

**Voir aussi :** [Configurer son entreprise](#) · [Créer un nouveau client](#)
MD,
            ],

            // ============================================================
            // DASHBOARD (1)
            // ============================================================
            [
                'slug' => 'dashboard-vue-densemble',
                'title' => 'Lire le tableau de bord',
                'summary' => "Comprendre les indicateurs et raccourcis affichés sur la page d'accueil admin.",
                'category' => 'dashboard',
                'audience' => 'admin',
                'display_order' => 10,
                'body' => <<<'MD'
# Lire le tableau de bord

Le tableau de bord est la **page d'accueil par défaut** pour les admins et
super-admins. Il rassemble les indicateurs et raccourcis qui te font gagner du
temps au quotidien.

## Les zones affichées

### En haut : les KPI

Quatre cartes synthétiques :

- **Clients actifs** — nombre de clients dont au moins une mission est active.
- **Intervenants en poste** — intervenants actifs (`status = active`).
- **RDV cette semaine** — interventions planifiées du lundi au dimanche.
- **CA HT du mois** — somme des factures émises (sent, paid, partial) du mois en cours.

> 📸 *Capture d'écran à venir : ligne de 4 cartes KPI en haut du dashboard*

### Au milieu : les RDV du jour

Liste des interventions prévues aujourd'hui, triées par horaire. Chaque ligne
affiche : horaire, intervenant affecté, client, adresse, statut (badge coloré).
Clique sur une ligne pour ouvrir le RDV dans le planning.

### En bas : alertes & actions rapides

- **À pourvoir** — RDV planifiés sans intervenant affecté.
- **Non badgés** — RDV terminés (date dépassée) sans badgeage QR.
- **Devis en attente** — devis envoyés depuis plus de 7 jours sans réponse.
- **Factures impayées** — factures dont l'échéance est dépassée.

## Astuces

- Les KPI sont calculés en temps réel à chaque chargement de la page.
- Si une alerte est à zéro, la carte se grise pour rester discrète.
- Pour un suivi mensuel approfondi (CA par client, marge par intervenant),
  l'export CSV des factures depuis **Ventes → Factures** est plus pertinent.

**Voir aussi :** [Planning : vue d'ensemble](#) · [Créer une facture](#)
MD,
            ],

            // ============================================================
            // CLIENTS (6)
            // ============================================================
            [
                'slug' => 'clients-creer',
                'title' => 'Créer un nouveau client',
                'summary' => "Ajouter une fiche client dans l'annuaire pour ensuite y rattacher contrats, missions et factures.",
                'category' => 'clients',
                'audience' => 'admin',
                'display_order' => 10,
                'body' => <<<'MD'
# Créer un nouveau client

La fiche client est le **point de départ** de toute activité opérationnelle :
sans client, pas de mission, pas de devis, pas de RDV. La création est rapide
et la plupart des informations détaillées (contacts, adresses, contrats) se
remplissent ensuite depuis les onglets dédiés de la fiche.

## Étapes

1. Ouvre **Clients** dans la sidebar.
2. Clique sur le bouton **+ Nouveau client** en haut à droite de la liste.
3. Renseigne au minimum :
   - **Raison sociale** (nom de l'entreprise) — obligatoire.
   - **Entité** de rattachement (sélecteur, pré-rempli s'il n'y en a qu'une).
   - **Gérant**, **e-mail**, **téléphone** — recommandés.
4. Clique sur **Créer**.

> 📸 *Capture d'écran à venir : dialog de création client*

Le code client (ex. `CLI-0012`) est **généré automatiquement** après création.
Tu peux le voir en haut de la fiche client.

Tu es alors redirigé sur la **fiche client** où tu pourras compléter contacts,
adresses, contrats, etc.

## À savoir

- Le champ **Entité** détermine quelle entité juridique facturera ce client
  (utile si tu opères plusieurs sociétés depuis le même ERP).
- Un client ne peut pas être supprimé tant qu'il a des **RDV futurs** ou des
  **factures en cours**. Le système renvoie une erreur 409 claire. Seul un
  super-admin peut forcer la suppression avec l'option `?force=1`.

## Astuces

- Pour préparer un import en masse de clients, demande à ton développeur de
  passer par la commande artisan dédiée (pas d'import CSV en UI pour l'instant).
- Si tu veux **désactiver** un client sans le supprimer (départ temporaire),
  passe son statut à `inactive` sur sa fiche. Il n'apparaîtra plus dans les
  sélecteurs de nouveaux devis.

**Voir aussi :** [Onglets de la fiche client](#) · [Créer un contrat client](#)
MD,
            ],
            [
                'slug' => 'clients-fiche-onglets',
                'title' => 'Comprendre les onglets de la fiche client',
                'summary' => "Tour d'horizon des onglets : Général, Contacts, Adresses, Absences, Clés, Documents, Missions, Contrats, Devis & factures, Demandes.",
                'category' => 'clients',
                'audience' => 'admin',
                'display_order' => 20,
                'body' => <<<'MD'
# Comprendre les onglets de la fiche client

La fiche client est organisée en **onglets** pour ne pas surcharger l'écran et
te permettre d'aller directement au bon endroit.

> 📸 *Capture d'écran à venir : barre d'onglets de la fiche client*

## Liste des onglets

### 1. Général
Informations d'entreprise (raison sociale, SIRET, TVA, gérant, contact
facturation), édition inline (clique sur un champ pour le modifier). C'est
aussi ici que se trouvent les **consignes intervenants** (visibles côté
extranet) et les **notes internes** (admin seul).

### 2. Contacts
Liste des **personnes** rattachées au client (responsable, accueil, agent
qualité, etc.). Chaque contact a un nom, un rôle, e-mail/téléphone.

### 3. Adresses
Les adresses d'intervention du client (siège, agences, sites). Le **géocodage
automatique** (BAN.gouv.fr) calcule les coordonnées GPS dès l'enregistrement.

### 4. Absences
Périodes pendant lesquelles le client est fermé (vacances, jours fériés
spécifiques). Le planning évite alors de générer des RDV sur ces dates.

### 5. Clés
Inventaire des clés / badges / codes d'accès remis à tes intervenants pour ce
client. Indispensable pour traçabilité et restitution.

### 6. Documents
Documents associés au client : contrats signés, attestations, devis PDF, etc.
Onglet partagé avec la refonte Documents (audiences + expiration).

### 7. Missions
Liste des missions actives/archivées pour ce client. Une **mission** = un
contrat de prestation contenant N prestations récurrentes ou ponctuelles.

### 8. Contrats
Contrats clients (V1) : durée, conditions de paiement, mode de facturation,
pièces jointes. Différent des contrats de travail des intervenants.

### 9. Devis & factures
Tous les devis et factures émis pour ce client, avec leurs statuts.

### 10. Demandes (Réclamations)
Tickets ouverts par ce client (extranet) ou par tes équipes pour ce client.

## À savoir

- Les onglets sont **persistés dans l'URL** : tu peux partager un lien direct
  vers un onglet précis (ex. `/clients/12?tab=adresses`).
- Une **modification** dans un onglet (ex. ajout d'une adresse) **rafraîchit
  automatiquement** les autres onglets concernés (ex. planning, qui consomme
  les adresses).

## Astuces

- Sur les listes (contacts, adresses…), **chaque ligne entière est cliquable**
  pour ouvrir le détail. Pas besoin de viser un petit bouton.
- L'édition inline (clic sur un champ → champ devient éditable) marche partout :
  utilise `Échap` pour annuler une saisie en cours.

**Voir aussi :** [Créer un client](#) · [Créer un contrat client](#) · [Gérer les clés](#)
MD,
            ],
            [
                'slug' => 'clients-contrats',
                'title' => 'Gérer les contrats clients',
                'summary' => "Créer, suivre et archiver les contrats commerciaux signés avec un client.",
                'category' => 'clients',
                'audience' => 'admin',
                'display_order' => 30,
                'body' => <<<'MD'
# Gérer les contrats clients

L'onglet **Contrats** de la fiche client centralise les contrats commerciaux
signés avec chaque client (CGV signées, conditions particulières, contrats
annuels). C'est une nouveauté de la V1 d'Aspha Pro.

## Créer un contrat

1. Ouvre la fiche du client, onglet **Contrats**.
2. Clique sur **+ Nouveau contrat**.
3. Renseigne :
   - **Numéro / référence** (ex. `CONTRAT-2026-001`).
   - **Date de signature** et **date de prise d'effet**.
   - **Date de fin** (ou « indéterminée »).
   - **Conditions de paiement** (échéance 30 jours fin de mois, etc.).
   - **Mode de facturation** par défaut (mensuel groupé, par intervention…).
   - **Document PDF** scanné du contrat signé (upload).
4. Clique sur **Enregistrer**.

> 📸 *Capture d'écran à venir : dialog de création de contrat client*

## Suivre / modifier / archiver

- La liste affiche tous les contrats du client, triés par date de signature
  décroissante. Un badge indique le statut (`actif`, `expiré`, `résilié`).
- Clique sur un contrat pour le **modifier** ou **télécharger** le PDF signé.
- Pour archiver, change son statut en `résilié` et renseigne la date de fin.

## À savoir

- Un contrat client est purement **commercial / juridique**. Il ne crée pas
  automatiquement de missions ni de RDV (à ne pas confondre avec une mission).
- Tu peux uploader plusieurs **avenants** liés au contrat principal (chaque
  avenant est un document attaché).
- Les contrats expirés restent visibles (utile pour l'historique) mais ne sont
  plus pris en compte dans les calculs de cohérence métier.

## Astuces

- Nomme tes contrats de façon homogène (`CONTRAT-AAAA-NNN`) pour faciliter
  le tri et la recherche.
- Range systématiquement le PDF signé : c'est ta seule preuve en cas de litige.

**Voir aussi :** [Comprendre les onglets de la fiche client](#) · [Créer une mission](#)
MD,
            ],
            [
                'slug' => 'clients-acces-extranet',
                'title' => 'Créer un accès extranet pour un client',
                'summary' => "Permettre à un client de se connecter à son extranet et lui envoyer ses identifiants par e-mail.",
                'category' => 'clients',
                'audience' => 'admin',
                'display_order' => 40,
                'body' => <<<'MD'
# Créer un accès extranet pour un client

L'extranet client permet à ton client de **consulter ses devis, factures,
prestations actives, documents** et de **créer des tickets** sans dépendre de
toi à chaque demande. Tu gardes la main sur la création et la transmission de
ses identifiants.

## Étapes

1. Ouvre la fiche du client, onglet **Général** (ou un onglet « Portail »
   selon ta version).
2. Repère la carte **Accès extranet**.
3. Clique sur **Créer un accès**.
4. Renseigne l'**adresse e-mail** sur laquelle ton client recevra ses
   identifiants (par défaut l'e-mail principal du client).
5. Clique sur **Générer**.

> 📸 *Capture d'écran à venir : carte Accès extranet, bouton Créer un accès*

Aspha Pro crée alors un **utilisateur** rattaché au client (champ
`portal_user_id`) et affiche **le mot de passe une seule fois** dans une boîte
de dialogue. Copie-le ou utilise le bouton **Copier**.

## Envoyer le mot de passe par e-mail

Après création, tu peux :

- **Envoyer un e-mail automatique** au client avec ses identifiants (bouton
  **Envoyer par e-mail**). Le mot de passe sera régénéré pour des raisons de
  sécurité.
- **Régénérer** le mot de passe à tout moment (bouton **Régénérer**). Utile si
  le client a perdu ses identifiants.

> 📸 *Capture d'écran à venir : dialog affichant le mot de passe en clair une seule fois*

## À savoir

- Le mot de passe en clair n'est **JAMAIS** stocké en base — il est affiché une
  fois, point. Si le client le perd, régénère-en un nouveau.
- Le client est forcé à le changer à sa première connexion.
- Le compte client est **distinct** du « gestionnaire Aspha » du client
  (colonne `portal_user_id` vs `owner_user_id`). Un admin gestionnaire ne
  devient pas le client de ses propres dossiers.

## Astuces

- Demande au client de tester sa connexion devant toi : ça t'évite des
  allers-retours en cas de souci d'orthographe e-mail.
- Si le client a plusieurs interlocuteurs (DG + DAF), tu peux créer un compte
  par e-mail différent en multipliant les fiches utilisateur.

**Voir aussi :** [Extranet client : premiers pas](#) · [Créer un accès intervenant](#)
MD,
            ],
            [
                'slug' => 'clients-consignes-intervenants',
                'title' => 'Renseigner des consignes intervenants',
                'summary' => "Champ « Consignes intervenants » visible côté extranet et sur le RDV de l'intervenant.",
                'category' => 'clients',
                'audience' => 'admin',
                'display_order' => 50,
                'body' => <<<'MD'
# Consignes intervenants

Le champ **Consignes intervenants** sur la fiche client permet de transmettre
des informations utiles à TOUS les intervenants qui interviendront chez ce
client (codes d'entrée d'immeuble, recommandations de l'agent qualité,
spécificités locales, allergies du chien, etc.).

## Où le renseigner ?

1. Ouvre la fiche du client, onglet **Général**.
2. Repère la carte **Consignes intervenants** (texte libre multilignes).
3. Saisis tes consignes. L'édition est **inline** : un clic dans le champ →
   tu écris → clic ailleurs → enregistré automatiquement.

> 📸 *Capture d'écran à venir : carte « Consignes intervenants » de la fiche client*

## Où l'intervenant le voit-il ?

Le contenu apparaît à **deux endroits** côté extranet intervenant :

- Sur la **vignette d'un RDV** au clic (info-bulle) avec la mention
  *Consignes client*.
- Sur la **page détail de l'intervention** (si l'intervenant l'ouvre depuis
  son planning).

> 📸 *Capture d'écran à venir : tooltip RDV intervenant avec les consignes*

## Différence avec les notes internes

| Champ | Visible par | Pour quoi |
|---|---|---|
| **Consignes intervenants** | Admin + Intervenant (extranet) | Infos pratiques terrain |
| **Note interne RDV** (sur l'intervention) | Admin + Intervenant (extranet) | Détail spécifique à 1 RDV |
| **Note interne client** (fiche client) | Admin SEUL | Mémo confidentiel admin |

## Astuces

- Évite d'y mettre des informations sensibles (codes bancaires…). Tout
  intervenant y a accès.
- Pour une consigne **propre à un seul RDV** (ex. *demande exceptionnelle pour
  ce mardi*), utilise plutôt la **note interne RDV** côté planning.
- Maintiens ce champ à jour : un intervenant qui se déplace inutilement (mauvais
  code d'accès) c'est du temps de travail facturé pour rien.

**Voir aussi :** [Comprendre les onglets de la fiche client](#) · [Planning : vue d'ensemble](#)
MD,
            ],
            [
                'slug' => 'clients-cles-acces',
                'title' => 'Gérer les clés d\'accès du client',
                'summary' => "Inventaire et traçabilité des clés/badges/codes remis à tes intervenants.",
                'category' => 'clients',
                'audience' => 'admin',
                'display_order' => 60,
                'body' => <<<'MD'
# Gérer les clés d'accès

L'onglet **Clés** de la fiche client te permet de maintenir un inventaire des
moyens d'accès (clés physiques, badges, télécommandes, codes) confiés à tes
intervenants pour ce client. Indispensable en cas de litige (perte, vol,
restitution).

## Ajouter une clé

1. Ouvre la fiche client, onglet **Clés**.
2. Clique sur **+ Nouvelle clé**.
3. Renseigne :
   - **Type** (clé, badge, télécommande, code).
   - **Description** (étiquette physique, n° de série, etc.).
   - **Intervenant détenteur** (sélecteur).
   - **Date de remise**.
4. Enregistre.

> 📸 *Capture d'écran à venir : dialog d'ajout de clé*

## Suivre les mouvements

- Chaque clé garde un **historique** : remise, transfert, restitution.
- Pour transférer une clé à un autre intervenant, ouvre la clé et clique sur
  **Transférer**.
- Pour enregistrer une **restitution** (intervenant qui quitte l'entreprise),
  clique sur **Restituer**. La clé passe en statut `restituée` mais reste
  visible dans l'historique.

## À savoir

- Une clé peut être **active** (chez un intervenant) ou **restituée** (chez toi
  ou chez le client). Filtre la liste selon ce besoin.
- Le **bug d'horaire corrigé en V1** garantit que les dates/heures affichées
  sont en heure de Paris (et pas en UTC).

## Astuces

- Avant le départ d'un intervenant : vérifie toutes ses clés et organise les
  restitutions formellement.
- Photographie chaque clé physique au moment de la remise — joint la photo dans
  la description.

**Voir aussi :** [Comprendre les onglets de la fiche client](#)
MD,
            ],

            // ============================================================
            // INTERVENANTS (5)
            // ============================================================
            [
                'slug' => 'intervenants-creer',
                'title' => 'Créer un nouvel intervenant',
                'summary' => "Ajouter un intervenant dans l'annuaire et le rattacher à une entité.",
                'category' => 'intervenants',
                'audience' => 'admin',
                'display_order' => 10,
                'body' => <<<'MD'
# Créer un nouvel intervenant

L'intervenant est la personne qui exécute les prestations chez le client. Tu
peux le créer dès qu'il signe ton contrat de travail (ou avant si tu prépares
le planning à l'avance).

## Étapes

1. Ouvre **Intervenants** dans la sidebar.
2. Clique sur **+ Nouvel intervenant**.
3. Renseigne au minimum :
   - **Civilité**, **prénom**, **nom**.
   - **E-mail** professionnel (servira aux notifications + extranet).
   - **Téléphone**.
   - **Entité** de rattachement.
   - **Date d'embauche prévue**.
4. Clique sur **Créer**.

> 📸 *Capture d'écran à venir : dialog création intervenant*

Tu es redirigé sur la **fiche intervenant** où compléter contrat, compétences,
documents, etc.

## À savoir

- Un intervenant peut avoir un statut `actif`, `inactif`, `congé`, `départ`.
  Seuls les actifs apparaissent dans les sélecteurs (planning, missions).
- L'**ID de compte utilisateur** (pour l'extranet) est créé **séparément** via
  l'onglet **Accès extranet** de la fiche.
- Tu peux assigner un **gestionnaire** (admin référent) sur l'intervenant. Par
  défaut, c'est toi qui le crée.

## Astuces

- Si l'intervenant change d'entité (mutation interne), modifie son `entity_id`
  sur la fiche : tous ses prochains RDV bascule automatiquement.
- Pour suivre les compétences (CACES, habilitation électrique…), utilise
  l'onglet **Compétences** avec dates d'obtention/expiration.

**Voir aussi :** [Onglets de la fiche intervenant](#) · [Contrat de travail](#)
MD,
            ],
            [
                'slug' => 'intervenants-fiche-onglets',
                'title' => 'Onglets de la fiche intervenant',
                'summary' => "Tour des onglets : Général, Contrat, Compétences, Absences, Documents, Tickets, Notation, Accès extranet, Planning.",
                'category' => 'intervenants',
                'audience' => 'admin',
                'display_order' => 20,
                'body' => <<<'MD'
# Onglets de la fiche intervenant

La fiche intervenant est organisée en onglets pour t'éviter le scroll
interminable.

> 📸 *Capture d'écran à venir : barre d'onglets de la fiche intervenant*

## Liste des onglets

### 1. Général
Civilité, identité, contacts, photo, entité de rattachement. Édition inline.

### 2. Contrat
Type de contrat (CDI, CDD, intérim…), date début/fin, durée hebdo, salaire,
indemnités kilométriques, conditions particulières.

### 3. Compétences
Liste des compétences certifiées (CACES R489, habilitation BR, BSR, etc.) avec
date d'obtention et date d'expiration. Le système alerte avant expiration.

### 4. Absences
Congés payés posés, arrêts maladie, RTT, formations. Le planning évite
d'attribuer des RDV sur ces périodes.

### 5. Documents
Pièce d'identité, carte vitale, RIB, attestations, diplômes… avec date
d'expiration et coche verte si renouvelé.

### 6. Tickets
Tickets affectés à cet intervenant OU créés par lui (depuis l'extranet).

### 7. Notation
Score qualité 0-100 calculé sur 4 critères (absences, assiduité, badgeage,
relation). Voir l'article dédié.

### 8. Accès extranet
Création / régénération du compte extranet intervenant.

### 9. Planning
Vue calendrier filtrée sur les RDV de cet intervenant.

## À savoir

- Le **score de notation** est recalculé à chaque consultation de l'onglet
  (pas mis en cache). Si tu modifies un ticket avec faute désignée, le score
  est à jour immédiatement.
- L'accès extranet est facultatif : un intervenant peut très bien ne pas avoir
  de compte (mais alors il ne voit pas son planning en ligne).

## Astuces

- Si tu cherches **l'historique d'interventions** d'un intervenant, l'onglet
  **Planning** affiche tout (passé + futur), filtrable par mois.

**Voir aussi :** [Notation des intervenants](#) · [Contrat de travail](#) · [Accès extranet intervenant](#)
MD,
            ],
            [
                'slug' => 'intervenants-contrat-paie',
                'title' => 'Renseigner le contrat de travail',
                'summary' => "Saisir les conditions contractuelles : type, durée, salaire, indemnités kilométriques.",
                'category' => 'intervenants',
                'audience' => 'admin',
                'display_order' => 30,
                'body' => <<<'MD'
# Renseigner le contrat de travail

L'onglet **Contrat** de la fiche intervenant centralise les conditions
contractuelles indispensables pour le calcul de paie et la conformité légale.

## Champs disponibles

| Champ | Description |
|---|---|
| Type de contrat | CDI, CDD, CTT (intérim), apprentissage, stage |
| Date de début | Date d'embauche effective |
| Date de fin | Pour les CDD / CTT |
| Durée hebdomadaire | En heures (ex. `35`) |
| Salaire mensuel brut | En €, base temps plein |
| Coefficient / niveau | Selon ta convention collective |
| Mutuelle | OK / opt-out / en attente |
| Indemnités kilométriques | Tarif au km (ex. `0,32 €/km`) |

> 📸 *Capture d'écran à venir : onglet Contrat avec champs remplis*

## Édition

Tous les champs sont en **édition inline** : un clic, tu modifies, un autre
clic ailleurs et c'est enregistré.

## À savoir

- Le **salaire** est exclu volontairement des logs d'activité (`logExcept`) :
  pour des raisons de confidentialité, les changements de salaire ne sont pas
  visibles dans l'historique des modifications.
- Les **indemnités kilométriques** sont utilisées dans le calcul automatique
  des **trajets** entre RDV (voir l'article Planning / trajets).
- Le champ « Pendant intervention (€/km) » a été retiré en V1 (jugé inutile
  par notre cliente).

## Astuces

- Range un **scan du contrat signé** dans l'onglet Documents (catégorie
  contractuelle).
- Si le contrat évolue (avenant salaire), modifie les champs et garde une trace
  de l'avenant en PDF dans Documents.

**Voir aussi :** [Onglets de la fiche intervenant](#) · [Documents : uploader un document](#)
MD,
            ],
            [
                'slug' => 'intervenants-acces-extranet',
                'title' => 'Créer un accès extranet pour un intervenant',
                'summary' => "Permettre à un intervenant d'accéder à son planning et son profil en ligne.",
                'category' => 'intervenants',
                'audience' => 'admin',
                'display_order' => 40,
                'body' => <<<'MD'
# Créer un accès extranet pour un intervenant

L'extranet intervenant permet à l'intervenant de **consulter son planning,
son profil, ses documents, créer un signalement** et **échanger via la
messagerie interne**. Tu lui crées un compte de la même manière que pour un
client.

## Étapes

1. Ouvre la fiche intervenant, onglet **Accès extranet**.
2. Clique sur **Créer un accès**.
3. Saisis l'adresse e-mail (pré-remplie depuis le contact principal).
4. Clique sur **Générer**.

Le mot de passe est affiché une seule fois — copie-le ou envoie-le par e-mail
via le bouton dédié.

> 📸 *Capture d'écran à venir : dialog mot de passe one-shot*

## Régénération / désactivation

- Bouton **Régénérer** pour un nouveau mot de passe si perte.
- Bouton **Désactiver** si l'intervenant quitte l'entreprise (le compte ne
  peut plus se connecter mais l'historique est préservé).

## À savoir

- Le compte est rattaché à l'intervenant via `user_id` (différent du
  `portal_user_id` d'un client). Cette **séparation des rôles** évite les
  confusions.
- Un intervenant connecté à son extranet voit **uniquement ses propres RDV**
  (filtrage backend strict, pas seulement frontend) ; impossible de voir les
  RDV d'un collègue par bidouille d'URL.
- Les **prix** sont volontairement masqués côté extranet intervenant.

## Astuces

- Demande à l'intervenant d'installer le **raccourci PWA** (icône d'app) sur
  son téléphone : le rendu mobile est optimisé.
- Vérifie avec lui sa première connexion + le changement de mot de passe forcé.

**Voir aussi :** [Extranet intervenant : premiers pas](#) · [Mon planning (intervenant)](#)
MD,
            ],
            [
                'slug' => 'intervenants-notation',
                'title' => 'Système de notation des intervenants',
                'summary' => "Comprendre la note 0-100 calculée sur 4 critères : absences, assiduité, badgeage, relation.",
                'category' => 'intervenants',
                'audience' => 'admin',
                'display_order' => 50,
                'body' => <<<'MD'
# Système de notation des intervenants

Aspha Pro calcule automatiquement une **note de 0 à 100** pour chaque
intervenant, basée sur 4 critères pondérés à 25 % chacun. La note est
accessible depuis la fiche intervenant, onglet **Notation**.

> 📸 *Capture d'écran à venir : onglet Notation avec score global + détails*

## Les 4 critères

### 1. Absences (25 %)
- Part de 100.
- **−25 pts** par absence non justifiée.
- **−8 pts** par absence justifiée (arrêt maladie, événement familial).
- Calculée sur les 90 derniers jours.

### 2. Assiduité (25 %)
- Part de 100.
- **−2 pts par minute** de retard moyen au badgeage entrée.
- Si aucun retard mesurable → note neutre 100.

### 3. Badgeage (25 %)
- **% de RDV passés badgés** sur les 90 derniers jours.
- 100 % badgés → 100 pts. 50 % badgés → 50 pts.
- Si aucune donnée (intervenant tout neuf) → note neutre 100.

### 4. Relation (25 %)
- Part de 100.
- **−20 pts** par ticket où cet intervenant a été désigné fautif (champ
  `fault_employee_id` sur le ticket).
- Reflète la qualité relationnelle (réclamations clients imputables).

## Note globale

Moyenne pondérée des 4 critères. Affichage code couleur :

| Note | Couleur | Interprétation |
|---|---|---|
| 90-100 | Vert | Excellent |
| 75-89 | Bleu | Bon |
| 60-74 | Orange | À surveiller |
| < 60 | Rouge | Critique |

## Impact d'un ticket avec faute

Quand tu cliques sur **Désigner un intervenant fautif** dans un ticket et
choisis un intervenant, sa note de **Relation** baisse immédiatement de 20 pts
(plafonné à 0). Si tu retires la désignation, la note remonte.

## À savoir

- La note est **recalculée à chaque affichage** (pas de cache). Toujours à
  jour.
- Cas « aucune donnée » : note neutre 100 pour ne pas pénaliser un nouveau
  collaborateur.
- Le détail par critère est lisible (chaque ligne donne le calcul). Aucune
  boîte noire.

## Astuces

- Utilise la note pour piloter un **entretien annuel** ou repérer un
  collaborateur en difficulté.
- N'utilise PAS la note pour des décisions disciplinaires automatiques :
  c'est un indicateur, pas un verdict.

**Voir aussi :** [Onglets de la fiche intervenant](#) · [Tickets : désigner un intervenant fautif](#)
MD,
            ],

            // ============================================================
            // MISSIONS (2)
            // ============================================================
            [
                'slug' => 'missions-creer',
                'title' => 'Créer une mission',
                'summary' => "Démarrer une nouvelle mission depuis la fiche client et y ajouter des prestations.",
                'category' => 'missions',
                'audience' => 'admin',
                'display_order' => 10,
                'body' => <<<'MD'
# Créer une mission

Une **mission** est un contrat de prestation entre toi et un client. Elle
contient une ou plusieurs **prestations** (ménage hebdomadaire, vitres
mensuel, etc.) qui se déclineront en RDV au planning.

## Étapes

1. Ouvre la **fiche du client** concerné, onglet **Missions**.
2. Clique sur **+ Nouvelle mission**. Tu arrives sur la page de création.
3. Renseigne les **infos mission** :
   - **Libellé** (ex. *Ménage trimestriel siège*).
   - **Date de début**, **date de fin** (ou « indéterminée »).
   - **Statut** (active par défaut).
   - **Mode de paiement** (chèque, SEPA, CB, virement, espèces).
   - **Adresse d'intervention** par défaut.
4. Ajoute une ou plusieurs **prestations** via le bouton **+ Ajouter une prestation** :
   - **Prestation du catalogue** (sélecteur).
   - **Nature** : régulière (récurrente) ou ponctuelle.
   - **Récurrence** (si régulière) : jours de la semaine, heures, rythme.
   - **Intervenant par défaut** (carte avec suggestion).
   - **Prix** (par défaut depuis le catalogue, modifiable via case « Prix personnalisé »).
   - **Durée** de la prestation (sur le devis).
5. Clique sur **Enregistrer la mission**. La mission ET toutes les prestations
   sont sauvegardées en un clic.

> 📸 *Capture d'écran à venir : page de création de mission avec 2 prestations*

## Génération automatique du devis

À la création de la mission, Aspha Pro crée automatiquement un **devis
brouillon** lié (`missions.quote_id`) contenant une ligne par prestation. Tu
peux ensuite l'éditer et l'envoyer au client.

## Génération automatique des RDV récurrents

Chaque prestation `régulière` génère automatiquement les **interventions
récurrentes** correspondantes au planning (selon la fréquence et les jours
choisis).

## À savoir

- Une **prestation ponctuelle** ne génère pas de RDV récurrent. Tu peux créer
  un RDV ponctuel séparément depuis le planning.
- Si tu retires une prestation `régulière` (ou la passes en `ponctuelle`),
  les RDV futurs liés sont supprimés. Les RDV passés restent (historique).

## Astuces

- Pour gagner du temps, prépare le **catalogue de prestations** avant de créer
  ta première mission.
- Si plusieurs adresses sont concernées (multi-site), tu peux créer plusieurs
  prestations avec adresses différentes.

**Voir aussi :** [Modifier une mission](#) · [Catalogue de prestations](#) · [Planning : créer un RDV récurrent](#)
MD,
            ],
            [
                'slug' => 'missions-editer',
                'title' => 'Modifier une mission existante',
                'summary' => "Ajuster les prestations, la récurrence, l'intervenant par défaut ou la durée d'une mission déjà créée.",
                'category' => 'missions',
                'audience' => 'admin',
                'display_order' => 20,
                'body' => <<<'MD'
# Modifier une mission existante

Une fois créée, une mission n'est pas figée. Tu peux ajouter / retirer / modifier
des prestations, changer le rythme, ré-affecter un intervenant, ajuster le prix
ou la durée.

## Accès

3 chemins pour ouvrir une mission en édition :

- **Clients → fiche client → onglet Missions** → bouton crayon ou « Modifier ».
- **Missions** (page globale) → clic sur une ligne.
- Depuis le menu déroulant **⋮** d'une ligne mission.

> 📸 *Capture d'écran à venir : page d'édition de mission*

## Ce que tu peux modifier

### Infos mission
- Libellé, dates, statut, mode de paiement, adresse par défaut.
- Bouton **Enregistrer la mission** : un clic = TOUT enregistrer (infos + toutes
  les prestations modifiées). Un toast récapitulatif s'affiche.

### Prestations
Chaque prestation est dans une **carte** avec son propre formulaire :

- **Modifier** une prestation (label, prix, durée, récurrence, intervenant).
- **Ajouter** une nouvelle prestation à la mission.
- **Supprimer** une prestation (avec dialog de confirmation).
- **Assigner / retirer** un intervenant par défaut (carte de suggestion avec
  carte Leaflet).

> 📸 *Capture d'écran à venir : carte d'une prestation en cours d'édition*

## Récurrence

- **Rythme** : hebdomadaire, bi-hebdomadaire, mensuel, personnalisé.
- **Jours de semaine** (boutons toggle).
- **Heure de début** / **heure de fin** (input `HH:MM`).
- **Date de début / fin** de la récurrence.

Toute modification déclenche le **regénération** des RDV futurs : les anciens
RDV planifiés qui ne correspondent plus sont supprimés (sauf si déjà passés).

## Prix personnalisé

Par défaut, le prix d'une prestation vient du **catalogue**. Si tu coches
**Prix personnalisé** (carte prestation), tu peux entrer un prix spécifique
à ce client/mission. Le prix catalogue n'est plus pris en compte.

## À savoir

- Re-PATCH d'une date → date stable (correction du bug de timezone V1).
- Re-PATCH d'une heure → format `HH:MM:SS` accepté (compat PostgreSQL).
- Si une mission est **terminée**, ses RDV passés sont conservés. La mission
  reste dans l'historique du client.

## Astuces

- Avant de supprimer une prestation, vérifie qu'aucun RDV futur n'est encore
  badgé en cours (utilise le planning pour t'en assurer).
- Pour pause temporaire (ex. client en vacances), passe la mission en statut
  `pause` plutôt que de tout supprimer.

**Voir aussi :** [Créer une mission](#) · [Planning : drag-drop](#)
MD,
            ],

            // ============================================================
            // PLANNING (5)
            // ============================================================
            [
                'slug' => 'planning-vue-densemble',
                'title' => 'Lire le planning (couleurs & statuts)',
                'summary' => "Naviguer dans le calendrier et décoder les couleurs/statuts des RDV.",
                'category' => 'planning',
                'audience' => 'admin',
                'display_order' => 10,
                'body' => <<<'MD'
# Lire le planning

Le **planning** affiche tous les RDV (interventions) de tes intervenants sous
forme de calendrier interactif (basé sur FullCalendar).

## Vues disponibles

- **Jour** : créneaux 15 min, idéal pour la journée en cours.
- **Semaine** : 7 jours côte à côte (vue par défaut).
- **Mois** : aperçu macroscopique.
- **Ressources** : 1 ligne par intervenant (vue « tableau ressources »).

> 📸 *Capture d'écran à venir : planning en vue Semaine, ressources visibles*

## Couleurs et statuts

Chaque RDV est coloré selon son statut métier :

| Couleur | Statut | Signification |
|---|---|---|
| 🔴 Rouge | `annulee` | RDV annulé (par client ou intervenant) |
| 🟠 Orange | `a_pourvoir` | Planifié mais sans intervenant affecté |
| 🔵 Bleu | `planifiee` | Planifié + intervenant affecté, futur |
| 🟢 Vert | `realisee` + badgé | Terminé + badgeage validé (QR ou manuel) |
| 🟣 Violet | `realisee` sans badge | Terminé mais NON badgé (oubli ou refus) |
| ⚪ Gris | `draft`/`terminated` | Brouillon ou mission terminée |

Une **légende** est affichée en haut de la page pour rappel.

## Filtres

- Par **intervenant** (multi-sélection).
- Par **client**.
- Par **statut** (rouge, orange…).
- Par **adresse**.

## Navigation

- **Flèches** ← → pour naviguer dans le temps.
- **Aujourd'hui** pour revenir à la date du jour.
- **Vue** (jour/semaine/mois) en haut à droite.

## À savoir

- Le planning **eager-load** les relations (intervenant, client, adresse) pour
  un affichage rapide même avec 200+ RDV en visu.
- Les RDV **récurrents** sont **expansés à la volée** (pas stockés en BDD pour
  chaque occurrence). Une exception (drag d'une seule date) crée une entrée
  dédiée qui surcharge la série mère.
- Les **prix** ne sont JAMAIS affichés sur le planning (même à l'admin) pour
  faciliter le partage d'écran.

## Astuces

- Survole un RDV pour voir une **info-bulle** avec consignes client + note
  interne.
- **Clic droit** sur un créneau vide → menu contextuel pour créer un RDV
  ponctuel ou récurrent rapidement.

**Voir aussi :** [Créer un RDV ponctuel](#) · [Drag-drop : déplacer un RDV](#) · [Badgeage manuel](#)
MD,
            ],
            [
                'slug' => 'planning-creer-rdv-ponctuel',
                'title' => 'Créer un RDV ponctuel',
                'summary' => "Ajouter une intervention isolée (non récurrente) au planning, avec sélection multi-adresses.",
                'category' => 'planning',
                'audience' => 'admin',
                'display_order' => 20,
                'body' => <<<'MD'
# Créer un RDV ponctuel

Un RDV **ponctuel** est une intervention isolée qui ne fait pas partie d'une
série récurrente. Cas typique : intervention de dépannage, première visite,
prestation exceptionnelle.

## Étapes

1. Sur le **planning**, soit :
   - **Clic-glisse** sur le créneau souhaité (sélection visuelle), OU
   - **Clic droit** sur le planning → **Intervention ponctuelle**.
2. Le dialog de création s'ouvre, déjà rempli avec la date/heure cliquée.
3. Renseigne :
   - **Client** (picker avec recherche).
   - **Adresse** (sélecteur déroulant — V1 permet le choix parmi les adresses
     multiples du client).
   - **Intervenant** (facultatif — laisse vide pour « à pourvoir »).
   - **Date / heure début** / **heure fin**.
   - **Mission liée** (facultatif).
   - **Prestations** (catalogue) si tu veux que ce RDV génère aussi une mission +
     un devis automatique (cas spécial V1).
4. Valide.

> 📸 *Capture d'écran à venir : dialog création RDV ponctuel*

## Multi-adresses (V1)

Si le client a plusieurs adresses (siège + agences), tu choisis laquelle est
concernée par le RDV. Le géocodage est précalculé pour chaque adresse
(coordonnées GPS visibles sur la carte).

## Création mission/devis auto (V1)

Si tu choisis des **prestations** dans le dialog ET que le RDV est ponctuel
ET non lié à une mission, Aspha Pro crée automatiquement :
- Une **mission active** standalone.
- Des **prestations punctual** liées.
- Un **devis draft**.
- Tout en transaction.

## À savoir

- Le statut par défaut est `planifiee` si un intervenant est choisi,
  `a_pourvoir` sinon (orange).
- Drag-drop ensuite possible pour ajuster l'horaire ou l'intervenant.
- Conflit horaire : si l'intervenant a déjà un RDV qui chevauche, un
  **warning** s'affiche (non bloquant — confirme avec un nouveau clic).

## Astuces

- Pour un RDV très court (5-15 min), Aspha Pro détecte un **clic simple** et
  force 1 heure par défaut (au lieu de la durée du slot zoomé).
- Le picker d'intervenant est **visuel** avec photo + nom + dispo (pas un ID).

**Voir aussi :** [Créer un RDV récurrent](#) · [Drag-drop](#)
MD,
            ],
            [
                'slug' => 'planning-creer-rdv-recurrent',
                'title' => 'Créer un RDV récurrent (depuis une mission)',
                'summary' => "Générer automatiquement une série de RDV depuis une prestation régulière d'une mission.",
                'category' => 'planning',
                'audience' => 'admin',
                'display_order' => 30,
                'body' => <<<'MD'
# Créer un RDV récurrent

Les RDV récurrents (hebdomadaires, bi-hebdo, mensuels…) sont **générés
automatiquement** par Aspha Pro à partir des **prestations régulières** d'une
mission. Tu n'as pas besoin de les saisir manuellement, un par un.

## Workflow

1. Crée (ou édite) une **mission** sur la fiche d'un client.
2. Ajoute une **prestation** :
   - Choisis la **nature** : `régulière`.
   - Définis le **rythme** : hebdomadaire / bi-hebdo / mensuel / personnalisé.
   - Coche les **jours de la semaine** concernés.
   - Saisis l'**heure de début** et l'**heure de fin**.
   - Choisis l'**intervenant par défaut** (carte de suggestion).
3. Enregistre la mission.

> 📸 *Capture d'écran à venir : carte prestation avec récurrence configurée*

Aspha Pro génère alors une **intervention modèle** (template récurrent) ET
expanse les **occurrences** à la volée sur le planning, à l'horizon de
visualisation.

## Modifier UNE seule occurrence (exception)

Si tu veux changer **une date précise** sans casser la série (ex. décaler le
RDV du 14/06 d'une heure) :

1. **Drag-drop** cette occurrence sur le planning vers la nouvelle date/heure.
2. Aspha Pro crée automatiquement une **exception** liée à la série mère
   (champ `exception_date`).

L'occurrence d'origine disparaît, l'exception apparaît à la nouvelle place.

> 📸 *Capture d'écran à venir : drag-drop d'une occurrence + toast de confirmation*

## Annuler une seule occurrence

Clique sur l'occurrence → dialog d'édition → change le statut en `annulee`. La
série continue ensuite normalement.

## À savoir

- Les RDV générés sont **virtuels** dans la BDD (pas dupliqués). Seules les
  exceptions sont des lignes réelles. Économie d'espace + cohérence.
- Si tu modifies la prestation mère (rythme, heures), les **occurrences
  futures** sont régénérées. Les exceptions explicites sont préservées.

## Astuces

- Pour pause longue (vacances client), crée une **absence client** plutôt que
  d'annuler 1 par 1 les occurrences.
- Si la série change radicalement de rythme, supprime la prestation et
  recrée-la — plus propre.

**Voir aussi :** [Créer une mission](#) · [Drag-drop](#) · [Modifier une mission](#)
MD,
            ],
            [
                'slug' => 'planning-drag-drop',
                'title' => 'Déplacer un RDV (drag-drop)',
                'summary' => "Glisser-déposer un RDV pour ajuster horaire, intervenant ou créer une exception à une récurrence.",
                'category' => 'planning',
                'audience' => 'admin',
                'display_order' => 40,
                'body' => <<<'MD'
# Déplacer un RDV (drag-drop)

Le **drag-drop** est le moyen le plus rapide pour ajuster un planning : glisse
un RDV vers un autre créneau, une autre date, ou (en vue ressources) une
autre ligne intervenant.

## Comment faire

1. Sur le planning, **clique-maintiens** sur un RDV.
2. **Glisse-le** vers la nouvelle position.
3. **Lâche** : le RDV est déplacé immédiatement (PATCH backend en arrière-plan).

> 📸 *Capture d'écran à venir : drag d'un RDV d'un créneau à un autre*

Un **toast de confirmation** ou d'erreur s'affiche systématiquement (jamais
de silence).

## Resize (changer la durée)

**Tire la poignée inférieure** d'un RDV pour étendre / réduire la durée. Le
nouvel horaire de fin est enregistré en base.

## Cas particuliers

### RDV récurrent
Drag-drop d'une seule occurrence d'une série → création d'une **exception** à
la série (l'occurrence d'origine disparaît, l'exception apparaît).

### Conflit horaire
Si le nouvel emplacement chevauche un autre RDV de l'intervenant, un toast
warning s'affiche (non bloquant — un second drop confirme).

### En cas d'erreur API
Le RDV revient à sa position d'origine (`arg.revert()`) + toast d'erreur
explicite. Pas de drag « fantôme ».

## Verrouillage anti-race-condition

Pendant qu'un drag est en cours d'enregistrement, le planning est
**verrouillé** (opacity + pointer-events-none) pour empêcher un second drag
concurrent qui planterait l'état.

## À savoir

- Drag entre **lignes intervenants** (vue Resources) → ré-affecte l'intervenant.
- La **fuseau horaire** est forcé à Europe/Paris côté API (envoi en heure
  locale naïve) pour éviter les décalages de timezone connus.

## Astuces

- Pour **annuler** un déplacement, utilise `Cmd+Z` du navigateur… non
  désolé, ça ne fonctionne pas. Refais le drag-drop dans l'autre sens.
- Sur un grand écran, **plein-écran** (F11) + vue Semaine est le combo gagnant.

**Voir aussi :** [Lire le planning](#) · [Créer un RDV récurrent](#)
MD,
            ],
            [
                'slug' => 'planning-badgeage-manuel',
                'title' => 'Valider un badgeage manuellement',
                'summary' => "Marquer un RDV comme « terminé + badgé » quand l'intervenant a oublié de scanner le QR code.",
                'category' => 'planning',
                'audience' => 'admin',
                'display_order' => 50,
                'body' => <<<'MD'
# Valider un badgeage manuellement

Quand un intervenant a **oublié** de badger (scanner le QR code), le RDV reste
en statut `realisee` SANS badge → couleur **violette** sur le planning. Pour
le faire passer en **vert** (terminé + badgé) tu peux saisir un badgeage
manuel.

## Étapes

1. Ouvre le RDV concerné depuis le planning (clic sur l'événement violet).
2. Dans le dialog d'édition, repère la section **Badgeage manuel**.
3. Saisis :
   - **Intervenant** (pré-rempli).
   - **Heure d'entrée** (`HH:MM`).
   - **Heure de sortie** (`HH:MM`).
   - **Commentaire** (motif de la saisie manuelle : oubli, panne mobile…).
4. Clique sur **Valider le badgeage**.

> 📸 *Capture d'écran à venir : dialog édition RDV avec section badgeage manuel*

Le RDV passe immédiatement en statut `realisee` (vert) et tu vois une entrée
dans **Télégestion → Saisies manuelles** avec l'auteur (toi) + motif.

## À savoir

- La saisie manuelle est **tracée** (qui, quand, motif) pour audit.
- Le bug 422 connu (payload mal aligné `manualEntry`) a été **corrigé en V1**.
- La note **Assiduité** de l'intervenant prend en compte le retard de cette
  saisie comme un badgeage normal.

## Différence avec saisie depuis Télégestion

- Depuis **le planning** : tu cibles UN RDV précis (cas oubli ponctuel).
- Depuis **Télégestion → Saisie manuelle** : tu enregistres un événement de
  badgeage isolé (ex. test, dépannage logistique).

## Astuces

- Donne toujours un **commentaire clair** : ça facilite les audits et évite
  les soupçons.
- Si un intervenant oublie **systématiquement** de badger, c'est un signal
  faible : forme-le ou vérifie qu'il a bien accès à l'app mobile.

**Voir aussi :** [Lire le planning](#) · [Télégestion : QR codes & saisie manuelle](#)
MD,
            ],

            // ============================================================
            // VENTES (6)
            // ============================================================
            [
                'slug' => 'ventes-devis-creer',
                'title' => 'Créer un devis',
                'summary' => "Établir un devis depuis une mission ou ad hoc, avec lignes catalogue, stock ou libres.",
                'category' => 'ventes',
                'audience' => 'admin',
                'display_order' => 10,
                'body' => <<<'MD'
# Créer un devis

Un devis est une proposition commerciale **chiffrée** envoyée au client avant
exécution. Aspha Pro permet trois modes de création.

## Trois façons de démarrer

### A. Devis auto à la création de mission
Quand tu crées une mission, un devis **draft** est généré automatiquement
avec une ligne par prestation. Tu peux ensuite l'éditer.

### B. Devis depuis le module Ventes
1. Va dans **Ventes → Devis**.
2. Clique sur **+ Nouveau devis**.
3. Choisis le **client** (picker).
4. Choisis un **type de devis** (sélecteur) — pré-remplit la nature.
5. Choisis la **nature** (régulière / ponctuelle).
6. Optionnel : **Mission d'origine** → bouton **Charger les prestations**
   importe les lignes.
7. Ajoute des **lignes** via les 3 boutons :
   - **Prestation du catalogue** (pré-remplit label, prix, TVA, durée).
   - **Produit du stock** (chiffrage seul, 0 mouvement de stock à ce stade).
   - **Ligne libre** (label, qté, prix saisis à la main).
8. Saisis **dates**, **commentaire**.
9. Vérifie le **total HT** + détail TVA.
10. Enregistre en `draft` ou directement en `sent`.

> 📸 *Capture d'écran à venir : dialog création devis avec 3 lignes*

### C. Devis depuis un RDV ponctuel
Si tu crées un RDV ponctuel avec des prestations, Aspha Pro crée mission +
prestations + devis draft automatiquement.

## Durée par ligne (V1)

La **durée d'une prestation est saisie sur la ligne du devis**, pas sur le
catalogue (changement V1 : avant c'était sur le catalogue). Permet
d'adapter chaque devis au contexte client.

## À savoir

- Le **numéro de devis** est généré atomiquement via `DocumentSequenceService`
  (table `document_sequences`) — pas de doublons même en double-clic.
- La **TVA** est calculée **par ligne** (donc multi-taux possible sur un même
  devis).
- Un **entity_id** est **dérivé du client** côté backend (jamais hardcodé).

## Astuces

- Crée des **types de devis** (Ventes → bouton « Types de devis ») pour
  pré-remplir la nature et gagner du temps.
- Vérifie toujours le **total HT** avant envoi — Aspha Pro additionne
  proprement, mais l'œil humain reste utile.

**Voir aussi :** [Workflow d'un devis](#) · [Envoyer un devis au client](#) · [Catalogue prestations](#)
MD,
            ],
            [
                'slug' => 'ventes-devis-workflow',
                'title' => 'Workflow d\'un devis (draft → sent → accepted)',
                'summary' => "Comprendre les statuts d'un devis et les actions disponibles à chaque étape.",
                'category' => 'ventes',
                'audience' => 'admin',
                'display_order' => 20,
                'body' => <<<'MD'
# Workflow d'un devis

Un devis suit un cycle de vie clair, matérialisé par des **statuts** et des
**boutons d'action** sur la liste des devis.

## Les statuts

| Statut | Couleur | Signification | Modifiable ? |
|---|---|---|---|
| `draft` | Gris | Brouillon, jamais envoyé | ✅ Oui |
| `sent` | Bleu | Envoyé au client, en attente | ✅ Oui |
| `accepted` | Vert | Validé par le client | ❌ Figé |
| `refused` | Rouge | Refusé par le client | ❌ Figé |
| `expired` | Orange | Expiré sans réponse | ❌ Figé |

## Transitions

```
   draft ──── envoyer ───▶ sent ──┬── client valide ───▶ accepted
                                  └── client refuse ───▶ refused
```

> 📸 *Capture d'écran à venir : liste des devis avec différents statuts colorés*

## Actions sur la liste

Selon le statut, les boutons disponibles changent :

- **Modifier** : toujours possible tant que pas `accepted`/`refused`.
- **Envoyer au client** : disponible en `draft` → notif + e-mail client →
  devis passe `sent`.
- **Télécharger PDF** : toujours possible.
- **Convertir en mission** : disponible en `accepted` → crée la mission +
  prestations depuis les lignes (anti-doublon si déjà converti).
- **Convertir en facture** : disponible en `accepted` → crée la facture +
  items (anti-doublon via `quotes.invoice_id`).
- **Supprimer** : possible en `draft` seulement.

## À savoir

- Une fois `accepted`, un devis est **figé** : impossible de modifier les
  lignes (cohérence comptable).
- La **conversion devis → mission** ET **devis → facture** sont
  **idempotentes** : double-clic = 2e tentative renvoie la mission/facture
  existante (status 200 `already_existed`).
- Si le client refuse depuis son extranet, tu reçois une notif.

## Astuces

- Suis les devis `sent` depuis plus de 7 jours dans le **dashboard** → alertes.
- Avant conversion, vérifie une dernière fois le total avec le client.

**Voir aussi :** [Créer un devis](#) · [Convertir en facture](#)
MD,
            ],
            [
                'slug' => 'ventes-devis-envoyer-client',
                'title' => 'Envoyer un devis au client',
                'summary' => "Faire passer un devis en statut « envoyé » et notifier le client par e-mail + extranet.",
                'category' => 'ventes',
                'audience' => 'admin',
                'display_order' => 30,
                'body' => <<<'MD'
# Envoyer un devis au client

Quand ton devis est prêt, tu l'envoies au client. Aspha Pro déclenche
plusieurs actions automatiques.

## Étapes

1. Ouvre la liste des devis (**Ventes → Devis**).
2. Repère le devis en statut `draft`.
3. Clique sur le bouton **Envoyer** (icône avion / paper-plane) sur la ligne.
4. Confirme.

> 📸 *Capture d'écran à venir : bouton Envoyer sur la liste des devis*

Aspha Pro :
- Passe le devis en statut **`sent`** (bleu).
- **Notifie le client** dans son extranet (cloche → « Devis à valider »).
- Envoie un **e-mail** au contact principal du client (si configuré).

## Côté client (extranet)

Le client se connecte à son extranet, va dans **Mes devis**, voit le devis
avec un bouton **Consulter** + actions **Valider** / **Refuser** + **PDF**.

Quand il valide :
- Le devis passe `accepted`.
- **Tu es notifié** (cloche admin).
- Tu peux convertir en mission ou facture d'un clic.

## À savoir

- Un devis envoyé reste modifiable (sauf une fois `accepted`). Si tu changes
  des lignes après envoi, le client verra la dernière version.
- L'envoi par e-mail nécessite que **SMTP** soit configuré côté serveur. En
  mode mock (dev), l'e-mail apparaît dans les logs Laravel uniquement.

## Astuces

- Si le client ne réagit pas sous 7 jours, l'alerte « Devis en attente »
  apparaît sur ton dashboard.
- Ajoute toujours un **commentaire** dans le devis (zone libre) pour
  contextualiser (« Suite à notre RDV du 15/06… »).

**Voir aussi :** [Workflow d'un devis](#) · [Extranet client : mes devis](#)
MD,
            ],
            [
                'slug' => 'ventes-factures-creer',
                'title' => 'Créer une facture',
                'summary' => "Émettre une facture depuis un devis accepté ou directement (ex-nihilo).",
                'category' => 'ventes',
                'audience' => 'admin',
                'display_order' => 40,
                'body' => <<<'MD'
# Créer une facture

Une facture matérialise la dette d'un client envers toi. Aspha Pro permet deux
modes de création.

## A. Depuis un devis accepté

1. Va dans **Ventes → Devis**.
2. Repère un devis en statut `accepted`.
3. Clique sur **Convertir en facture**.
4. La facture est créée avec les **mêmes lignes** que le devis. Le devis est
   marqué comme converti (`quotes.invoice_id` rempli) pour éviter le double.

## B. Ex-nihilo

1. Va dans **Ventes → Factures**.
2. Clique sur **+ Nouvelle facture**.
3. Choisis le **client**.
4. Ajoute des **lignes** (catalogue, stock, libres).
5. Saisis **date d'émission**, **date d'échéance**, **commentaire**.
6. Enregistre.

> 📸 *Capture d'écran à venir : dialog création facture*

## Statuts d'une facture

| Statut | Signification |
|---|---|
| `draft` | Brouillon, jamais envoyé |
| `sent` | Envoyée au client, en attente de paiement |
| `partial` | Règlement partiel reçu |
| `paid` | Soldée |
| `cancelled` | Annulée |

## À savoir

- Le **numéro de facture** suit le format `INV-AAAAMM-XXXX` (atomique, jamais
  de doublon).
- Tu ne peux **plus modifier** une facture une fois `sent` (statut comptable
  figé) — sauf annulation + avoir.
- La conversion devis → facture est **idempotente** (anti-doublon).

## Astuces

- Si tu factures **mensuellement et en groupé** un même client, attends la
  fin du mois et crée 1 facture avec N lignes (1 par prestation/RDV).
- Le **mode de paiement** par défaut vient du contrat client (mission).

**Voir aussi :** [PDF Factur-X & Pennylane](#) · [Règlements](#)
MD,
            ],
            [
                'slug' => 'ventes-factures-pdf-pennylane',
                'title' => 'PDF Factur-X et sync Pennylane',
                'summary' => "Générer un PDF B2B conforme Factur-X (EN 16931) et synchroniser avec Pennylane.",
                'category' => 'ventes',
                'audience' => 'admin',
                'display_order' => 50,
                'body' => <<<'MD'
# PDF Factur-X & Pennylane

Depuis le 1er septembre 2026, toutes les factures B2B en France doivent être
au format **Factur-X PDF/A-3** (norme EN 16931 : PDF lisible humain + XML
machine intégré). Aspha Pro génère ce format automatiquement.

## Télécharger un PDF Factur-X

1. Ouvre la facture depuis **Ventes → Factures**.
2. Clique sur le bouton **PDF** (icône téléchargement).
3. Le PDF s'ouvre dans un nouvel onglet et se télécharge.

Le PDF :
- Est lisible humainement (en-tête entité, lignes, totaux, TVA).
- Contient un **XML CII** embarqué (lisible par l'expert-comptable et
  l'administration).
- Comporte **SIRET + n° TVA** de ton entité dans l'en-tête (V1).

> 📸 *Capture d'écran à venir : PDF Factur-X ouvert avec en-tête entité*

⚠️ Si l'**en-tête entité manque SIRET ou TVA**, la génération est **bloquée**
(HTTP 422 explicite). Renseigne d'abord ces champs dans **Paramètres → Mon
entreprise**.

## Sync Pennylane

Pennylane est un logiciel de comptabilité. La sync envoie automatiquement
chaque facture vers ton compte Pennylane.

1. Ouvre la facture.
2. Clique sur l'icône **Cloud** (sync Pennylane).
3. Aspha Pro envoie la facture via l'API Pennylane.
4. La facture y apparaît avec son `pennylane_id` (stocké côté Aspha).

### Mode mock
Si la **clé API Pennylane n'est pas configurée** (dev/test), la sync est
mockée : tout fonctionne en local, rien n'est envoyé au vrai Pennylane.

## À savoir

- Le **téléchargement de PDF** se fait via blob authentifié (`api.get` avec
  `responseType:'blob'`) — pas un simple `<a href>` qui perdrait le token.
- Pennylane idempotent (V1 reste à finaliser) : un re-sync mettra à jour la
  facture existante côté Pennylane (PUT) au lieu d'en créer une nouvelle.
- Le `customer_id` Pennylane est mappé via une colonne `clients.pennylane_id`
  (créée à la 1re sync du client).

## Astuces

- Vérifie 1 facture de test avec **ton expert-comptable** avant de basculer
  en prod : Factur-X est strict, mieux vaut valider tôt.
- Pennylane envoie une notif e-mail à chaque facture reçue : surveille-les.

**Voir aussi :** [Configurer son entreprise](#) · [Créer une facture](#)
MD,
            ],
            [
                'slug' => 'ventes-reglements',
                'title' => 'Saisir un règlement',
                'summary' => "Enregistrer un paiement reçu et l'allouer sur une ou plusieurs factures.",
                'category' => 'ventes',
                'audience' => 'admin',
                'display_order' => 60,
                'body' => <<<'MD'
# Saisir un règlement

Quand un client te paie (chèque, SEPA, CB, virement, espèces), tu enregistres
un **règlement** et tu l'**alloues** à une ou plusieurs factures pour les
solder.

## Étapes

1. Va dans **Ventes → Règlements**.
2. Clique sur **+ Nouveau règlement**.
3. Renseigne :
   - **Client**.
   - **Mode de paiement** (chèque, SEPA, CB, virement, espèces).
   - **Référence** (n° chèque, libellé virement…).
   - **Date de paiement**.
   - **Montant total**.
4. Dans la liste des **factures impayées** du client, **alloue** le montant
   reçu sur une ou plusieurs lignes.
5. Enregistre.

> 📸 *Capture d'écran à venir : dialog création règlement avec allocations*

Chaque facture passe automatiquement en statut `partial` ou `paid` selon le
montant alloué.

## Contraintes (V1)

- `somme(allocations) ≤ montant règlement` (pas d'allocation > règlement).
- `somme(allocations sur facture) ≤ TTC dû` (pas de sur-paiement).
- Si tu supprimes un règlement (`Reglement.destroy`), les **allocations sont
  purgées** en cascade et les factures repassent à leur état antérieur.

## À savoir

- Un règlement peut être **partiellement alloué** (ex. acompte à rapprocher
  plus tard). Le solde reste « disponible ».
- L'**entity_id** est dérivé du client backend, jamais hardcodé.

## Astuces

- Importe tes relevés bancaires CSV (à venir V1.1) pour pré-remplir les
  règlements.
- Si un règlement est rejeté (chèque sans provision), supprime-le et marque
  la facture en `unpaid` à nouveau.

**Voir aussi :** [Créer une facture](#) · [Sync Pennylane](#)
MD,
            ],

            // ============================================================
            // PRESTATIONS + STOCK (2)
            // ============================================================
            [
                'slug' => 'prestations-catalogue',
                'title' => 'Gérer le catalogue de prestations',
                'summary' => "Créer et maintenir le catalogue de prestations facturables (TVA 20 %, durée saisie sur le devis).",
                'category' => 'prestations',
                'audience' => 'admin',
                'display_order' => 10,
                'body' => <<<'MD'
# Catalogue de prestations

Le catalogue centralise les **prestations facturables** de ton entreprise
(ménage, vitres, jardinage…). C'est la base de tout : devis, missions et RDV
récurrents s'appuient dessus.

## Ouvrir le catalogue

**Ventes → Prestations** (ou un raccourci depuis le menu Ventes).

> 📸 *Capture d'écran à venir : liste des prestations catalogue*

## Créer une prestation

1. Clique sur **+ Nouvelle prestation**.
2. Renseigne :
   - **Libellé** (ex. *Ménage standard*).
   - **Description** courte.
   - **Prix HT** unitaire.
   - **TVA** : **20 % par défaut** (les autres taux 5,5/10/0 ont été
     désactivés en V1).
   - **Mode de facturation** (par défaut `per_intervention`).
3. Enregistre.

## Changements V1

- ❌ Pas de **catégorie** sur le catalogue (sélecteur retiré).
- ❌ Pas de champ **coût** (interne) sur la prestation.
- ❌ Pas de **durée** sur le catalogue (la durée est désormais saisie sur la
  ligne du devis ou de la mission, au cas par cas).
- ❌ Pas de **nature** (régulier/ponctuel) sur le catalogue (la nature est
  portée par la prestation client `client_prestations`, pas le catalogue).
- ✅ Seul taux de TVA actif : **20 %**.

## À savoir

- Le catalogue est **partagé entre toutes les entités** (pas de catalogue par
  entité juridique).
- Une prestation peut être désactivée (`status = inactive`) pour la masquer
  des sélecteurs sans perdre son historique d'utilisation.
- Les **paliers dégressifs** existent (prix dégressif par volume) pour les
  contrats cadre.

## Astuces

- Maintiens un catalogue **court et clair** : 15-30 lignes max. Trop de
  prestations = sélecteurs surchargés.
- Pour les **devis sur-mesure**, utilise les **lignes libres** plutôt que de
  créer une entrée catalogue éphémère.

**Voir aussi :** [Créer un devis](#) · [Stock : produits & mouvements](#)
MD,
            ],
            [
                'slug' => 'stock-produits-mouvements',
                'title' => 'Stock : produits & mouvements',
                'summary' => "Gérer les consommables/matériel et suivre les entrées/sorties d'inventaire.",
                'category' => 'stock',
                'audience' => 'admin',
                'display_order' => 10,
                'body' => <<<'MD'
# Stock : produits & mouvements

Le module Stock permet de gérer les **consommables** et le **matériel**
(produits d'entretien, sacs poubelle, lavettes, équipements jetables) avec un
suivi des entrées/sorties.

## Produits de stock

### Créer un produit
1. Va dans **Stock**.
2. Clique sur **+ Nouveau produit**.
3. Renseigne :
   - **Nom** (ex. *Lavette microfibre bleue*).
   - **Référence** (SKU interne).
   - **Quantité actuelle** (départ).
   - **Seuil d'alerte** (en-dessous → alerte dashboard).
   - **Prix d'achat** (HT, optionnel — V1).
   - **Prix de vente** (HT, optionnel — V1).
   - **Fournisseur** (sélecteur — V1).
4. Enregistre.

> 📸 *Capture d'écran à venir : dialog création produit stock*

## Mouvements de stock

À chaque opération, un **mouvement** est enregistré :

- **Entrée** : réception de marchandise (livraison fournisseur).
- **Sortie** : consommation (mission qui utilise le produit).
- **Ajustement** : inventaire physique (correction de quantité).

### Quand ?
- Manuellement depuis Stock → bouton **Mouvement**.
- **Automatiquement** quand tu ajoutes un produit stock à une mission
  (décompte temps réel via `MissionStockService`).
- Quand tu retires une ligne stock d'une mission → ré-entrée auto.

## Devis vs missions

- **Devis** avec produit stock = chiffrage seul, **0 mouvement** de stock à
  ce stade.
- **Mission** avec produit stock = **décompte immédiat** dans le stock
  (transaction garantie).
- **Conversion devis → mission** : les lignes produit-stock du devis
  deviennent des `mission_stock_items` et **déclenchent alors** le décompte.

## À savoir

- Le **stock insuffisant** N'EST PAS bloquant : la quantité est clampée à 0,
  une info `low_stock` est renvoyée (cohérent avec le comportement legacy).
- Quand un produit est **supprimé**, les `mission_stock_items` gardent une
  référence nulle (`nullOnDelete`) — l'historique du libellé reste lisible.

## Astuces

- Définis des **seuils d'alerte** réalistes pour anticiper les ruptures.
- Fais un **inventaire physique** mensuel et ajuste depuis le module.

**Voir aussi :** [Catalogue de prestations](#) · [Modifier une mission](#)
MD,
            ],

            // ============================================================
            // TICKETS (2)
            // ============================================================
            [
                'slug' => 'tickets-creer-gerer',
                'title' => 'Créer et gérer un ticket',
                'summary' => "Tracer les réclamations / signalements / suivi qualité avec fil de discussion et affectation.",
                'category' => 'tickets',
                'audience' => 'admin',
                'display_order' => 10,
                'body' => <<<'MD'
# Créer et gérer un ticket

Les **tickets** (anciennement « réclamations / demandes ») permettent de
tracer toute interaction client/intervenant qui n'est pas un RDV : réclamation
qualité, demande spéciale, signalement d'incident, suivi terrain.

## Créer un ticket (admin)

1. Va dans **Tickets → + Nouveau ticket**, OU depuis la fiche client → onglet
   **Demandes**.
2. Renseigne :
   - **Client** concerné.
   - **Type** (réclamation, signalement, demande, autre).
   - **Sujet** + **description**.
   - **Priorité** (basse / normale / haute / urgente).
3. Enregistre.

> 📸 *Capture d'écran à venir : dialog création ticket*

## Fil de discussion

Une fois créé, le ticket dispose d'un **fil de discussion** (`TicketThread`) :

- **Admin**, **client** (extranet), **intervenant affecté** (extranet)
  peuvent y poster.
- Bulles alignées (gauche/droite), auto-scroll, `Ctrl+Entrée` pour envoyer.
- Désactivé si le ticket est `closed`.

> 📸 *Capture d'écran à venir : fil de discussion d'un ticket*

À chaque message, **tous les participants sauf l'auteur** reçoivent une
notification (cloche).

## Affecter un intervenant

Sur la page détail du ticket, repère la carte **Intervenants affectés** :

- Bouton **+ Affecter** → picker d'intervenant (avec photo + nom).
- Bouton **Retirer** sur un intervenant affecté.
- L'intervenant affecté voit le ticket dans son extranet et peut participer
  au fil.

## Statuts

| Statut | Signification |
|---|---|
| `open` | Ouvert, en attente |
| `in_progress` | En cours de traitement |
| `pending_client` | En attente d'info client |
| `resolved` | Résolu côté Aspha |
| `closed` | Clôturé (lecture seule) |

## À savoir

- L'**ownership** est strict : un intervenant ne voit que les tickets où il
  est affecté OU créé par lui. Un client ne voit que ses propres tickets.
- La suppression d'un ticket purge en cascade ses **messages** et son
  **pivot d'affectation**.

## Astuces

- Utilise les **priorités** pour trier le dashboard : urgentes en premier.
- Si la même réclamation revient, désigne l'intervenant fautif pour faire
  baisser sa note **Relation** (voir l'article dédié).

**Voir aussi :** [Faute intervenant sur ticket](#) · [Notation des intervenants](#)
MD,
            ],
            [
                'slug' => 'tickets-faute-intervenant',
                'title' => 'Désigner un intervenant fautif',
                'summary' => "Marquer un ticket comme étant la faute d'un intervenant pour impacter sa note Relation.",
                'category' => 'tickets',
                'audience' => 'admin',
                'display_order' => 20,
                'body' => <<<'MD'
# Désigner un intervenant fautif

Pour les tickets qui révèlent un **comportement reprochable** d'un intervenant
(retard répété, manque de propreté, attitude…), tu peux le désigner comme
**fautif**. Cela impacte automatiquement sa **note Relation**.

## Étapes

1. Ouvre le ticket concerné depuis **Tickets** ou la fiche client.
2. Repère la carte **Désigner un intervenant fautif** (`FaultCard`).
3. Choisis l'intervenant fautif (sélecteur).
4. Renseigne un **commentaire** explicatif obligatoire (audit interne).
5. Clique sur **Désigner**.

> 📸 *Capture d'écran à venir : carte FaultCard sur la page ticket*

## Impact immédiat sur la note

- La note **Relation** de l'intervenant baisse de **20 points** (plafonné
  à 0).
- La note **globale** est recalculée à la prochaine consultation de l'onglet
  Notation.
- L'intervenant N'EST PAS notifié de la désignation (info confidentielle
  admin).

## Retirer une désignation

Si tu as désigné par erreur ou que la situation a été éclaircie :
1. Ouvre le ticket.
2. Carte FaultCard → bouton **Retirer la désignation**.
3. La note Relation remonte automatiquement.
4. Le commentaire de faute est purgé.

## À savoir

- La désignation est **unique par ticket** : un seul intervenant fautif par
  ticket. Si plusieurs sont impliqués, crée plusieurs tickets.
- Le commentaire est gardé en BDD (champ `fault_comment`) — il sert d'audit
  RH en cas de litige.

## Astuces

- N'utilise cette fonction qu'avec **discernement** : un ticket avec faute
  laisse une trace.
- Préfère un entretien direct + un retour formel avant de cocher la faute.

**Voir aussi :** [Créer un ticket](#) · [Notation des intervenants](#)
MD,
            ],

            // ============================================================
            // MESSAGERIE + DOCUMENTS (4)
            // ============================================================
            [
                'slug' => 'messagerie-conversations',
                'title' => 'Créer une conversation',
                'summary' => "Démarrer un fil de discussion interne avec un ou plusieurs admins/intervenants.",
                'category' => 'messagerie',
                'audience' => 'admin',
                'display_order' => 10,
                'body' => <<<'MD'
# Créer une conversation

La **messagerie interne** d'Aspha Pro permet aux admins et intervenants
d'échanger en dehors des tickets clients. C'est plus rapide qu'un e-mail et
ça reste dans l'ERP.

## Étapes

1. Ouvre **Messagerie** dans la sidebar.
2. Clique sur **+ Nouvelle conversation**.
3. **Choisis les participants** :
   - Tu peux inviter **admins** et **intervenants**.
   - ❌ Les **clients sont exclus** de la messagerie interne (ils utilisent les
     tickets pour communiquer).
4. Saisis un **sujet** (facultatif mais recommandé).
5. Écris le premier message.
6. Envoie.

> 📸 *Capture d'écran à venir : dialog création conversation*

## Participants

Chaque conversation peut avoir N participants. Tu en es le créateur.

À chaque **nouveau message**, **tous les participants sauf l'expéditeur**
reçoivent une notification (cloche). Le compteur de messages non lus est
visible dans la sidebar.

## À savoir

- La messagerie **interne** est **distincte** des **fils de tickets** : ne
  mélange pas les deux. Tickets = communication client / interventions ;
  messagerie = communication interne libre.
- Les conversations sont **paginées** (50 messages par défaut). L'historique
  complet est conservé en BDD.
- Le **temps de chargement** est optimisé pour ne pas planter avec 100+
  conversations.

## Astuces

- Crée une conversation **1-à-1** avec un intervenant pour un échange privé,
  ou **collective** (groupe régional, équipe terrain) pour annoncer.
- Pour les annonces ponctuelles à TOUS, préfère un **e-mail** ou un **avis**
  sur le dashboard plutôt que d'inonder la messagerie.

**Voir aussi :** [Gérer une conversation](#)
MD,
            ],
            [
                'slug' => 'messagerie-gerer-conversation',
                'title' => 'Gérer une conversation (participants, suppression)',
                'summary' => "Ajouter/retirer des participants ou supprimer une conversation.",
                'category' => 'messagerie',
                'audience' => 'admin',
                'display_order' => 20,
                'body' => <<<'MD'
# Gérer une conversation

Une fois créée, une conversation est éditable : tu peux faire évoluer la liste
des participants ou la supprimer.

## Ajouter / retirer un participant

1. Ouvre la conversation.
2. Clique sur l'icône **Participants** en haut (ou le `⋮`).
3. **Ajouter** : sélectionne un admin ou intervenant dans la liste.
4. **Retirer** : croix à droite du nom d'un participant.

> 📸 *Capture d'écran à venir : panneau participants d'une conversation*

À l'ajout : la personne reçoit une notification + voit l'historique complet
de la conversation depuis sa cloche / sa sidebar.

À la suppression : la personne ne voit plus la conversation, mais
l'historique est préservé en BDD.

## Supprimer une conversation

1. Ouvre la conversation.
2. Menu `⋮` → **Supprimer la conversation**.
3. Confirme (action **irréversible**).

La suppression purge la conversation, ses messages et son pivot de
participants en cascade.

## À savoir

- Seul le **créateur** ou un **super-admin** peut supprimer une conversation.
- Les **clients** ne peuvent jamais être invités (règle métier).
- Le compteur de **non-lus** par conversation est calculé via `last_read_at`
  sur le pivot `MessageThreadParticipant`.

## Astuces

- Avant de supprimer, télécharge éventuellement un export PDF (à venir V1.1).
- Pour archiver sans supprimer, tu peux passer le statut en `archived` (non
  visible dans la sidebar mais toujours en BDD).

**Voir aussi :** [Créer une conversation](#)
MD,
            ],
            [
                'slug' => 'documents-uploader',
                'title' => 'Uploader un document',
                'summary' => "Ajouter un document (contrat, attestation, scan) avec audience et date d'expiration.",
                'category' => 'documents',
                'audience' => 'admin',
                'display_order' => 10,
                'body' => <<<'MD'
# Uploader un document

Le module Documents centralise tous les fichiers (PDF, images, Word…) liés
à un client, un intervenant ou à ton entreprise (encadrement).

## Étapes

1. Va dans l'onglet **Documents** :
   - Sur une **fiche client** → documents du client.
   - Sur une **fiche intervenant** → documents de l'intervenant.
   - Page **Documents** globale → tous les documents.
2. Clique sur **+ Uploader un document**.
3. Renseigne :
   - **Fichier** (PDF, JPG, PNG, DOCX, max 10 Mo).
   - **Audience** (V1 — refonte) :
     - **Client** : visible côté extranet client.
     - **Intervenant** : visible côté extranet intervenant.
     - **Encadrement** : visible côté admin uniquement.
   - **Visibilité extranet** (`is_client_visible` coche) — surchargeable.
   - **Type / catégorie** (RIB, contrat, devis signé, etc.).
   - **Date d'expiration** (facultatif — utile pour pièce d'identité, mutuelle…).
4. Upload.

> 📸 *Capture d'écran à venir : dialog upload avec audience + expiration*

## À savoir

- Les fichiers sont stockés sur **disk local privé** (jamais `public`).
- Le **téléchargement** passe par un controller dédié qui vérifie l'**ownership**
  (impossible d'accéder à un doc client A en tant que client B).
- Le **MIME** est validé côté backend (whitelist) pour éviter les uploads
  malveillants.
- Le **soft delete** est activé : un document supprimé est récupérable par un
  super-admin.

## Date d'expiration

- Tant que la date n'est pas dépassée : badge gris.
- À 30 jours d'expiration : badge **orange**.
- Au-delà de la date : badge **rouge**.
- Quand un document est renouvelé (nouveau document avec même type + date plus
  récente), la **coche verte** apparaît.

## Astuces

- Donne un nom de fichier explicite (`Marie_Dupont_carte_vitale_2026.pdf`)
  plutôt que `IMG_4823.jpg`.
- Active une alerte de **renouvellement automatique** (voir article dédié).

**Voir aussi :** [Renouvellement de documents](#) · [Documents requis](#)
MD,
            ],
            [
                'slug' => 'documents-renouvellement',
                'title' => 'Système de renouvellement des documents',
                'summary' => "Recevoir une notification automatique avant l'expiration d'un document.",
                'category' => 'documents',
                'audience' => 'admin',
                'display_order' => 20,
                'body' => <<<'MD'
# Renouvellement des documents

Aspha Pro surveille la **date d'expiration** des documents et te prévient
avant qu'ils n'expirent. Indispensable pour rester en conformité (carte
d'identité, mutuelle, attestation URSSAF, etc.).

## Comment ça marche

1. Tu uploades un document avec une **date d'expiration**.
2. Une **commande quotidienne** (`schedule:run` à 07:30) scanne les
   documents expirant dans les **30 jours**.
3. Une **notification** `document_renewal` est envoyée aux destinataires
   concernés (selon l'audience).
4. **Anti-spam 7 jours** : la même notification n'est pas envoyée plus d'une
   fois par semaine pour un même document.

> 📸 *Capture d'écran à venir : notification « Document à renouveler »*

## Renouveler un document

1. Tu reçois la notification cloche.
2. Clic sur la notif → ouvre le document concerné.
3. Upload une **nouvelle version** avec une nouvelle date d'expiration.
4. La **coche verte** apparaît sur la liste (document renouvelé).

## Coche verte

Quand un document expirant a une **nouvelle version uploadée plus récente**
(même type, même destinataire, expiration ultérieure), une coche verte
apparaît à côté de l'ancien. Tu peux supprimer l'ancien (le nouveau prend la
relève).

## À savoir

- L'anti-spam évite que tu reçoives 30 fois la même notif sur 30 jours.
- Si un document n'a **PAS de date d'expiration**, il n'est jamais flaggé.
- La commande peut être lancée manuellement : `php artisan documents:notify-renewal`
  (utile pour test).

## Astuces

- Renseigne systématiquement la date d'expiration sur tout document qui en a
  une (passeport, carte d'identité, mutuelle, certif médical, CACES…).
- Configure le **scheduler cron** sur ton serveur :
  `cron php artisan schedule:run` chaque minute.

**Voir aussi :** [Uploader un document](#)
MD,
            ],

            // ============================================================
            // NOTIFICATIONS + TÉLÉGESTION + FLOTTE (4)
            // ============================================================
            [
                'slug' => 'notifications-cloche-centre',
                'title' => 'Cloche & centre de notifications',
                'summary' => "Lire les notifications via la cloche en haut à droite ou la page Centre de notifications.",
                'category' => 'notifications',
                'audience' => 'admin',
                'display_order' => 10,
                'body' => <<<'MD'
# Cloche & centre de notifications

Aspha Pro envoie des notifications pour tout événement métier important :
nouveau RDV, devis validé, ticket affecté, document à renouveler, etc.

## La cloche (en haut à droite)

Cliquer sur l'**icône cloche** ouvre un panneau déroulant :

- Les **50 dernières** notifications.
- Badge rouge avec **compteur de non-lues**.
- Chaque notif : icône colorée par module + texte + lien « Ouvrir ».
- Clic sur une notif → la marque comme lue + ouvre la cible.

> 📸 *Capture d'écran à venir : dropdown cloche avec notifications colorées*

## Page Centre de notifications

Pour une vue exhaustive avec filtres et historique :

**Sidebar → Notifications**, OU clic sur **« Voir toutes les notifications »**
en bas du dropdown cloche.

Tu disposes de :

- **Filtre par statut** : Toutes / Non lues / Lues.
- **Filtre par type** : grouper par module (Tickets, Documents, Ventes…).
- **Recherche** texte.
- **Pagination** (25 par page).
- Bouton **Tout marquer comme lu**.
- Lien « Ouvrir » contextuel selon `target_type` (intervention, facture, devis,
  ticket, document, mission…).

> 📸 *Capture d'écran à venir : page Centre de notifications avec filtres*

## À savoir

- Chaque type a son **icône + couleur** (cf. `lib/notification-styles.ts`).
- Les **bordures de gauche** colorées + **badges modules** facilitent la
  priorisation visuelle.
- L'**auteur d'une action** ne reçoit JAMAIS de notif pour son propre
  événement (évite le spam).

## Astuces

- Active les **notifications navigateur** (à venir V1.1) pour les urgences.
- Si tu reçois trop de notifs, désactive certains types depuis tes
  **préférences** (voir article suivant).

**Voir aussi :** [Types & préférences de notifications](#)
MD,
            ],
            [
                'slug' => 'notifications-types-preferences',
                'title' => 'Types & préférences de notifications',
                'summary' => "Liste des types de notifications et personnalisation des canaux (cloche, e-mail, push).",
                'category' => 'notifications',
                'audience' => 'admin',
                'display_order' => 20,
                'body' => <<<'MD'
# Types & préférences de notifications

Aspha Pro distingue de nombreux **types** de notifications, chacun rattaché à
un module. Tu peux personnaliser quels types tu reçois et par quel canal.

## Principaux types

| Code | Module | Déclencheur |
|---|---|---|
| `intervention_modified` | Planning | RDV déplacé/modifié |
| `intervention_unassigned` | Planning | RDV à pourvoir (admin) |
| `mission_created` | Missions | Mission créée (client + admins) |
| `quote_sent` | Ventes | Devis envoyé (client) |
| `quote_accepted` | Ventes | Devis validé (admin) |
| `invoice_issued` | Ventes | Facture émise (client) |
| `client_request_message` | Tickets | Nouveau message sur ticket |
| `client_request_assigned` | Tickets | Ticket affecté à intervenant |
| `client_request_status` | Tickets | Changement de statut |
| `document_renewal` | Documents | Document expirant sous 30j |
| `message` | Messagerie | Nouveau message interne |
| `weekly_hours_alert` | Planning | Heures > seuil |
| `unbadged_intervention` | Planning | RDV terminé non badgé +30 min |

## Canaux

- **In-app** (cloche) : toujours actif.
- **E-mail** : configurable.
- **Push mobile (FCM)** : à venir (credentials Firebase à brancher).
- **SMS (Twilio)** : optionnel.

## Personnaliser ses préférences

1. Clique sur ton avatar → **Mon profil**.
2. Section **Préférences de notifications**.
3. Coche / décoche les types par canal.
4. Enregistre.

> 📸 *Capture d'écran à venir : section préférences de notifications*

## À savoir

- Le canal **in-app** ne peut PAS être désactivé (sinon tu rates des infos
  vitales). Seuls e-mail et push peuvent être coupés.
- La table `notification_preferences` stocke ces préférences ; un compte
  vierge utilise les défauts (tout activé).

## Astuces

- Pour le **calme**, désactive les notifs e-mail des types de faible enjeu
  (ex. `intervention_modified`) et garde celles à fort enjeu (`document_renewal`).
- Les admins gestionnaires reçoivent les notifs liées à **leurs** clients
  (matching via `owner_user_id`).

**Voir aussi :** [Cloche & centre de notifications](#)
MD,
            ],
            [
                'slug' => 'telegestion-qr-saisie',
                'title' => 'Télégestion : QR codes & saisie manuelle',
                'summary' => "Générer les QR codes à apposer chez le client + corriger les badgeages oubliés.",
                'category' => 'telegestion',
                'audience' => 'admin',
                'display_order' => 10,
                'body' => <<<'MD'
# Télégestion : QR codes & saisie manuelle

La **télégestion** permet de tracer la présence des intervenants sur site via
QR codes scannés ou saisie manuelle. C'est la **preuve d'exécution** des RDV.

## QR codes

### Générer un QR pour une adresse client

1. Va dans **Télégestion → QR codes**.
2. Liste les adresses client (filtrable par client).
3. Sur la ligne d'une adresse, clique sur **Générer le QR**.
4. Télécharge le PDF (format A6 pour impression et affichage).
5. Imprime et appose le QR à l'adresse (entrée, badgeuse, panneau).

> 📸 *Capture d'écran à venir : liste des adresses avec bouton « Générer QR »*

### Côté intervenant (mobile)

1. Ouvre l'app mobile / l'extranet Aspha.
2. Onglet **Badger**.
3. Scanne le QR à l'arrivée → **entrée enregistrée** + horodatage GPS optionnel.
4. À la sortie : re-scanner le QR → **sortie enregistrée**.

## Saisie manuelle

En cas d'**oubli**, de **panne mobile** ou de **QR illisible**, l'admin
saisit le badgeage à la main :

1. Va dans **Télégestion → Saisie manuelle**.
2. Choisis **intervenant**, **RDV concerné**, **heures entrée/sortie**.
3. Renseigne un **motif** obligatoire (oubli, panne…).
4. Valide.

> 📸 *Capture d'écran à venir : formulaire saisie manuelle*

Tu peux aussi valider un badgeage depuis le **RDV directement** (voir l'article
« Badgeage manuel » dans la catégorie Planning).

## À savoir

- Toute saisie manuelle est **tracée** (auteur, date, motif) pour audit.
- Si l'API mobile n'envoie pas de coordonnées GPS, l'event est quand même
  accepté (option fallback).
- Les saisies sont visibles dans la **liste des télégestions** filtrable
  par intervenant / date.

## Astuces

- Imprime les QR sur du **papier plastifié résistant** à l'humidité.
- Forme tes intervenants au scan dès leur 1er jour pour éviter les oublis.

**Voir aussi :** [Badgeage manuel depuis le planning](#)
MD,
            ],
            [
                'slug' => 'flotte-vehicules',
                'title' => 'Flotte de véhicules',
                'summary' => "Gérer la flotte de véhicules de société et les affectations aux intervenants.",
                'category' => 'flotte',
                'audience' => 'admin',
                'display_order' => 10,
                'body' => <<<'MD'
# Flotte de véhicules

Le module **Flotte** centralise les véhicules de société et leurs affectations
aux intervenants.

## Créer un véhicule

1. Va dans **Flotte**.
2. Clique sur **+ Nouveau véhicule**.
3. Renseigne :
   - **Immatriculation**.
   - **Marque / modèle**.
   - **Type** (utilitaire, voiture, scooter…).
   - **Énergie** (essence, diesel, électrique, hybride).
   - **Date de mise en service**.
   - **Kilométrage** initial.
   - **Photo** (facultative).
4. Enregistre.

> 📸 *Capture d'écran à venir : liste des véhicules de la flotte*

## Affecter un véhicule à un intervenant

1. Sur la fiche véhicule, repère la section **Affectation actuelle**.
2. Clique sur **Affecter**.
3. Choisis l'intervenant + date de début (+ fin si temporaire).
4. Enregistre.

Un intervenant ne peut avoir qu'**un seul véhicule actif à la fois** (contrainte
`vehicle_assignments` : `(employee_id) WHERE end_date IS NULL`).

## Incidents

Onglet **Incidents** d'un véhicule : sinistre, panne, contravention.

- Date + heure de l'incident.
- Description.
- Photos (uploads).
- Statut (ouvert, en cours, clos).

## À savoir

- L'historique des affectations est conservé (qui a roulé avec ce véhicule et
  quand).
- Les **véhicules réformés** restent en BDD pour l'historique (statut
  `archived`).
- Les **permissions Flotte** sont à durcir (V1.1 — actuellement tout user
  authentifié peut assigner).

## Astuces

- Fais un **état des lieux photographique** à chaque changement d'affectation
  (utile en cas de litige).
- Range le carnet d'entretien dans **Documents** de la fiche véhicule.

**Voir aussi :** [Documents : uploader](#)
MD,
            ],

            // ============================================================
            // PARAMÈTRES + ADMIN (3)
            // ============================================================
            [
                'slug' => 'parametres-mon-entreprise',
                'title' => 'Paramètres → Mon entreprise',
                'summary' => "Détail du contenu de l'onglet Mon entreprise (raison sociale, SIRET, TVA, adresse, GPS, logo).",
                'category' => 'parametres',
                'audience' => 'admin',
                'display_order' => 10,
                'body' => <<<'MD'
# Paramètres → Mon entreprise

L'onglet **Mon entreprise** des Paramètres regroupe les informations légales
de ton **entité** (raison sociale, SIRET, TVA intracommunautaire, adresse,
GPS, logo). Ces informations alimentent les en-têtes de PDF (devis,
factures, attestations).

## Où l'ouvrir

**Paramètres → Mon entreprise** (premier onglet, accessible aux admins).

Voir aussi l'article **« Configurer son entreprise »** dans la catégorie
Démarrage pour une vue pas-à-pas.

> 📸 *Capture d'écran à venir : onglet Mon entreprise*

## Multi-entités

Si tu opères plusieurs entités juridiques (Aspha Pro Lille, Aspha Pro Lyon…),
tu peux les créer ici. Chaque client est ensuite rattaché à une entité
(champ `entity_id`).

## À savoir

- Sans **SIRET** et **TVA intracommunautaire**, la génération de Factur-X est
  **bloquée** (HTTP 422 explicite : « SIRET émetteur requis pour Factur-X
  EN16931 »).
- Les coordonnées GPS sont auto-calculées par BAN.gouv.fr.
- Le logo recommandé : PNG transparent, ~400×120 px.

## Astuces

- Maintiens un **logo de meilleure qualité** que tu utilises ailleurs : c'est
  l'image de ton entreprise sur les factures envoyées au client.

**Voir aussi :** [Configurer son entreprise (démarrage)](#) · [PDF Factur-X](#)
MD,
            ],
            [
                'slug' => 'parametres-docs-requis',
                'title' => 'Documents requis pour les intervenants',
                'summary' => "Définir la liste des documents obligatoires (RIB, carte vitale, pièce d'identité…) pour chaque intervenant.",
                'category' => 'parametres',
                'audience' => 'admin',
                'display_order' => 20,
                'body' => <<<'MD'
# Documents requis (intervenants)

L'onglet **Paramètres → Documents requis** te permet de définir la liste des
**types de documents obligatoires** pour chaque intervenant. La fiche
intervenant affiche ensuite une **checklist** pour vérifier la conformité.

## Configurer la liste

1. Va dans **Paramètres → Documents requis**.
2. Clique sur **+ Nouveau type requis**.
3. Renseigne :
   - **Libellé** (ex. *Pièce d'identité*).
   - **Description** courte.
   - **Obligatoire à l'embauche** (oui/non).
   - **Date d'expiration requise** (oui/non).
4. Enregistre.

> 📸 *Capture d'écran à venir : liste des types de documents requis*

Exemples : RIB, pièce d'identité recto-verso, carte vitale, attestation URSSAF,
permis de conduire, CACES R489, etc.

## Checklist côté intervenant

Sur la fiche intervenant, l'onglet **Documents** affiche une checklist
automatique :

- ✅ Document fourni + non expiré.
- 🟠 Document fourni mais expirant dans 30 jours.
- 🔴 Document fourni mais expiré.
- ⚪ Document manquant.

## À savoir

- La checklist est calculée à partir de la table `required_document_types`
  (relation `documents()` filtrée par `document_type`).
- Les types peuvent être **désactivés** (et pas supprimés) pour préserver
  l'historique de conformité passée.

## Astuces

- Maintiens cette liste à jour avec **les obligations réglementaires** de ton
  secteur (médecine du travail, casier judiciaire pour certains métiers…).
- Avant un audit URSSAF, contrôle 1 fois par trimestre la checklist de chaque
  intervenant.

**Voir aussi :** [Uploader un document](#) · [Renouvellement des documents](#)
MD,
            ],
            [
                'slug' => 'admin-utilisateurs',
                'title' => 'Gestion des utilisateurs (super_admin)',
                'summary' => "Créer un admin, un compte technique, gérer rôles & statuts (réservé au super_admin).",
                'category' => 'admin-users',
                'audience' => 'admin',
                'display_order' => 10,
                'body' => <<<'MD'
# Gestion des utilisateurs

La page **Administration → Utilisateurs** est réservée au rôle **super_admin**.
Elle gère les comptes Laravel (User) **distincts** des comptes métier
(Client / Intervenant).

## Bandeau de contexte

En haut de la page, un bandeau explicite **précise le scope** :

> Cette page liste les **comptes de connexion** Laravel — c'est-à-dire les
> personnes qui peuvent se connecter à l'ERP. Pour créer un client/intervenant,
> passe par leurs onglets dédiés.

> 📸 *Capture d'écran à venir : bandeau de contexte + liste utilisateurs*

## Créer un nouvel utilisateur

1. Clique sur **+ Nouvel utilisateur**.
2. Renseigne :
   - **Nom**, **prénom**.
   - **E-mail** (servira d'identifiant).
   - **Rôle** : `super_admin`, `admin`, `intervenant`, `client`, `encadrement`.
   - **Statut** : `active` / `inactive`.
3. Enregistre.

Le mot de passe est **généré automatiquement** et affiché une seule fois.
Copie-le ou envoie-le par e-mail.

## Modifier / désactiver

- Édition inline pour la plupart des champs.
- Désactiver un utilisateur l'empêche de se connecter (statut `inactive`).
- Supprimer définitivement = action super_admin uniquement.

## Garde-fous

- ❌ Un **super_admin ne peut pas se rétrograder lui-même** ni se désactiver
  (anti-lockout : si on perd le dernier super_admin, plus personne pour
  rétablir).
- L'audit log trace toute création / modification / suppression de compte.

## À savoir

- Les **rôles** déterminent les permissions effectives (Spatie Permissions).
- Distinction stricte entre `portal_user_id` (client extranet) et `owner_user_id`
  (admin gestionnaire) — l'un n'est pas l'autre.
- Les comptes **techniques** (intégrations, scripts) doivent avoir un rôle
  dédié si possible (pas `super_admin` par défaut).

## Astuces

- Garde au moins **deux super_admins** (toi + un binôme de confiance) pour
  ne jamais te retrouver bloqué.
- Documente dans un mémo interne qui a accès à quoi.

**Voir aussi :** [Configurer son entreprise](#) · [Accès extranet client](#) · [Accès extranet intervenant](#)
MD,
            ],

            // ============================================================
            // EXTRANET INTERVENANT (4)
            // ============================================================
            [
                'slug' => 'intervenant-extranet-decouverte',
                'title' => 'Bienvenue sur ton extranet intervenant',
                'summary' => "Présentation des rubriques disponibles sur ton espace personnel intervenant.",
                'category' => 'extranet-intervenant',
                'audience' => 'intervenant',
                'display_order' => 10,
                'body' => <<<'MD'
# Bienvenue sur ton extranet intervenant

Ton **extranet** est ton espace personnel chez Aspha Pro : tu y consultes ton
planning, tes documents, ton profil et tu échanges avec ton encadrement.

## Rubriques disponibles

| Rubrique | À quoi ça sert |
|---|---|
| **Accueil** | Vue d'ensemble : RDV du jour, alertes, messages non lus |
| **Mon planning** | Calendrier de tes RDV (jour/semaine/mois) |
| **Mon profil** | Tes infos personnelles, mot de passe |
| **Mes documents** | Tes documents (RIB, pièce d'identité…) et leur date d'expiration |
| **Signalements** | Créer un ticket à l'attention de ton encadrement |
| **Messagerie** | Échanger avec les admins et collègues |

> 📸 *Capture d'écran à venir : page d'accueil extranet intervenant*

## Navigation mobile

L'extranet est **optimisé mobile**. Tu peux l'ajouter en raccourci sur ton
écran d'accueil (PWA) :

- Sur iPhone (Safari) : bouton Partager → « Sur l'écran d'accueil ».
- Sur Android (Chrome) : menu `⋮` → « Ajouter à l'écran d'accueil ».

## À savoir

- Tu vois **uniquement tes propres RDV / documents / tickets**. Impossible
  d'accéder à ceux d'un collègue.
- Les **prix** des prestations sont **masqués** sur ton extranet.
- Si tu oublies ton mot de passe, demande à ton admin de le régénérer.

## Astuces

- Pense à **badger** systématiquement à l'arrivée et au départ chez le client
  (QR code).
- Consulte ton planning **la veille au soir** pour préparer ta journée.

**Voir aussi :** [Mon planning](#) · [Mon profil & documents](#) · [Signalements & messagerie](#)
MD,
            ],
            [
                'slug' => 'intervenant-mon-planning',
                'title' => 'Consulter mon planning',
                'summary' => "Visualiser tes RDV de la semaine, comprendre les statuts et préparer tes interventions.",
                'category' => 'extranet-intervenant',
                'audience' => 'intervenant',
                'display_order' => 20,
                'body' => <<<'MD'
# Consulter mon planning

L'onglet **Mon planning** affiche tous tes RDV à venir et passés sous forme
de calendrier.

## Vues disponibles

- **Jour** : la journée en cours, créneaux 15 min.
- **Semaine** : vue par défaut.
- **Liste** : liste linéaire de tes prochains RDV (idéale mobile).

> 📸 *Capture d'écran à venir : vue Semaine sur mobile*

## Couleurs de tes RDV

| Couleur | Statut |
|---|---|
| 🔴 Rouge | Annulé |
| 🟠 Orange | À pourvoir (pas encore confirmé) |
| 🔵 Bleu | Planifié, en attente |
| 🟢 Vert | Terminé + badgé |
| 🟣 Violet | Terminé NON badgé (à corriger) |

## Détail d'un RDV

Au clic sur un RDV, tu vois :

- **Client** + adresse.
- **Horaire** prévu.
- **Note interne** du RDV (instructions admin spécifiques).
- **Consignes client** (informations utiles du client).
- **Badge / pointer** (boutons pour scanner le QR).

> 📸 *Capture d'écran à venir : détail d'un RDV avec consignes affichées*

## À savoir

- Tu peux **consulter** ton planning mais **pas le modifier** (lecture seule).
  Pour une demande de modification, contacte ton admin via la messagerie.
- Les **prix** sont volontairement masqués.
- Tes RDV sont synchronisés en temps réel (modification admin = mise à jour
  côté extranet).

## Astuces

- Avant de partir, vérifie les **consignes client** : code d'accès, présence
  d'animaux, horaires d'accès spécifiques.
- En cas de **retard**, préviens via la messagerie pour qu'on prévienne le
  client.

**Voir aussi :** [Mon profil & documents](#) · [Signalements & messagerie](#)
MD,
            ],
            [
                'slug' => 'intervenant-mon-profil-documents',
                'title' => 'Mon profil & mes documents',
                'summary' => "Mettre à jour tes infos personnelles, gérer tes documents et leurs renouvellements.",
                'category' => 'extranet-intervenant',
                'audience' => 'intervenant',
                'display_order' => 30,
                'body' => <<<'MD'
# Mon profil & mes documents

L'onglet **Mon profil** te permet de tenir à jour tes informations
personnelles. L'onglet **Mes documents** affiche les pièces que tu as
fournies + leur date d'expiration.

## Mon profil

Champs modifiables :

- **Photo** de profil.
- **Téléphone**, **e-mail personnel**.
- **Adresse postale**.
- **Personne à prévenir** (en cas d'urgence).
- **Mot de passe** (section sécurité).

⚠️ Tu **ne peux pas modifier** : ton contrat, ton salaire, ton entité. Ces
infos sont gérées par ton encadrement.

> 📸 *Capture d'écran à venir : page Mon profil intervenant*

## Mes documents

Liste des documents que ton encadrement a uploadés pour toi et que tu as
toi-même fournis (RIB, pièce d'identité, attestation mutuelle…).

Pour chaque document :

- **Date d'expiration** affichée.
- Badge couleur (vert = OK, orange = expire bientôt, rouge = expiré).
- Lien **Télécharger** pour récupérer le PDF.

## Renouveler un document

Si tu reçois une **notification** « Document à renouveler » :

1. Demande à ton encadrement comment fournir le nouveau document (e-mail
   avec scan PDF, dépôt physique…).
2. Une fois uploadé, la coche verte apparaît.

Tu **ne peux pas** uploader directement depuis ton extranet (sécurité : seul
ton admin peut le faire en V1).

## À savoir

- Toute modification de ton profil est tracée (audit log).
- Tes documents sont stockés sur **disque privé** et accessibles uniquement
  à toi + ton encadrement (jamais publics).

## Astuces

- Mets à jour ton **téléphone** rapidement en cas de changement : c'est par là
  que ton encadrement te joindra en cas d'urgence.

**Voir aussi :** [Premiers pas extranet intervenant](#) · [Signalements & messagerie](#)
MD,
            ],
            [
                'slug' => 'intervenant-signalements-messagerie',
                'title' => 'Signalements & messagerie',
                'summary' => "Créer un ticket à l'attention de ton encadrement et échanger via la messagerie interne.",
                'category' => 'extranet-intervenant',
                'audience' => 'intervenant',
                'display_order' => 40,
                'body' => <<<'MD'
# Signalements & messagerie

Deux canaux te permettent de communiquer avec ton encadrement :

- **Signalements** (tickets liés à un client/RDV).
- **Messagerie interne** (libre, 1-à-1 ou groupe).

## Créer un signalement

Un signalement remonte à ton encadrement un problème observé chez un client
(client absent, dégradation, comportement difficile, besoin de matériel,
sécurité…).

1. Va dans **Signalements** → **+ Nouveau signalement**.
2. Choisis le **client** concerné (parmi ceux où tu es intervenu).
3. Choisis le **type** (incident, demande, question…).
4. Saisis **sujet** + **description détaillée**.
5. Envoie.

> 📸 *Capture d'écran à venir : formulaire création signalement*

Ton encadrement reçoit une **notification immédiate** et peut te répondre via
le fil de discussion du ticket.

⚠️ **Sécurité** : tu ne peux signaler **que des clients où tu as déjà
travaillé** (au moins 1 intervention chez ce client). Anti-spoofing.

## Fil de discussion sur un ticket

Tous tes signalements ont un **fil de discussion** :

- Bulles alignées (tes messages à droite).
- Auto-scroll vers le dernier message.
- `Ctrl+Entrée` pour envoyer rapidement.
- Désactivé si le ticket est clôturé par ton encadrement.

## Messagerie interne

L'onglet **Messagerie** te permet de discuter directement avec :

- Tes admins.
- Tes collègues intervenants (selon les conversations où tu es invité).

⚠️ Les **clients** ne sont **jamais** dans la messagerie interne (ils
passent par les tickets côté extranet client).

## À savoir

- Tu reçois une notification **cloche** à chaque nouveau message OU réponse
  à un de tes signalements.
- Les **prix** ne sont pas affichés dans les conversations.

## Astuces

- Pour un sujet **urgent terrain** (intervention en cours), passe un appel
  téléphonique en plus du signalement.
- Sois **précis et factuel** dans tes signalements : ton encadrement traite
  mieux des faits que des impressions.

**Voir aussi :** [Mon planning](#) · [Mon profil](#)
MD,
            ],

            // ============================================================
            // EXTRANET CLIENT (4)
            // ============================================================
            [
                'slug' => 'client-extranet-decouverte',
                'title' => 'Bienvenue sur votre extranet client',
                'summary' => "Présentation des rubriques de votre espace personnel client.",
                'category' => 'extranet-client',
                'audience' => 'client',
                'display_order' => 10,
                'body' => <<<'MD'
# Bienvenue sur votre extranet client

Votre **extranet** est votre espace personnel chez Aspha Pro : vous y suivez
vos devis, factures, prestations en cours, vous créez des demandes et
consultez vos documents.

## Rubriques disponibles

| Rubrique | À quoi ça sert |
|---|---|
| **Accueil** | Vue d'ensemble : prochain RDV, factures impayées, devis à valider |
| **Mes devis** | Liste des devis reçus, à valider/refuser, PDF |
| **Mes factures** | Liste des factures, statut paiement, téléchargement PDF |
| **Mes prestations** | Prestations actives sur vos contrats |
| **Mes demandes** | Tickets que vous avez créés ou qui vous concernent |
| **Mes documents** | Documents partagés avec vous (contrats, attestations) |

> 📸 *Capture d'écran à venir : page d'accueil extranet client*

## À savoir

- Vous voyez **uniquement vos propres** données. Aucun risque de fuite vers
  un autre client.
- L'extranet est **mobile-friendly** : utilisable depuis votre téléphone.
- Vous pouvez ajouter Aspha en **raccourci PWA** sur l'écran d'accueil.

## Astuces

- Consultez vos **devis** régulièrement : un devis envoyé sans réponse sous
  7 jours est rappelé à notre équipe.
- Activez les **notifications navigateur** (à venir V1.1) pour ne rien
  manquer.

**Voir aussi :** [Mes devis](#) · [Mes factures](#) · [Mes demandes & documents](#)
MD,
            ],
            [
                'slug' => 'client-mes-devis',
                'title' => 'Valider ou refuser un devis',
                'summary' => "Consulter un devis reçu, le télécharger en PDF, le valider ou le refuser.",
                'category' => 'extranet-client',
                'audience' => 'client',
                'display_order' => 20,
                'body' => <<<'MD'
# Valider ou refuser un devis

Quand Aspha vous envoie un devis, vous recevez une notification dans votre
extranet (et un e-mail si configuré). L'onglet **Mes devis** liste tous vos
devis avec leur statut.

## Consulter un devis

1. Cliquez sur le devis pour ouvrir la **page détail**.
2. Vérifiez :
   - Les **prestations proposées**.
   - Les **quantités** et **prix unitaires**.
   - La **TVA** et le **total TTC**.
   - Les **dates de validité**.
3. Téléchargez le **PDF** (bouton « PDF ») pour le partager en interne ou
   l'archiver.

> 📸 *Capture d'écran à venir : page détail d'un devis avec boutons Valider/Refuser/PDF*

## Valider le devis

1. Cliquez sur **Valider le devis**.
2. Confirmez dans la boîte de dialogue.
3. Le devis passe en statut **« Validé »**.
4. Aspha est **notifié immédiatement** et créera la mission correspondante.

## Refuser le devis

1. Cliquez sur **Refuser le devis**.
2. Renseignez un **motif** (facultatif mais apprécié pour qu'Aspha s'adapte).
3. Confirmez.
4. Le devis passe en statut **« Refusé »**.

## À savoir

- Une fois validé ou refusé, le **devis est figé** (vous ne pouvez plus
  revenir en arrière depuis l'extranet — contactez Aspha si besoin).
- La **création de la mission** chez Aspha se fait sur clic admin (pas
  automatique), mais le bouton est là.
- Les **devis expirés** (date de validité dépassée sans réponse) sont marqués
  `expired`.

## Astuces

- Téléchargez systématiquement le **PDF** pour votre comptabilité avant
  validation.
- En cas de question, créez une **demande** depuis l'onglet Mes demandes.

**Voir aussi :** [Mes factures](#) · [Mes demandes](#)
MD,
            ],
            [
                'slug' => 'client-mes-factures-prestations',
                'title' => 'Mes factures & mes prestations',
                'summary' => "Télécharger vos factures Factur-X et consulter les prestations actives sur vos contrats.",
                'category' => 'extranet-client',
                'audience' => 'client',
                'display_order' => 30,
                'body' => <<<'MD'
# Mes factures & mes prestations

Deux rubriques de votre extranet vous permettent de suivre votre relation
commerciale avec Aspha : vos **factures** et les **prestations actives**.

## Mes factures

Liste de toutes les factures émises pour vous, avec :

- **Numéro** (`INV-AAAAMM-XXXX`).
- **Date d'émission**, **date d'échéance**.
- **Montant TTC**.
- **Statut** : `Payée` / `Partielle` / `Impayée` / `Annulée`.
- Bouton **PDF** pour téléchargement.

> 📸 *Capture d'écran à venir : liste Mes factures*

### Format Factur-X

Toutes vos factures B2B sont au format **Factur-X PDF/A-3** (norme légale
EN 16931 depuis le 1er septembre 2026) :

- PDF lisible humainement.
- **XML CII embarqué** lisible par votre expert-comptable et l'administration.

### Régler une facture

Aspha vous indique le **mode de paiement** sur la facture (chèque, SEPA, CB,
virement, espèces). L'extranet ne permet pas (encore) le paiement en ligne.

## Mes prestations

Liste des **prestations actives** sur vos contrats / missions :

- **Libellé** (ex. *Ménage hebdo siège*).
- **Fréquence** (hebdomadaire, mensuelle…).
- **Adresse** d'intervention.
- **Prochain RDV** prévu.

> 📸 *Capture d'écran à venir : liste Mes prestations*

Vous pouvez suivre l'état de vos prestations sans dépendre d'un appel à
Aspha.

## À savoir

- Les **factures** sont téléchargeables tant que vous restez actif.
- Les **prestations terminées** ou archivées n'apparaissent plus ici (mais
  restent dans votre historique chez Aspha).

## Astuces

- Téléchargez vos factures **dès réception** et transmettez-les à votre
  comptable (le format Factur-X automatise leur saisie).
- Vérifiez la **date d'échéance** pour éviter les rappels.

**Voir aussi :** [Mes devis](#) · [Mes demandes & documents](#)
MD,
            ],
            [
                'slug' => 'client-mes-demandes-documents',
                'title' => 'Mes demandes & mes documents',
                'summary' => "Créer un ticket à destination d'Aspha et consulter les documents partagés avec vous.",
                'category' => 'extranet-client',
                'audience' => 'client',
                'display_order' => 40,
                'body' => <<<'MD'
# Mes demandes & mes documents

L'extranet client met à votre disposition deux outils complémentaires : les
**demandes** (tickets) pour communiquer avec Aspha et **vos documents**
partagés.

## Mes demandes (tickets)

### Créer une demande

1. Allez dans **Mes demandes** → **+ Nouvelle demande**.
2. Choisissez le **type** (réclamation, question, demande spéciale).
3. Renseignez **sujet** + **description détaillée**.
4. Envoyez.

> 📸 *Capture d'écran à venir : formulaire création demande*

Aspha est **notifié immédiatement**. Vous voyez ensuite votre demande dans
la liste avec son statut (Ouverte, En cours, Résolue, Clôturée).

### Fil de discussion

Chaque demande dispose d'un **fil de discussion** : vous échangez avec
Aspha en temps réel sans repasser par e-mail.

- Bulles alignées (vos messages à droite).
- Auto-scroll vers le dernier message.
- Désactivé si la demande est clôturée.

## Mes documents

Liste des documents qu'Aspha a partagés avec vous :

- **Contrats** signés.
- **Attestations** (de prestation, fiscales…).
- **Devis** validés / **factures** PDF.
- **Autres** (rapport d'intervention, fiche technique…).

> 📸 *Capture d'écran à venir : liste Mes documents*

Pour chaque document :

- **Libellé** + **type**.
- **Date d'ajout**.
- **Date d'expiration** (si applicable, avec badge couleur).
- Bouton **Télécharger**.

## À savoir

- Vous ne voyez que les documents **explicitement partagés** avec vous (Aspha
  coche l'audience `client` + `is_client_visible`).
- Vos demandes restent en BDD même après clôture (historique).
- Aucun fichier n'est public : seul votre compte y a accès.

## Astuces

- Avant d'appeler Aspha pour une question, créez une **demande** : ça laisse
  une trace écrite utile à toutes les parties.
- Téléchargez les **contrats signés** dès réception pour les archiver de votre
  côté.

**Voir aussi :** [Premiers pas extranet client](#) · [Mes devis](#) · [Mes factures](#)
MD,
            ],
        ];
    }
}
