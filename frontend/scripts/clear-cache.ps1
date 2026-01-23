# Script PowerShell para limpiar todos los cachés del frontend (Windows)

Write-Host "🧹 Limpiando cachés del frontend..." -ForegroundColor Cyan

# Limpiar caché de Next.js
Write-Host "📦 Limpiando .next..." -ForegroundColor Yellow
if (Test-Path ".next") { Remove-Item -Recurse -Force ".next" }
if (Test-Path "out") { Remove-Item -Recurse -Force "out" }
if (Test-Path ".turbo") { Remove-Item -Recurse -Force ".turbo" }

# Limpiar caché de node_modules (opcional, descomentar si es necesario)
# Write-Host "📦 Limpiando node_modules..." -ForegroundColor Yellow
# if (Test-Path "node_modules") { Remove-Item -Recurse -Force "node_modules" }

# Limpiar caché de npm
Write-Host "📦 Limpiando caché de npm..." -ForegroundColor Yellow
npm cache clean --force

# Limpiar TypeScript build info
Write-Host "📦 Limpiando TypeScript build info..." -ForegroundColor Yellow
Get-ChildItem -Recurse -Filter "*.tsbuildinfo" | Remove-Item -Force
Get-ChildItem -Recurse -Filter "tsconfig.tsbuildinfo" | Remove-Item -Force

# Limpiar logs
Write-Host "📦 Limpiando logs..." -ForegroundColor Yellow
Get-ChildItem -Filter "npm-debug.log*" | Remove-Item -Force
Get-ChildItem -Filter "yarn-debug.log*" | Remove-Item -Force
Get-ChildItem -Filter "yarn-error.log*" | Remove-Item -Force
Get-ChildItem -Filter ".pnpm-debug.log*" | Remove-Item -Force

Write-Host "✅ Cachés limpiados exitosamente!" -ForegroundColor Green
