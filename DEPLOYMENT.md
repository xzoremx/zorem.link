# 🚀 Guía de Despliegue en Producción - Zorem

Esta guía te ayudará a desplegar Zorem en Render (recomendado) o cualquier otro servicio.

## 📋 Recomendación: Render

**Render es una excelente opción porque:**
- ✅ Plan gratuito disponible (con limitaciones)
- ✅ PostgreSQL gratuito incluido
- ✅ Despliegue automático desde Git
- ✅ SSL/HTTPS automático
- ✅ Fácil configuración de variables de entorno
- ✅ Logs en tiempo real
- ✅ Escalable cuando crezcas

**Alternativas:**
- **Railway** - Similar a Render, muy fácil de usar
- **Fly.io** - Buena opción, más control
- **DigitalOcean App Platform** - Más opciones, un poco más complejo
- **Vercel/Netlify** - Solo para frontend (necesitarías otro servicio para backend)

---

## 🏗️ Arquitectura de Despliegue

```
┌─────────────────┐
│   Frontend      │  → Render Static Site o Vercel/Netlify
│  (apps/web/)    │
└─────────────────┘
        │
        │ API Calls
        ▼
┌─────────────────┐
│   Backend API   │  → Render Web Service
│ (services/api/) │
└─────────────────┘
        │
        │ Database
        ▼
┌─────────────────┐
│   PostgreSQL    │  → Render PostgreSQL (Add-on)
└─────────────────┘
        │
        │ Storage
        ▼
┌─────────────────┐
│   S3/R2         │  → AWS S3 o Cloudflare R2
│  (Stories)      │
└─────────────────┘
```

---

## 📦 Paso 1: Preparar el Backend

### 1.1 Actualizar `services/api/render.yaml`

Asegúrate de que tu `render.yaml` esté configurado correctamente:

```yaml
services:
  - type: web
    name: zorem-api
    env: node
    plan: free  # o 'starter' para mejor rendimiento
    buildCommand: cd services/api && npm install
    startCommand: cd services/api && npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: JWT_SECRET
        generateValue: true
      - key: FRONTEND_URL
        value: https://zorem-frontend.onrender.com  # Actualiza con tu URL real

databases:
  - name: zorem-db
    plan: free
    databaseName: zorem
    user: zorem_user
```

### 1.2 Ejecutar Migraciones

Antes de desplegar, asegúrate de ejecutar las migraciones de la base de datos:

```bash
# Opción 1: Ejecutar manualmente en Render
# Conéctate a tu base de datos PostgreSQL en Render y ejecuta:
# services/api/src/db/migrations/001_init.sql
# services/api/src/db/migrations/002_viewer_sessions.sql
# services/api/src/db/migrations/003_stories_views.sql
# services/api/src/db/migrations/004_auth_enhancements.sql

# Opción 2: Crear un script de migración (recomendado)
# Ver sección de scripts de migración más abajo
```

---

## 🌐 Paso 2: Desplegar Backend en Render

### 2.1 Crear Servicio Web en Render

