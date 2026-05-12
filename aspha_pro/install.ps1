# Aspha Pro — Installateur Windows (PowerShell)
# Usage : .\install.ps1
# Requiert : PHP 8.3+, Composer 2.x, Node.js 20+, npm 10+, Git

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

function Check-Cmd($cmd) {
    $exists = Get-Command $cmd -ErrorAction SilentlyContinue
    if (-not $exists) {
        Write-Host "[X] $cmd introuvable dans le PATH" -ForegroundColor Red
        return $false
    }
    Write-Host "[OK] $cmd : $($exists.Source)" -ForegroundColor Green
    return $true
}

Write-Host "=== Vérification des prérequis ===" -ForegroundColor Yellow
$ok = $true
$ok = (Check-Cmd "php") -and $ok
$ok = (Check-Cmd "composer") -and $ok
$ok = (Check-Cmd "node") -and $ok
$ok = (Check-Cmd "npm") -and $ok
$ok = (Check-Cmd "git") -and $ok

if (-not $ok) {
    Write-Host ""
    Write-Host "Installe les outils manquants puis relance le script." -ForegroundColor Yellow
    Write-Host "  PHP 8.3   :  winget install PHP.PHP.8.3" -ForegroundColor Gray
    Write-Host "  Composer  :  https://getcomposer.org/Composer-Setup.exe" -ForegroundColor Gray
    Write-Host "  Node 20+  :  winget install OpenJS.NodeJS.LTS" -ForegroundColor Gray
    exit 1
}

Write-Host ""
Write-Host "=== Backend Laravel ===" -ForegroundColor Yellow

Set-Location "$root\backend"

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "[OK] .env créé depuis .env.example" -ForegroundColor Green
}

Write-Host "[..] composer install" -ForegroundColor Gray
composer install --no-interaction --prefer-dist

Write-Host "[..] artisan key:generate" -ForegroundColor Gray
php artisan key:generate --no-interaction

if (-not (Test-Path "database\database.sqlite")) {
    New-Item -Path "database\database.sqlite" -ItemType File | Out-Null
    Write-Host "[OK] SQLite créé : database\database.sqlite" -ForegroundColor Green
}

Write-Host "[..] artisan migrate:fresh --seed" -ForegroundColor Gray
php artisan migrate:fresh --seed --no-interaction

Write-Host ""
Write-Host "=== Frontend React ===" -ForegroundColor Yellow

Set-Location "$root\frontend"
Write-Host "[..] npm install" -ForegroundColor Gray
npm install --silent

Set-Location "$root"
Write-Host "[..] npm install (root, concurrently)" -ForegroundColor Gray
npm install --silent

Write-Host ""
Write-Host "=== Installation terminée ===" -ForegroundColor Green
Write-Host ""
Write-Host "Identifiants par défaut :" -ForegroundColor Cyan
Write-Host "  Email    : admin@aspha.local" -ForegroundColor White
Write-Host "  Password : admin1234" -ForegroundColor White
Write-Host ""
Write-Host "Pour démarrer (depuis ce dossier) :" -ForegroundColor Cyan
Write-Host "  npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "  Backend  : http://127.0.0.1:8000" -ForegroundColor Gray
Write-Host "  Frontend : http://localhost:5173" -ForegroundColor Gray
