# 🧹 Guía para Limpiar Todos los Cachés

Esta guía te ayudará a limpiar todos los cachés de tu aplicación (frontend, backend, navegador, Railway, Docker).

## 📋 Índice
1. [Caché del Frontend (Next.js)](#1-caché-del-frontend-nextjs)
2. [Caché del Backend (NestJS)](#2-caché-del-backend-nestjs)
3. [Caché del Navegador](#3-caché-del-navegador)
4. [Caché de Railway](#4-caché-de-railway)
5. [Caché de Docker](#5-caché-de-docker)
6. [Limpiar Todo de Una Vez](#6-limpiar-todo-de-una-vez)

---

## 1. Caché del Frontend (Next.js)

### Opción A: Usando npm script (Recomendado)
```bash
cd frontend
npm run clean:all
```

### Opción B: Script manual (Windows PowerShell)
```powershell
cd frontend
.\scripts\clear-cache.ps1
```

### Opción C: Script manual (Linux/Mac)
```bash
cd frontend
chmod +x scripts/clear-cache.sh
./scripts/clear-cache.sh
```

### Opción D: Comandos manuales
```bash
cd frontend
rm -rf .next out .turbo
rm -f *.tsbuildinfo tsconfig.tsbuildinfo
npm cache clean --force
```

---

## 2. Caché del Backend (NestJS)

### Opción A: Usando npm script (Recomendado)
```bash
cd backend
npm run clean:all
```

### Opción B: Comandos manuales
```bash
cd backend
rm -rf dist node_modules/.cache
npm cache clean --force
```

---

## 3. Caché del Navegador

### Chrome/Edge:
1. Presiona `Ctrl + Shift + Delete` (Windows/Linux) o `Cmd + Shift + Delete` (Mac)
2. Selecciona:
   - ✅ **Imágenes y archivos en caché**
   - ✅ **Datos de sitios alojados en caché**
   - ✅ **Cookies y otros datos de sitios**
3. Rango de tiempo: **Todo el tiempo**
4. Click en **Borrar datos**

### Firefox:
1. Presiona `Ctrl + Shift + Delete` (Windows/Linux) o `Cmd + Shift + Delete` (Mac)
2. Selecciona:
   - ✅ **Caché**
   - ✅ **Cookies**
3. Rango de tiempo: **Todo**
4. Click en **Aceptar**

### Limpiar sessionStorage/localStorage (Consola del navegador):
Abre la consola (F12) y ejecuta:
```javascript
// Limpiar sessionStorage
sessionStorage.clear();

// Limpiar localStorage
localStorage.clear();

// Limpiar caché de documentos específicos
Object.keys(sessionStorage).forEach(key => {
  if (key.startsWith('doc_cache_')) {
    sessionStorage.removeItem(key);
  }
});

console.log('✅ Cachés del navegador limpiados');
```

### Modo Incógnito (Para probar sin caché):
- Chrome/Edge: `Ctrl + Shift + N` (Windows) o `Cmd + Shift + N` (Mac)
- Firefox: `Ctrl + Shift + P` (Windows) o `Cmd + Shift + P` (Mac)

---

## 4. Caché de Railway

### Opción A: Redeploy (Recomendado)
1. Ve a tu proyecto en [Railway](https://railway.app)
2. Selecciona el servicio (Frontend o Backend)
3. Ve a **Settings** → **Deployments**
4. Click en **"Redeploy"** o **"Deploy latest"**

### Opción B: Limpiar caché de build
1. Ve a **Settings** → **Build**
2. Si hay opción de "Clear Build Cache", úsala
3. O simplemente haz un **Redeploy**

### Opción C: Forzar rebuild completo
En Railway, puedes agregar una variable de entorno temporal:
- Nombre: `FORCE_REBUILD`
- Valor: `true` (o cualquier timestamp como `2026-01-23`)

Luego haz un redeploy. Esto forzará un rebuild completo.

---

## 5. Caché de Docker

### Limpiar imágenes y contenedores:
```bash
# Ver imágenes
docker images

# Eliminar imágenes no usadas
docker image prune -a

# Eliminar contenedores detenidos
docker container prune

# Limpiar TODO (cuidado: esto elimina todo lo no usado)
docker system prune -a --volumes
```

### Limpiar caché de build de Docker:
```bash
# Limpiar caché de build
docker builder prune -a
```

---

## 6. Limpiar Todo de Una Vez

### Script completo (Windows PowerShell):
```powershell
# Frontend
Write-Host "🧹 Limpiando Frontend..." -ForegroundColor Cyan
cd frontend
npm run clean:all
cd ..

# Backend
Write-Host "🧹 Limpiando Backend..." -ForegroundColor Cyan
cd backend
npm run clean:all
cd ..

# Docker (si tienes Docker instalado)
Write-Host "🧹 Limpiando Docker..." -ForegroundColor Cyan
docker system prune -f

Write-Host "✅ ¡Todo limpiado!" -ForegroundColor Green
```

### Script completo (Linux/Mac):
```bash
#!/bin/bash
# Frontend
echo "🧹 Limpiando Frontend..."
cd frontend && npm run clean:all && cd ..

# Backend
echo "🧹 Limpiando Backend..."
cd backend && npm run clean:all && cd ..

# Docker (si tienes Docker instalado)
echo "🧹 Limpiando Docker..."
docker system prune -f

echo "✅ ¡Todo limpiado!"
```

---

## 🔍 Verificar que los Cachés se Limpiaron

### Frontend:
```bash
cd frontend
ls -la | grep -E "\.next|out|\.turbo"
# No debería aparecer nada
```

### Backend:
```bash
cd backend
ls -la | grep dist
# No debería aparecer nada (o solo si hiciste build después)
```

### Navegador:
1. Abre DevTools (F12)
2. Ve a **Application** → **Storage**
3. Verifica que **Local Storage** y **Session Storage** estén vacíos (o solo con datos necesarios)

---

## ⚠️ Notas Importantes

1. **Después de limpiar cachés**, necesitarás:
   - Reinstalar dependencias: `npm install`
   - Rebuild: `npm run build`
   - Reiniciar servidores de desarrollo

2. **En Railway**, después de limpiar cachés:
   - Haz un **Redeploy** para que los cambios surtan efecto

3. **En el navegador**, después de limpiar:
   - Recarga la página con **Ctrl + F5** (hard refresh)
   - O prueba en **modo incógnito**

4. **Si el problema persiste**:
   - Verifica que Railway esté desplegando el branch correcto (`main`)
   - Verifica que el Root Directory esté configurado correctamente
   - Revisa los logs de Railway para ver si hay errores de build

---

## 🚀 Comandos Rápidos

```bash
# Limpiar todo (Frontend + Backend)
cd frontend && npm run clean:all && cd .. && cd backend && npm run clean:all && cd ..

# Limpiar y rebuild Frontend
cd frontend && npm run clean:all && npm install && npm run build

# Limpiar y rebuild Backend
cd backend && npm run clean:all && npm install && npm run build
```

---

**Última actualización:** 2026-01-23
