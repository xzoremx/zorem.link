# Configuración de Variables de Entorno en Render

Esta guía te ayudará a configurar todas las variables de entorno necesarias para Zorem en Render.

## 📋 Variables Requeridas

### 1. Base de Datos (Automático en Render)
Si creaste una base de datos PostgreSQL en Render, Render automáticamente proporciona:
- ✅ `DATABASE_URL` - Se conecta automáticamente si agregas la base de datos como "Add-on" a tu servicio

**Cómo configurarlo:**
1. En tu servicio de Render, ve a "Environment"
2. Si ya agregaste PostgreSQL como Add-on, `DATABASE_URL` ya está disponible
3. Si no, ve a "Add Environment Variable" y agrega:
   - Key: `DATABASE_URL`
   - Value: `postgresql://user:password@host:port/database` (Render te da esto cuando creas la DB)

### 2. Puerto (Automático en Render)
- ✅ `PORT` - Render lo proporciona automáticamente, NO necesitas configurarlo

### 3. Variables que DEBES configurar manualmente:

#### JWT_SECRET (Requerido)
Genera una clave secreta segura para JWT. Puedes usar:
```bash
# En tu terminal local:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

O usa cualquier string largo y aleatorio.

**En Render:**
- Key: `JWT_SECRET`
- Value: `tu-clave-secreta-muy-larga-y-aleatoria`

#### NODE_ENV (Opcional pero recomendado)
- Key: `NODE_ENV`
- Value: `production`

#### FRONTEND_URL (Requerido para producción)
La URL de tu frontend. Ejemplo:
- Key: `FRONTEND_URL`
- Value: `https://zorem-frontend.onrender.com` (o tu dominio)

#### CORS_ORIGIN (Opcional, usa FRONTEND_URL si no se define)
- Key: `CORS_ORIGIN`
- Value: `https://zorem-frontend.onrender.com` (mismo que FRONTEND_URL)

---

## 📦 Variables para Storage (S3/R2)

### Opción A: AWS S3

Si usas AWS S3, necesitas:

- Key: `STORAGE_TYPE`
- Value: `s3`

- Key: `AWS_ACCESS_KEY_ID`
- Value: `tu-access-key-de-aws`

- Key: `AWS_SECRET_ACCESS_KEY`
- Value: `tu-secret-key-de-aws`

- Key: `AWS_REGION`
- Value: `us-east-1` (o tu región)

- Key: `S3_BUCKET_NAME`
- Value: `zorem-stories` (o el nombre de tu bucket)

### Opción B: Cloudflare R2 (Recomendado - más barato)

Si usas Cloudflare R2:

- Key: `STORAGE_TYPE`
- Value: `r2`

- Key: `AWS_ACCESS_KEY_ID`
- Value: `tu-r2-access-key-id`

- Key: `AWS_SECRET_ACCESS_KEY`
- Value: `tu-r2-secret-access-key`

- Key: `AWS_REGION`
- Value: `auto` (para R2)

- Key: `S3_BUCKET_NAME`
- Value: `zorem-stories` (nombre de tu bucket R2)

- Key: `R2_ACCOUNT_ID`
- Value: `tu-account-id-de-cloudflare`

- Key: `R2_ENDPOINT`
- Value: `https://tu-account-id.r2.cloudflarestorage.com`

---

## 🔧 Cómo Agregar Variables en Render

1. Ve a tu servicio en el dashboard de Render
2. Haz clic en "Environment" en el menú lateral
3. Haz clic en "Add Environment Variable"
4. Agrega cada variable con su Key y Value
5. Guarda los cambios
6. Render reiniciará automáticamente tu servicio

---

## ✅ Checklist de Configuración

Antes de hacer deploy, asegúrate de tener:

- [ ] `DATABASE_URL` (automático si agregaste PostgreSQL como add-on)
- [ ] `JWT_SECRET` (genera uno seguro)
- [ ] `NODE_ENV=production`
- [ ] `FRONTEND_URL` (URL de tu frontend)
- [ ] `STORAGE_TYPE` (s3 o r2)
- [ ] Credenciales de storage (AWS o R2)
- [ ] `S3_BUCKET_NAME` o configuración R2 completa

---

## 🧪 Probar Localmente

Para probar localmente, crea un archivo `.env` en `services/api/` con:

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/zorem
JWT_SECRET=tu-clave-secreta-local
FRONTEND_URL=http://localhost:8080
CORS_ORIGIN=http://localhost:8080

# Storage (opcional para desarrollo local)
STORAGE_TYPE=s3
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
S3_BUCKET_NAME=zorem-stories-dev
```

---

## 🚨 Notas Importantes

1. **NUNCA** subas el archivo `.env` a Git (ya está en .gitignore)
2. **NUNCA** compartas tus `JWT_SECRET` o credenciales de AWS/R2
3. Render reinicia automáticamente cuando cambias variables de entorno
4. Si tienes problemas, revisa los logs en Render Dashboard → Logs

---

## 📝 Ejemplo de Configuración Mínima para Empezar

Si solo quieres probar sin storage (solo base de datos):

```env
DATABASE_URL=postgresql://... (automático en Render)
JWT_SECRET=clave-secreta-generada
NODE_ENV=production
FRONTEND_URL=https://tu-frontend.onrender.com
```

El storage lo puedes configurar después cuando necesites subir stories.
