# Script PowerShell pour deployer Aspha Pro en PREPROD sur o2switch.
#
# Usage (depuis n'importe ou) :
#   & "F:\Pro\BiDEv\Projet CRM aspha service\aspha_pro\deploy\deploy-preprod.ps1"
#
# Ou pour creer un raccourci bureau : clic droit > Envoyer vers > Bureau.

$ErrorActionPreference = "Stop"

$SshUser = "jabi3423"
$SshHost = "ibis.o2switch.net"
$SshKey  = "$HOME\.ssh\aspha_o2switch"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  DEPLOIEMENT PREPROD - Aspha Pro" -ForegroundColor Cyan
Write-Host "  Cible : https://preprod.asphapro-erp.fr" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$remoteCommand = @"
set -e
cd ~/aspha_pro_preprod
git pull origin main
source ~/nodevenv/aspha_pro_preprod/aspha_pro/frontend/20/bin/activate
cd aspha_pro/frontend
NODE_ENV=development npm install --include=dev --legacy-peer-deps
NODE_ENV=development npm run build
cd ~/aspha_pro_preprod/aspha_pro
rsync -av --exclude=.htaccess --exclude=index.php frontend/dist/ backend/public/
cd backend
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
curl -I https://preprod.asphapro-erp.fr/api/v1/ping
echo "DEPLOY OK"
"@

ssh -i $SshKey "$SshUser@$SshHost" $remoteCommand

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  PREPROD DEPLOYE - va tester sur :" -ForegroundColor Green
Write-Host "  https://preprod.asphapro-erp.fr" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
