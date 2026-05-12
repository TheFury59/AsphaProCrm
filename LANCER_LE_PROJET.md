# 🚀 Lancer Aspha Pro

Le projet est dans `aspha_pro/`. Tout est piloté depuis cette racine.

---

## ⚡ Démarrage en 1 commande

Ouvre PowerShell, et tape :

```powershell
cd "F:\Pro\BiDEv\Projet CRM aspha service\aspha_pro"
npm run dev
```

Tu verras dans le terminal :

```
[BACK]  INFO  Server running on [http://127.0.0.1:8000]
[FRONT] VITE v… ready in xxx ms
[FRONT] ➜  Local: http://127.0.0.1:5173/
```

---

## 🔑 Se connecter

1. Ouvre **`http://localhost:5173`** dans ton navigateur (Chrome / Edge)
2. Tu seras redirigé vers la page de login
3. Identifiants :
   - **Email** : `admin@aspha.local`
   - **Mot de passe** : `admin1234`
4. Tu arrives sur le **tableau de bord** (sidebar à gauche, topbar avec ton avatar en haut à droite)

---

## 🛑 Arrêter

Dans le terminal où `npm run dev` tourne → **`Ctrl + C`** (les deux serveurs s'arrêtent ensemble).

---

## 🔁 Si quelque chose plante

| Problème | Solution |
|---|---|
| Page blanche / erreur réseau | Vérifier que le backend tourne sur `:8000` (regarder le terminal pour les lignes `[BACK]`) |
| Login refuse alors que le mot de passe est bon | Vider les cookies du navigateur pour `localhost` (F12 → Application → Storage → Clear site data) |
| `php n'est pas reconnu` | Fermer et rouvrir **tous** les terminaux. Si toujours absent : `winget install PHP.PHP.8.3` |
| `composer n'est pas reconnu` | Télécharger https://getcomposer.org/Composer-Setup.exe |
| Le port 5173 ou 8000 est déjà pris | Vite passera automatiquement sur 5174 (regarder le terminal). Pour libérer 5173 : Gestionnaire des tâches → tuer les processus `node.exe` orphelins |
| BDD corrompue / reset complet | `cd aspha_pro && npm run fresh` (DROP + recrée tout avec les données initiales) |

---

## 📦 Installation depuis zéro (poste vierge)

Si tu changes de PC ou tu repars de zéro :

```powershell
cd "F:\Pro\BiDEv\Projet CRM aspha service\aspha_pro"
.\install.ps1
```

Le script vérifie les prérequis (PHP, Composer, Node), installe toutes les dépendances, crée la BDD SQLite et seed le super-admin. Ensuite `npm run dev`.

---

## 📍 URLs importantes

| URL | Rôle |
|---|---|
| http://localhost:5173 | **Application** (à utiliser au quotidien) |
| http://127.0.0.1:8000 | Backend brut (juste la welcome page Laravel — pas besoin d'y aller) |
| http://127.0.0.1:8000/api/v1/ping | Test backend (renvoie du JSON `{ "status": "ok" }`) |

---

## 📚 Documentation détaillée

- **Plan complet du projet** : [plan-rebuild-aspha-pro.docx](plan-rebuild-aspha-pro.docx)
- **README technique** : [aspha_pro/README.md](aspha_pro/README.md)
- **Schéma BDD source** : [crm_ximi_schema_final.dbml](crm_ximi_schema_final.dbml)
- **Modifications cliente** : [modification attributs CRM aspha .docx](modification%20attributs%20CRM%20aspha%20.docx)

---

> *Document mis à jour le 12 mai 2026 — Phase 0 terminée. Stack : Laravel 11 + Sanctum + Spatie / React 18 + TS + Tailwind v4 + shadcn/ui CLI.*
