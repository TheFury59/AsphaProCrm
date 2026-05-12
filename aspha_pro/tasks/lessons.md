# Aspha Pro — Lessons

Format : `[YYYY-MM-DD] | ce qui a mal tourné | règle pour l'éviter`

- [2026-05-12] | shadcn 4.x exige Tailwind v4 (installation initiale v3 a planté) | toujours vérifier la matrice de compat shadcn × Tailwind avant l'install
- [2026-05-12] | CORS `allowed_origins: ['*']` incompatible avec `supports_credentials: true` (browser rejette les cookies) | utiliser `allowed_origins_patterns: ['/.*/']` en dev avec credentials
- [2026-05-12] | `Relation::enforceMorphMap()` bloque Spatie ActivityLog (User fait des morphs auto) | utiliser `Relation::morphMap()` (sans enforce)
- [2026-05-12] | `DateTime::createFromFormat` retourne `false` avec Carbon → Factur-X cassé | utiliser `new \DateTime((string) $value)` quand la source est Carbon
- [2026-05-12] | `exception_date` stockée en datetime UTC (22:00Z = 18/05 Paris) ne matchait pas la clé YYYY-MM-DD | `Carbon::parse(...)->toDateString()` pour les clés d'exception
- [2026-05-12] | shape Eloquent `clientCompanies` HasMany alors qu'on attend `company` HasOne | patcher le model après génération automatique DBML, et propager le rename dans tous les eager loads
- [2026-05-12] | PowerShell `ConvertTo-Json` + `Invoke-WebRequest` encoding chelou en UTF-16 BOM | passer du JSON brut en string littérale plutôt que via hashtable convertie
- [2026-05-12] | Notifications table avait `notification_type_id`/`target_type`/`target_id` (pas `type`/`data`) | aligner systématiquement le type TypeScript sur la migration réelle, pas sur l'assomption "Laravel notifications standard"