1. Ve a [Render Dashboard](https://dashboard.render.com)
2. Click en "New +" → "Web Service"
3. Conecta tu repositorio de GitHub/GitLab
4. Configura:
   - **Name**: `zorem-api`
   - **Environment**: `Node`
   - **Build Command**: `cd services/api && npm install`
   - **Start Command**: `cd services/api && npm start`
   - **Plan**: Free (o Starter para mejor rendimiento)

### 2.2 Agregar Base de Datos PostgreSQL

1. En Render Dashboard, click "New +" → "PostgreSQL"
2. Configura:
   - **Name**: `zorem-db`
   - **Plan**: Free
3. Una vez creada, ve a tu servicio web `zorem-api`
4. En "Add Environment Variable", agrega:
   - Key: `DATABASE_URL`
   - Value: (Render lo proporciona automáticamente si conectas la DB como add-on)

### 2.3 Configurar Variables de Entorno

En el servicio `zorem-api`, ve a "Environment" y agrega:

**Variables Requeridas:**
```env
NODE_ENV=production
JWT_SECRET=tu-clave-secreta-muy-larga-y-aleatoria
FRONTEND_URL=https://zorem-frontend.onrender.com
DATABASE_URL=postgresql://... (automático si conectaste la DB)
```

**Para generar JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Variables Opcionales (Storage):**
```env
# Si usas AWS S3
STORAGE_TYPE=s3
AWS_ACCESS_KEY_ID=tu-access-key
AWS_SECRET_ACCESS_KEY=tu-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=zorem-stories

# O si usas Cloudflare R2 (recomendado - más barato)
STORAGE_TYPE=r2
AWS_ACCESS_KEY_ID=tu-r2-access-key
AWS_SECRET_ACCESS_KEY=tu-r2-secret-key
AWS_REGION=auto
S3_BUCKET_NAME=zorem-stories
R2_ACCOUNT_ID=tu-account-id
R2_ENDPOINT=https://tu-account-id.r2.cloudflarestorage.com
```

### 2.4 Ejecutar Migraciones

**Opción A: Script de migración automática**

Crea `services/api/src/db/migrate.js`:

```javascript
import { pool } from './pool.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigrations() {
  const migrations = [
    '001_init.sql',
    '002_viewer_sessions.sql',
    '003_stories_views.sql',
    '004_auth_enhancements.sql'
  ];

  for (const migration of migrations) {
    try {
      const sql = readFileSync(join(__dirname, 'migrations', migration), 'utf8');
      await pool.query(sql);
      console.log(`✅ Migration ${migration} completed`);
    } catch (error) {
      if (error.code === '42P07') {
        // Table already exists, skip
        console.log(`⏭️  Migration ${migration} already applied`);
      } else {
        console.error(`❌ Error in migration ${migration}:`, error);
        throw error;
      }
    }
  }
  
  console.log('✅ All migrations completed');
  await pool.end();
}

runMigrations().catch(console.error);
```

Agrega al `package.json`:
```json
"scripts": {
  "migrate": "node src/db/migrate.js"
}
```

Luego en Render, agrega un "Deploy Script" o ejecuta manualmente después del primer deploy.

**Opción B: Ejecutar manualmente**

1. Ve a tu base de datos en Render
2. Click en "Connect" → "External Connection"
3. Usa un cliente PostgreSQL (pgAdmin, DBeaver, etc.)
4. Ejecuta cada archivo SQL de `services/api/src/db/migrations/` en orden

---

## 🎨 Paso 3: Desplegar Frontend

### Opción A: Render Static Site (Recomendado)

1. En Render Dashboard, click "New +" → "Static Site"
2. Conecta tu repositorio
3. Configura:
   - **Name**: `zorem-frontend`
   - **Build Command**: (dejar vacío, es solo HTML)
   - **Publish Directory**: `apps/web`
   - **Environment Variables**: No necesitas ninguna

### Opción B: Vercel/Netlify

**Vercel:**
1. Ve a [vercel.com](https://vercel.com)
2. Importa tu repositorio
3. Configura:
   - **Root Directory**: `apps/web`
   - **Build Command**: (vacío)
   - **Output Directory**: `apps/web`

**Netlify:**
1. Ve a [netlify.com](https://netlify.com)
2. Importa tu repositorio
3. Configura:
   - **Base directory**: `apps/web`
   - **Publish directory**: `apps/web`

### 3.1 Actualizar URL de API en Frontend

**IMPORTANTE:** Actualiza `apps/web/js/config.js` con la URL real de tu API:

```javascript
// En apps/web/js/config.js
const apiServiceName = 'zorem-api'; // Cambia por el nombre real de tu servicio
```

O mejor aún, crea una variable de entorno en Render/Vercel que se inyecte:

```html
<!-- En cada HTML, antes de importar api.js -->
<script>
  window.API_BASE_URL = 'https://zorem-api.onrender.com';
</script>
```

Y actualiza `config.js`:
```javascript
const API_BASE_URL = window.API_BASE_URL || getApiBaseUrl();
```

---

## ✅ Paso 4: Verificar Despliegue

### 4.1 Verificar Backend

1. Ve a tu servicio `zorem-api` en Render
2. Copia la URL (ej: `https://zorem-api.onrender.com`)
3. Visita: `https://zorem-api.onrender.com/health`
4. Deberías ver: `{"status":"ok","database":"connected"}`

### 4.2 Verificar Frontend

1. Visita tu frontend
2. Abre la consola del navegador (F12)
3. Intenta crear una cuenta
4. Verifica que las llamadas a la API funcionen

### 4.3 Verificar Base de Datos

1. En Render, ve a tu base de datos
2. Usa "Connect" → "psql" o un cliente externo
3. Verifica que las tablas existan:
```sql
\dt  -- Listar tablas
SELECT * FROM users LIMIT 1;
```

---

## 🔧 Configuración Adicional

### Storage (S3/R2)

**Para subir stories, necesitas configurar storage:**

#### Opción A: Cloudflare R2 (Recomendado - Más barato)
1. Crea cuenta en [Cloudflare](https://cloudflare.com)
2. Ve a R2 → Create Bucket
3. Ve a "Manage R2 API Tokens" → Create API Token
4. Copia las credenciales a Render

#### Opción B: AWS S3
1. Crea cuenta en AWS
2. Crea un bucket S3
3. Crea IAM user con permisos S3
4. Copia credenciales a Render

### Email (Para verificación y magic links)

**Recomendado (fácil): Resend**

1. Crea cuenta en `resend.com`
2. Verifica tu dominio `zorem.link` (DNS en Namecheap)
3. Crea un API Key
4. En Render → `zorem-api` → Environment agrega:

```env
RESEND_API_KEY=...
RESEND_FROM_EMAIL=Zorem <noreply@zorem.link>
```


**Google OAuth (Sign in with Google)**

1. En Google Cloud Console crea credenciales OAuth 2.0
2. Configura Redirect URI:
   `https://api.zorem.link/api/auth/google/callback`
3. En Render → `zorem-api` → Environment agrega:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://api.zorem.link/api/auth/google/callback
```


**Opciones:**
- **SendGrid** (gratis hasta 100 emails/día)
- **AWS SES** (muy barato)
- **Resend** (moderno, fácil de usar)

Agrega las credenciales a Render y actualiza el código en `auth.routes.js` para enviar emails reales.

---

## 🚨 Troubleshooting

### Error: "Cannot connect to server"
- Verifica que `API_BASE_URL` en `config.js` sea correcta
- Verifica que el servicio backend esté corriendo en Render
- Revisa los logs en Render Dashboard

### Error: "Database connection failed"
- Verifica que `DATABASE_URL` esté configurada
- Verifica que la base de datos esté conectada como add-on
- Revisa que las migraciones se hayan ejecutado

### Error: "CORS error"
- Verifica que `FRONTEND_URL` y `CORS_ORIGIN` estén configurados correctamente
- Asegúrate de que la URL del frontend coincida exactamente

### El frontend no carga
- Verifica que `Publish Directory` sea `apps/web`
- Verifica que los archivos HTML estén en la raíz de `apps/web`

---

## 📝 Checklist Final

Antes de considerar el despliegue completo:

- [ ] Backend desplegado en Render y respondiendo en `/health`
- [ ] Base de datos PostgreSQL creada y conectada
- [ ] Migraciones ejecutadas
- [ ] Variables de entorno configuradas
- [ ] Frontend desplegado y accesible
- [ ] `config.js` actualizado con URL real de API
- [ ] Storage (S3/R2) configurado (si vas a subir stories)
- [ ] Probar registro de usuario
- [ ] Probar creación de room
- [ ] Probar unirse a room con código
- [ ] Probar subida de stories (si storage está configurado)

---

## 🎯 URLs Finales

Después del despliegue, tendrás:

- **Backend API**: `https://zorem-api.onrender.com`
- **Frontend**: `https://zorem-frontend.onrender.com` (o tu dominio)
- **Base de Datos**: Interna en Render (no accesible públicamente)

---

## 💡 Tips

1. **Plan Free de Render**: Tiene limitaciones (suspende después de inactividad). Considera el plan Starter ($7/mes) para producción real.

2. **Dominio Personalizado**: Puedes agregar tu propio dominio en Render (Settings → Custom Domain).

3. **Monitoreo**: Considera agregar un servicio de monitoreo como UptimeRobot (gratis) para verificar que tu API esté siempre activa.

4. **Backups**: Render hace backups automáticos de PostgreSQL, pero considera hacer backups manuales periódicos.

5. **Logs**: Revisa los logs en Render Dashboard regularmente para detectar errores.

---

¿Necesitas ayuda con algún paso específico? ¡Avísame!

