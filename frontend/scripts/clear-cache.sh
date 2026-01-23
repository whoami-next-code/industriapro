#!/bin/bash
# Script para limpiar todos los cachés del frontend

echo "🧹 Limpiando cachés del frontend..."

# Limpiar caché de Next.js
echo "📦 Limpiando .next..."
rm -rf .next
rm -rf out
rm -rf .turbo

# Limpiar caché de node_modules (opcional, descomentar si es necesario)
# echo "📦 Limpiando node_modules..."
# rm -rf node_modules

# Limpiar caché de npm
echo "📦 Limpiando caché de npm..."
npm cache clean --force

# Limpiar TypeScript build info
echo "📦 Limpiando TypeScript build info..."
find . -name "*.tsbuildinfo" -delete
find . -name "tsconfig.tsbuildinfo" -delete

# Limpiar logs
echo "📦 Limpiando logs..."
rm -f npm-debug.log*
rm -f yarn-debug.log*
rm -f yarn-error.log*
rm -f .pnpm-debug.log*

echo "✅ Cachés limpiados exitosamente!"
