# ⚡ Guía Rápida de Despliegue - Zorem

## 🎯 Pasos Rápidos para Render

### 1. Backend API (5 minutos)

1. **Crear Web Service en Render:**
   - Ve a [dashboard.render.com](https://dashboard.render.com)
   - "New +" → "Web Service"
   - Conecta tu repo de GitHub
   - Configura:
     - Name: `zorem-api`
     - Build: `cd services/api && npm install`
     - Start: `cd services/api && npm start`

2. **Crear PostgreSQL:**
   - "New +" → "PostgreSQL"
   - Name: `zorem-db`
   - Conecta como add-on a `zorem-api`

3. **Variables de Entorno:**
   ```
   NODE_ENV=production
   JWT_SECRET=(genera uno con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
   FRONTEND_URL=https://zorem-frontend.onrender.com
   CORS_ORIGIN=https://zorem-frontend.onrender.com
   ```

4. **Copia la URL de tu API:** `https://zorem-api.onrender.com`

### 2. Frontend (3 minutos)

1. **Crear Static Site en Render:**
   - "New +" → "Static Site"
   - Conecta tu repo
   - Configura:
     - Publish Directory: `apps/web`
     - Build Command: (dejar vacío)

2. **Actualizar `apps/web/js/config.js`:**
   ```javascript
   const apiServiceName = 'zorem-api'; // Tu nombre de servicio
   ```

3. **Copia la URL de tu frontend:** `https://zorem-frontend.onrender.com`

### 3. Actualizar URLs

1. **En Render Dashboard → zorem-api → Environment:**
   - Actualiza `FRONTEND_URL` con la URL real de tu frontend
   - Actualiza `CORS_ORIGIN` con la misma URL

2. **Redeploy ambos servicios**

### 4. Verificar

- Backend: `https://zorem-api.onrender.com/health` → Debe responder `{"status":"ok"}`
- Frontend: Visita tu URL y prueba crear una cuenta

---

## 🔧 Storage (Opcional - Para subir stories)

### Cloudflare R2 (Recomendado)

1. Crea cuenta en Cloudflare
2. R2 → Create Bucket → `zorem-stories`
3. R2 → Manage API Tokens → Create Token
4. En Render → zorem-api → Environment, agrega:
   ```
   STORAGE_TYPE=r2
   AWS_ACCESS_KEY_ID=(tu R2 access key)
   AWS_SECRET_ACCESS_KEY=(tu R2 secret key)
   AWS_REGION=auto
   S3_BUCKET_NAME=zorem-stories
   R2_ACCOUNT_ID=(tu account ID)
   R2_ENDPOINT=https://(account-id).r2.cloudflarestorage.com
   ```

---

## ✅ Checklist

- [ ] Backend desplegado y `/health` funciona
- [ ] Frontend desplegado y carga correctamente
- [ ] `config.js` actualizado con nombre de servicio correcto
- [ ] Variables de entorno configuradas
- [ ] Probar registro de usuario
- [ ] Probar creación de room

---

## 🚨 Problemas Comunes

**"Cannot connect to server"**
→ Verifica que `apiServiceName` en `config.js` sea correcto

**"CORS error"**
→ Verifica que `FRONTEND_URL` y `CORS_ORIGIN` coincidan exactamente

**"Database connection failed"**
→ Verifica que PostgreSQL esté conectado como add-on

---

Para más detalles, ver `DEPLOYMENT.md`

