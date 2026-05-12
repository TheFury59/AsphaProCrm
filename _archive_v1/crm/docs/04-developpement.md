# Développement — cheatsheet quotidienne

## Démarrer

```bash
npm run dev          # backend + frontend en parallèle (recommandé)
npm run dev:back     # backend seul
npm run dev:front    # frontend seul
```

Stoppe avec `Ctrl+C` (les deux serveurs s'arrêtent ensemble).

## BDD

```bash
# Reset complet (DROP toutes tables + seed)
npm run fresh

# Migrations
php backend/artisan migrate                        # appliquer les nouvelles
php backend/artisan migrate:rollback               # annuler la dernière batch
php backend/artisan migrate:status                 # voir l'état
php backend/artisan migrate:refresh                # rollback all + migrate (sans seed)
php backend/artisan migrate:fresh                  # DROP all + migrate (sans seed)
php backend/artisan migrate:fresh --seed           # DROP all + migrate + seed

# Créer une migration
php backend/artisan make:migration create_xxx_table
php backend/artisan make:migration alter_xxx_add_yyy_column

# Reset uniquement les seeders (sans toucher aux tables)
php backend/artisan db:seed
```

## Création de code Laravel

```bash
# Model + migration + factory + seeder
php backend/artisan make:model Foo -mfs

# Controller "API resource" (index/show/store/update/destroy)
php backend/artisan make:controller FooController --api --model=Foo

# Form Request (validation)
php backend/artisan make:request StoreFooRequest

# API Resource (transformation JSON)
php backend/artisan make:resource FooResource
php backend/artisan make:resource FooCollection

# Job
php backend/artisan make:job MaterializeServiceAssignment

# Test
php backend/artisan make:test FooControllerTest               # Feature
php backend/artisan make:test FooTest --unit                  # Unit
```

## Tinker (REPL Laravel)

```bash
php backend/artisan tinker
```
```php
>>> User::first();
>>> Site::create(['name' => 'Test', 'code' => 'TEST']);
>>> User::find(1)->assignRole('manager');
>>> exit
```

## Routes

```bash
php backend/artisan route:list                         # toutes les routes
php backend/artisan route:list --path=api              # filtrer
```

## Cache & config

```bash
php backend/artisan config:clear                       # à faire après modif .env
php backend/artisan cache:clear
php backend/artisan view:clear
php backend/artisan optimize:clear                     # tout d'un coup
```

## Frontend

```bash
npm --prefix frontend run dev                          # serveur dev
npm --prefix frontend run build                        # build prod
npm --prefix frontend run preview                      # preview du build
npm --prefix frontend run lint                         # ESLint

# Ajouter une dépendance
npm --prefix frontend install <package>
npm --prefix frontend install -D <package>             # devDep
```

### Ajouter un composant shadcn/ui (manuel pour l'instant)

shadcn/ui n'a pas encore été initialisé via CLI dans ce projet (les tokens CSS sont posés dans `index.css`, le `cn()` helper dans `lib/utils.ts`). Pour ajouter un composant :

1. Va sur https://ui.shadcn.com/docs/components/<nom>
2. Copie le code source dans `frontend/src/components/ui/<nom>.tsx`
3. Installe les Radix deps si requis (ex. `npm install @radix-ui/react-dialog`)

## Tests

```bash
# Backend (PHPUnit)
npm run test:back
php backend/artisan test --filter=Auth                 # filtrer par nom
php backend/artisan test --coverage                    # avec couverture (Xdebug requis)

# Frontend — Vitest pas encore configuré (à venir si besoin)
```

## Git

```bash
# Workflow standard
git checkout -b feature/planning-crud
# ... code ...
git add -A
git commit -m "feat(planning): add appointment CRUD endpoints"
git push -u origin feature/planning-crud

# Récupérer main
git checkout main
git pull
```

## Logs

```bash
# Backend (Laravel)
Get-Content backend\storage\logs\laravel.log -Tail 50 -Wait    # PowerShell
tail -f backend/storage/logs/laravel.log                       # Unix

# Frontend (console navigateur)
F12 → Console
```

## Problèmes courants

### Le proxy Vite ne route pas vers le backend
- Backend bien lancé sur 8000 ? `curl http://127.0.0.1:8000/api/ping`
- Path bien préfixé `/api` ou `/sanctum` ? Le proxy n'attrape que ces préfixes (cf `vite.config.ts`).

### Modifications de `.env` non prises en compte
```bash
php backend/artisan config:clear
```

### Une migration plante en cours
- Lis le message — souvent une FK manquante ou un type SQLite incompatible.
- En dev : `npm run fresh` repart proprement.
- En prod : ne touche **jamais** à `migrations:fresh`. Utilise `migrate:rollback` ou écris une migration corrective.

### Un modèle n'arrive pas à charger une relation
- Le model est-il dans `app/Models/` ? Le namespace est `App\Models\Xxx`.
- La FK existe-t-elle bien (`php artisan migrate:status`) ?
- La méthode de relation a-t-elle le bon type de retour ? (`BelongsTo`, `HasMany`, `MorphTo`, …)

## Convention de commit (Conventional Commits)

```
feat(scope): nouvelle feature
fix(scope): bugfix
chore: tâches sans impact code (deps, config, …)
refactor(scope): refacto sans changer le comportement
test(scope): ajout/maj de tests
docs(scope): doc seulement
perf(scope): perf
```

Exemples :
- `feat(planning): add drag-and-drop on appointments`
- `fix(auth): handle expired session gracefully`
- `refactor(api): extract appointment serialization to resource`
