# 🚂 Guía para Limpiar Cachés en Railway

Esta guía te ayudará a limpiar todos los cachés de tus servicios desplegados en Railway.

## 📋 Índice
1. [Limpiar Caché de Build](#1-limpiar-caché-de-build)
2. [Redeploy Completo](#2-redeploy-completo)
3. [Forzar Rebuild sin Caché](#3-forzar-rebuild-sin-caché)
4. [Limpiar Variables de Entorno Cachadas](#4-limpiar-variables-de-entorno-cachadas)
5. [Verificar que se Limpió](#5-verificar-que-se-limpió)

---

## 1. Limpiar Caché de Build

### Método 1: Redeploy (Más Simple)
1. Ve a [Railway Dashboard](https://railway.app/dashboard)
2. Selecciona tu proyecto
3. Para cada servicio (Frontend y Backend):
   - Click en el servicio
   - Ve a la pestaña **"Deployments"** o **"Deploys"**
   - Busca el último deployment
   - Click en el menú de 3 puntos (⋮) o botón **"Redeploy"**
   - Selecciona **"Redeploy"** o **"Deploy latest"**

### Método 2: Desde Settings
1. Ve a tu servicio (Frontend o Backend)
2. Click en **"Settings"** (⚙️)
3. Scroll hasta **"Build"** o **"Deploy"**
4. Si hay opción **"Clear Build Cache"** o **"Clear Cache"**, úsala
5. Luego haz un **Redeploy**

---

## 2. Redeploy Completo

### Opción A: Desde el Dashboard
1. **Frontend:**
   - Ve a tu servicio Frontend
   - Click en **"Deployments"**
   - Click en **"Redeploy"** o **"Deploy latest"**
   - Espera a que termine el build

2. **Backend:**
   - Repite el mismo proceso para el Backend

### Opción B: Desde GitHub (Forzar Push)
Si Railway está conectado a GitHub, puedes forzar un redeploy haciendo un commit vacío:

```bash
git commit --allow-empty -m "force: redeploy en Railway"
git push
```

Esto activará un nuevo deployment automáticamente.

---

## 3. Forzar Rebuild sin Caché

### Método 1: Variable de Entorno Temporal
1. Ve a tu servicio en Railway
2. Click en **"Variables"** o **"Settings" → "Variables"**
3. Agrega una nueva variable:
   - **Nombre:** `FORCE_REBUILD`
   - **Valor:** `true` (o un timestamp como `2026-01-23-15-30`)
4. Guarda los cambios
5. Railway detectará el cambio y hará un redeploy automático
6. **Después del deploy exitoso**, puedes eliminar esta variable

### Método 2: Cambiar Build Command Temporalmente
1. Ve a **Settings** → **Build**
2. Temporalmente modifica el **Build Command** agregando algo al final:
   - Frontend: `npm run build && echo "rebuild-$(date +%s)"`
   - Backend: `npm run build && echo "rebuild-$(date +%s)"`
3. Guarda y espera el redeploy
4. Luego vuelve a poner el comando original

---

## 4. Limpiar Variables de Entorno Cachadas

Si cambiaste variables de entorno y no se aplican:

1. Ve a **Settings** → **Variables**
2. Verifica que todas las variables estén correctas
3. Si alguna variable tiene un valor incorrecto:
   - Click en el lápiz (✏️) para editar
   - Cambia el valor
   - Guarda
4. Haz un **Redeploy** para que los cambios surtan efecto

**Nota:** Railway puede cachear variables de entorno, así que después de cambiarlas, siempre haz un redeploy.

---

## 5. Verificar que se Limpió

### Verificar en Railway:
1. Ve a **Deployments**
2. Verifica que el último deployment sea reciente
3. Click en el deployment para ver los logs
4. En los logs deberías ver:
   - `npm ci` o `npm install` (no debería usar caché)
   - `npm run build` ejecutándose desde cero

### Verificar en la Aplicación:
1. **Frontend:**
   - Abre tu aplicación en el navegador
   - Presiona `Ctrl + Shift + I` (DevTools)
   - Ve a **Network** → Recarga la página
   - Verifica que los archivos JS/CSS tengan timestamps nuevos
   - O busca el texto `build: 2026-01-23-phone9-autocomplete-v2` en la página

2. **Backend:**
   - Verifica los logs en Railway
   - Deberías ver que el servidor se inició recientemente
   - Los logs no deberían mostrar errores de caché

---

## 🔧 Pasos Recomendados (Orden de Ejecución)

### Para Limpiar Todo en Railway:

1. **Frontend:**
   ```
   Railway Dashboard → Frontend Service → Deployments → Redeploy
   ```

2. **Backend:**
   ```
   Railway Dashboard → Backend Service → Deployments → Redeploy
   ```

3. **Espera** a que ambos deployments terminen (verás ✅ verde)

4. **Verifica** que ambos servicios estén funcionando:
   - Frontend: Abre la URL en el navegador
   - Backend: Verifica los logs (no deberían tener errores)

5. **Limpia el caché del navegador:**
   - `Ctrl + Shift + Delete` → Borrar todo
   - O prueba en modo incógnito

---

## ⚠️ Notas Importantes

1. **Tiempo de Redeploy:**
   - Frontend: ~3-5 minutos
   - Backend: ~2-4 minutos
   - No interrumpas el proceso

2. **Costo:**
   - Los redeploys no tienen costo adicional
   - Solo consumes recursos mientras se ejecuta el build

3. **Downtime:**
   - Durante el redeploy, el servicio anterior sigue funcionando
   - Solo hay downtime mínimo al finalizar (segundos)

4. **Si el Redeploy Falla:**
   - Revisa los logs del deployment
   - Verifica que las variables de entorno estén correctas
   - Verifica que el código en GitHub esté actualizado

---

## 🚨 Solución de Problemas

### Problema: "El redeploy no limpia el caché"
**Solución:**
1. Agrega variable `FORCE_REBUILD=true`
2. Haz redeploy
3. Elimina la variable después

### Problema: "Sigue mostrando versión antigua"
**Solución:**
1. Verifica que el deployment haya terminado (✅ verde)
2. Limpia caché del navegador (`Ctrl + Shift + Delete`)
3. Prueba en modo incógnito
4. Verifica que Railway esté desplegando el branch correcto (`main`)

### Problema: "Build falla después de limpiar caché"
**Solución:**
1. Revisa los logs del deployment
2. Verifica que `package.json` tenga todas las dependencias
3. Verifica que las variables de entorno estén configuradas
4. Si persiste, contacta soporte de Railway

---

## 📞 Recursos Adicionales

- [Railway Documentation](https://docs.railway.app)
- [Railway Dashboard](https://railway.app/dashboard)
- [Railway Status](https://status.railway.app)

---

**Última actualización:** 2026-01-23
