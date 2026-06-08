# Aspha Pro — Mobile

App mobile (iOS + Android) compagnon du CRM Aspha Pro. Construite avec Expo SDK 53 +
Expo Router + TypeScript strict.

## Stack

- Expo SDK 53 (managed workflow)
- Expo Router 5 (file-based routing — dossier `app/`)
- TypeScript strict
- `@tanstack/react-query` pour la donnée serveur
- `zustand` pour le store auth client
- `axios` + interceptor Bearer token
- `expo-secure-store` (Keychain iOS / Keystore Android) pour le token
- `expo-camera`, `expo-location`, `expo-notifications`, `expo-local-authentication`
  — pour les sprints suivants (badgeage, push, biométrie)

## Premier lancement

Prerequis : Node 20+, un telephone avec [Expo Go](https://expo.dev/client) installe.

```bash
cd mobile
npm install
npx expo start --tunnel
```

Scanner le QR code avec Expo Go (Android) ou l'app Camera (iOS).

## Variables d'env

Copier `.env.example` vers `.env` et adapter si besoin :

```
EXPO_PUBLIC_API_URL=https://asphapro-erp.fr/api/v1
```

Les variables prefixees `EXPO_PUBLIC_` sont exposees au bundle client (cf. doc Expo).

## Scripts

- `npm start` — lance le bundler Metro
- `npm run android` / `npm run ios` — lance directement sur un emulateur
- `npm run typecheck` — verifie TypeScript sans build

## Architecture

```
mobile/
  app/
    _layout.tsx           # Root layout (auth gate + providers)
    (auth)/
      _layout.tsx         # Stack auth (login, change-password)
      login.tsx
      change-password.tsx
    (intervenant)/        # Tabs pour role intervenant/admin/super_admin
      _layout.tsx
      planning.tsx
      badgeage.tsx
      signalements.tsx
      messagerie.tsx
      profil.tsx
    (client)/             # Tabs pour role client
      _layout.tsx
      index.tsx
      devis.tsx
      factures.tsx
      demandes.tsx
      profil.tsx
  lib/
    api.ts                # axios instance + interceptors
    secure-store.ts       # wrapper expo-secure-store
    theme.ts              # tokens design Aspha
  stores/
    auth.ts               # Zustand store auth
  types/
    api.ts                # types API (aligne sur frontend web)
  components/ui/          # Button, Input, Screen, Toast
```

## Auth

L'app utilise les **Personal Access Tokens** de Sanctum (et non les cookies du web —
incompatibles avec le mobile). 3 endpoints dedies cote backend :

- `POST /mobile/login` — `{email, password, device_name}` → `{data: {token, user}}`
- `POST /mobile/logout` — Bearer → 204
- `POST /mobile/push-token` — Bearer → `{expo_push_token}` → 200

Le token est stocke dans `expo-secure-store` (Keychain / Keystore). Au demarrage, le
root layout appelle `useAuthStore.hydrate()` qui relit le token et fait un `GET /me`
pour rafraichir l'user.

Gate de navigation :
- Pas connecte → `/login`
- Connecte + `must_change_password = true` → `/change-password` (force)
- Role `intervenant` / `admin` / `super_admin` → tabs intervenant
- Role `client` → tabs client

## Prochains sprints

- P0-2 : planning intervenant + badgeage QR + GPS
- P0-3 : signalements (photo + commentaire)
- P0-4 : messagerie temps reel
- P0-5 : push notifs + bio (Face ID / empreinte)
- P1 : espace client (devis, factures, demandes)
