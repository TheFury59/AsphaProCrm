# Script PowerShell pour PROMOUVOIR preprod -> prod sur o2switch.
#
# A executer SEULEMENT apres validation manuelle de la preprod
# sur https://preprod.asphapro-erp.fr
#
# Le serveur fait automatiquement :
#   1. Backup DB prod (mysqldump | gzip dans ~/backups/)
#   2. Sauvegarde du hash commit prod (rollback)
#   3. Aligne le code prod sur le HEAD courant de main
#   4. composer install, npm build, migrate, cache
#   5. Affiche un OK final
#
# Usage : & "F:\Pro\BiDEv\Projet CRM aspha service\aspha_pro\deploy\deploy-prod.ps1"

$ErrorActionPreference = "Stop"

$SshUser = "jabi3423"
$SshHost = "ibis.o2switch.net"
$SshKey  = "$HOME\.ssh\aspha_o2switch"

Write-Host "============================================" -ForegroundColor Yellow
Write-Host "  PROMOTION PROD - Aspha Pro" -ForegroundColor Yellow
Write-Host "  Cible : https://asphapro-erp.fr" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow
Write-Host ""
$confirm = Read-Host "Es-tu sur que la preprod est valide ? (oui/non)"
if ($confirm -ne "oui") {
    Write-Host "Annule." -ForegroundColor Red
    exit 1
}

$remoteCommand = @"
set -e
cd ~/aspha_pro
TS=`$(date +%Y%m%d_%H%M%S)
# Backup DB avant promotion
DB_USER=`$(grep -E '^DB_USERNAME=' aspha_pro/backend/.env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
DB_PASS=`$(grep -E '^DB_PASSWORD=' aspha_pro/backend/.env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
DB_NAME=`$(grep -E '^DB_DATABASE=' aspha_pro/backend/.env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
mkdir -p ~/backups
echo "==> Backup DB prod -> ~/backups/db-prod-`$TS.sql.gz"
mysqldump -u"`$DB_USER" -p"`$DB_PASS" "`$DB_NAME" 2>/dev/null | gzip > ~/backups/db-prod-`$TS.sql.gz
# Sauve le hash commit actuel pour rollback eventuel
git rev-parse HEAD > ~/backups/prod-rollback-`$TS.txt
echo "==> Rollback hash sauve dans ~/backups/prod-rollback-`$TS.txt"
# Pull main + build + deploy
git pull origin main
source ~/nodevenv/aspha_pro/aspha_pro/frontend/20/bin/activate
cd aspha_pro/frontend
NODE_ENV=development npm install --include=dev --legacy-peer-deps
NODE_ENV=development npm run build
cd ~/aspha_pro/aspha_pro
rsync -av --exclude=.htaccess --exclude=index.php frontend/dist/ backend/public/
cd backend
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
curl -I https://asphapro-erp.fr/api/v1/ping
echo "PROD DEPLOY OK"
echo "Rollback possible avec : git -C ~/aspha_pro reset --hard `$(cat ~/backups/prod-rollback-`$TS.txt)"
"@

ssh -i $SshKey "$SshUser@$SshHost" $remoteCommand

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  PROD DEPLOYE - https://asphapro-erp.fr" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
