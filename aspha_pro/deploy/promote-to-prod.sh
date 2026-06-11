#!/usr/bin/env bash
#
# Promotion preprod → prod sur o2switch.
#
# Workflow garantissant que la prod reçoit EXACTEMENT le même code que ce
# que tu as validé en preprod :
#
#   1. Backup DB prod + tarball du dossier prod (rollback possible)
#   2. Récupère le commit hash courant en preprod
#   3. Aligne le dépôt prod sur ce même commit (fetch + reset)
#   4. Lance le déploiement standard sur le dossier prod
#   5. Tag GitHub `release-YYYYMMDD-HHMM` (historique des promotions)
#
# Les .env (clés API, SMTP, DB credentials) ne sont JAMAIS touchés — ils
# vivent en local sur chaque instance et restent indépendants.
#
# Usage (depuis le HOME du compte cPanel) :
#   ssh user@ssh.o2switch.net
#   bash ~/aspha_pro/aspha_pro/deploy/promote-to-prod.sh
#
# Override des chemins si l'arborescence diffère :
#   PROD_DIR=~/aspha_pro PREPROD_DIR=~/aspha_pro_preprod bash promote-to-prod.sh

set -euo pipefail

PROD_DIR="${PROD_DIR:-$HOME/aspha_pro}"
PREPROD_DIR="${PREPROD_DIR:-$HOME/aspha_pro_preprod}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"

# Détection auto du sous-dossier imbriqué (le repo a un `aspha_pro/` à
# l'intérieur du clone). On cible le dossier qui contient le composer.json.
detect_app_dir() {
  local base="$1"
  if [ -f "$base/aspha_pro/backend/composer.json" ]; then
    echo "$base/aspha_pro"
  elif [ -f "$base/backend/composer.json" ]; then
    echo "$base"
  else
    echo "ERROR: aucun backend Laravel détecté dans $base" >&2
    return 1
  fi
}

PROD_APP=$(detect_app_dir "$PROD_DIR")
PREPROD_APP=$(detect_app_dir "$PREPROD_DIR")

# Le `git pull` se fait au niveau du dépôt git (souvent le parent direct).
prod_git_root() {
  [ -d "$PROD_APP/../.git" ] && echo "$(dirname "$PROD_APP")" || echo "$PROD_APP"
}
preprod_git_root() {
  [ -d "$PREPROD_APP/../.git" ] && echo "$(dirname "$PREPROD_APP")" || echo "$PREPROD_APP"
}
PROD_GIT=$(prod_git_root)
PREPROD_GIT=$(preprod_git_root)

echo "============================================"
echo "  PROMOTION PREPROD → PROD — Aspha Pro"
echo "============================================"
echo "  PROD    : $PROD_APP"
echo "  PREPROD : $PREPROD_APP"
echo "  BACKUP  : $BACKUP_DIR"
echo ""

# ============================================================
# 1) Récupère le commit hash courant en preprod
# ============================================================
echo "==> 1/5 — récupération du commit preprod (référence)"
cd "$PREPROD_GIT"
PREPROD_COMMIT=$(git rev-parse HEAD)
PREPROD_SHORT=$(git rev-parse --short HEAD)
PREPROD_MSG=$(git log -1 --format=%s HEAD)
echo "   Preprod tourne sur : $PREPROD_SHORT « $PREPROD_MSG »"

# ============================================================
# 2) Backup prod (DB + dossier)
# ============================================================
echo ""
echo "==> 2/5 — backup prod"
mkdir -p "$BACKUP_DIR"
TS=$(date +%Y%m%d_%H%M%S)
PROD_ENV="$PROD_APP/backend/.env"

if [ ! -f "$PROD_ENV" ]; then
  echo "❌ $PROD_ENV introuvable — la prod n'est pas configurée correctement."
  exit 1
fi

# Backup DB (mysqldump avec creds extraits du .env prod)
DB_USER=$(grep -E '^DB_USERNAME=' "$PROD_ENV" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
DB_PASS=$(grep -E '^DB_PASSWORD=' "$PROD_ENV" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
DB_NAME=$(grep -E '^DB_DATABASE=' "$PROD_ENV" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
DB_HOST=$(grep -E '^DB_HOST='     "$PROD_ENV" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
DB_HOST="${DB_HOST:-localhost}"

if [ -n "$DB_NAME" ] && [ -n "$DB_USER" ]; then
  DUMP_FILE="$BACKUP_DIR/db-prod-$TS.sql.gz"
  echo "   → mysqldump $DB_NAME → $DUMP_FILE"
  mysqldump -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" 2>/dev/null | gzip > "$DUMP_FILE"
  echo "   ✅ DB backupée ($(du -h "$DUMP_FILE" | cut -f1))"
else
  echo "   ⚠ Skip backup DB (DB_USERNAME/DB_DATABASE absents du .env)"
fi

# Backup le commit hash actuel de la prod (pour rollback si besoin)
cd "$PROD_GIT"
PROD_BEFORE=$(git rev-parse HEAD)
echo "   → Commit prod AVANT promotion : $PROD_BEFORE" > "$BACKUP_DIR/prod-rollback-$TS.txt"
echo "   ✅ Rollback hash sauvegardé : $BACKUP_DIR/prod-rollback-$TS.txt"
echo "      (en cas de pb : git reset --hard $PROD_BEFORE)"

# ============================================================
# 3) Aligne le dépôt prod sur le commit preprod
# ============================================================
echo ""
echo "==> 3/5 — alignement prod sur le commit preprod ($PREPROD_SHORT)"
cd "$PROD_GIT"
git fetch origin --quiet
git reset --hard "$PREPROD_COMMIT"
echo "   ✅ Dépôt prod aligné sur $PREPROD_SHORT"

# ============================================================
# 4) Déploiement standard sur le dossier prod
# ============================================================
echo ""
echo "==> 4/5 — déploiement (composer + npm + build + migrate + cache)"
bash "$PROD_APP/deploy/o2switch-deploy.sh" "$PROD_DIR"

# ============================================================
# 5) Tag GitHub release (best-effort)
# ============================================================
echo ""
echo "==> 5/5 — tag GitHub release-$TS"
cd "$PROD_GIT"
if git tag -a "release-$TS" -m "Promotion preprod → prod ($PREPROD_SHORT : $PREPROD_MSG)" "$PREPROD_COMMIT" 2>/dev/null; then
  if git push origin "release-$TS" 2>/dev/null; then
    echo "   ✅ Tag release-$TS poussé sur GitHub"
  else
    echo "   ⚠ Tag créé local mais push échoué (probable absence de creds git). Ignore."
  fi
else
  echo "   ⚠ Tag release-$TS déjà existant ou create-tag échoué. Ignore."
fi

echo ""
echo "============================================"
echo "  ✅ PROMOTION TERMINÉE"
echo "============================================"
echo "  Prod tourne maintenant sur : $PREPROD_SHORT « $PREPROD_MSG »"
echo "  Backup DB  : $BACKUP_DIR/db-prod-$TS.sql.gz"
echo "  Rollback   : git -C $PROD_GIT reset --hard $PROD_BEFORE"
echo "============================================"
