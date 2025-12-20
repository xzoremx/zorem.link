# PLAN DE DESARROLLO - ZOREM MVP

## Estado Actual
✅ **Completado:**
- `apps/web/index.html` - Landing page completa y funcional

⏳ **Pendiente:**
- Todo el backend (API REST)
- Base de datos (PostgreSQL)
- Páginas frontend restantes
- Sistema de autenticación
- Sistema de expiración automática

---

## FASE 1: INFRAESTRUCTURA BACKEND

### 1.1 Configuración Base del Servidor
**Archivo:** `services/api/src/server.js`
- Express server
- Middlewares (CORS, rate limiting, error handling)
- Variables de entorno (`.env`)
- Conexión a PostgreSQL

### 1.2 Base de Datos
**Archivos:** `services/api/src/db/migrations/*.sql`

**Tablas necesarias:**
- `users` - Solo para creators (email, created_at)
- `rooms` - Salas (owner_id, code, expires_at, allow_uploads, is_active)
- `stories` - Stories (room_id, media_type, media_key, created_at, expires_at)
- `views` - Vistas de stories (story_id, viewer_hash, created_at)
- `viewer_sessions` - Sesiones de viewers (room_id, viewer_hash, nickname, created_at)

**Índices importantes:**
- `rooms.code` (único)
- `rooms.expires_at` (para cron jobs)
- `stories.room_id` (para queries)

### 1.3 Middlewares
**Archivos:** `services/api/src/middlewares/*.js`
- `auth.js` - Verificación de magic link token para creators
- `cors.js` - Configuración CORS
- `rateLimit.js` - Rate limiting por IP/endpoint

### 1.4 Utilidades
**Archivos:** `services/api/src/lib/*.js`
- `codes.js` - Generación de códigos únicos (6 caracteres alfanuméricos)
- `crypto.js` - Hashing para viewer_hash
- `s3.js` - Configuración S3/R2 para presigned URLs

---

## FASE 2: API ENDPOINTS

### 2.1 Autenticación (Creators)
**Archivo:** `services/api/src/routes/auth.routes.js`

**Endpoints:**
- `POST /api/auth/request-magic-link` - Solicitar magic link por email
- `GET /api/auth/verify-magic-link?token=xxx` - Verificar token y crear sesión
- `GET /api/auth/me` - Obtener usuario actual (protegido)

### 2.2 Salas (Rooms)
**Archivo:** `services/api/src/routes/rooms.routes.js`

**Endpoints:**
- `POST /api/rooms` - Crear sala (protegido, requiere auth)
  - Body: `{ duration: '24h'|'72h'|'7d', allow_uploads: boolean }`
  - Response: `{ room_id, code, link, qr_data }`
- `GET /api/rooms/:code` - Validar código de sala (público)
  - Response: `{ valid: boolean, room_id?, expires_at?, allow_uploads? }`
- `GET /api/rooms/:roomId` - Obtener detalles de sala (protegido, solo owner)
- `DELETE /api/rooms/:roomId` - Cerrar/borrar sala (protegido, solo owner)

### 2.3 Stories
**Archivo:** `services/api/src/routes/stories.routes.js`

**Endpoints:**
- `GET /api/stories/room/:roomId` - Listar stories de una sala (orden cronológico)
- `POST /api/stories/upload-url` - Obtener presigned URL para upload
  - Body: `{ room_id, media_type: 'image'|'video', file_size }`
  - Response: `{ upload_url, media_key, expires_in }`
- `POST /api/stories` - Confirmar upload y crear story
  - Body: `{ room_id, media_key, media_type }`
- `POST /api/stories/:storyId/view` - Registrar vista de story
  - Body: `{ viewer_hash }`

### 2.4 Viewers
**Archivo:** `services/api/src/routes/viewer.routes.js`

**Endpoints:**
- `POST /api/viewer/join` - Unirse a sala con código
  - Body: `{ code, nickname }`
  - Response: `{ viewer_hash, room_id, allow_uploads }`
- `GET /api/viewer/session` - Obtener sesión actual (por cookie/viewer_hash)

---

## FASE 3: FRONTEND - PÁGINAS Y FLUJOS

### 3.1 Creator Flow - Crear Sala
**Archivo:** `apps/web/create-room.html` (nuevo)

**Funcionalidad:**
1. Si no está autenticado → redirigir a login
2. Formulario:
   - Duración (24h / 72h / 7 días)
   - Toggle: "Permitir que viewers suban stories"
3. Al crear:
   - Llamar `POST /api/rooms`
   - Mostrar código, link y QR
   - Botón "Ir a mi sala" → redirige a panel de control

**Panel de Control:**
- Ver estadísticas (viewers, stories)
- Ver stories subidas
- Botón "Cerrar sala"
- Contador de tiempo restante

### 3.2 Viewer Flow - Ingresar Código
**Archivo:** `apps/web/index.html` (ya existe, conectar funcionalidad)

**Funcionalidad:**
- Input de código ya existe en el hero
- Al ingresar código → `GET /api/rooms/:code` para validar
- Si válido → redirigir a `nickname.html?code=XXX`
- Si inválido → mostrar error claro

### 3.3 Nickname Flow
**Archivo:** `apps/web/nickname.html` (existe pero vacío)

**Funcionalidad:**
1. Obtener código de URL params
2. Input grande para nickname
3. Al enviar:
   - `POST /api/viewer/join` con código y nickname
   - Guardar `viewer_hash` en cookie/localStorage
   - Redirigir a `room.html?room_id=XXX`

### 3.4 Story Viewer
**Archivo:** `apps/web/room.html` (existe pero vacío)

**Funcionalidad:**
- UX tipo Instagram Stories (vertical, fullscreen)
- Cargar stories: `GET /api/stories/room/:roomId`
- Navegación:
  - Tap izquierdo/derecho o swipe para cambiar story
  - Auto-play de videos
  - Barra de progreso superior
- Registrar vista: `POST /api/stories/:storyId/view`
- Si `allow_uploads === true` → mostrar botón "Subir story"

### 3.5 Upload Story
**Componente en:** `apps/web/room.html` o modal separado

**Funcionalidad:**
1. Botón "Subir story" → abrir selector de archivo
2. Validar tipo (image/video) y tamaño
3. Obtener presigned URL: `POST /api/stories/upload-url`
4. Upload directo a S3/R2
5. Confirmar: `POST /api/stories`
6. Recargar lista de stories

---

## FASE 4: SISTEMA DE EXPIRACIÓN

### 4.1 Cron Job de Limpieza
**Archivo:** `services/jobs/src/cleanup.js`

**Funcionalidad:**
- Ejecutar periódicamente (cada hora o cada 15 min)
- Buscar salas con `expires_at < NOW()` y `is_active = true`
- Para cada sala expirada:
  1. Obtener todas las stories
  2. Borrar media de S3/R2
  3. Borrar stories de DB
  4. Borrar views de DB
  5. Borrar viewer_sessions de DB
  6. Marcar sala como `is_active = false`

**Configuración:**
- Usar `node-cron` o similar
- O usar servicio externo (Render Cron, GitHub Actions, etc.)

---

## FASE 5: INTEGRACIÓN Y CONECTIVIDAD

### 5.1 API Client
**Archivo:** `apps/web/js/api.js` (existe pero vacío)

**Funcionalidad:**
- Función base para llamadas API
- Manejo de errores
- Headers (Authorization para creators, cookies para viewers)

### 5.2 Conectar Landing
- Conectar botón "Join Room" con validación de código
- Conectar botón "Create Room" con página de creación

### 5.3 Manejo de Estado
- Cookies/localStorage para:
  - Creator token (magic link)
  - Viewer hash
  - Room ID actual

---

## FASE 6: DETALLES Y POLISH

### 6.1 Generación de QR
- Usar librería como `qrcode` en backend
- Endpoint: `GET /api/rooms/:roomId/qr`
- O generar en frontend con `qrcode.js`

### 6.2 Validaciones
- Validar formato de código (6 caracteres alfanuméricos)
- Validar duración de videos (máx 60 segundos)
- Validar tamaño de archivos
- Rate limiting en uploads

### 6.3 UX/UI
- Loading states
- Error messages claros
- Transiciones suaves
- Mobile-first (ya considerado en landing)

### 6.4 Seguridad
- Sanitizar inputs
- Validar ownership de salas
- Rate limiting agresivo en creación de salas
- Validar viewer_hash en cada request

---

## ORDEN DE IMPLEMENTACIÓN RECOMENDADO

1. **Backend Base** (Fase 1.1, 1.2, 1.3)
2. **Sistema de Códigos** (Fase 1.4 - codes.js)
3. **API de Salas** (Fase 2.2) - Endpoints básicos
4. **API de Viewers** (Fase 2.4) - Join con código
5. **Nickname Flow** (Fase 3.3) - Primera página funcional
6. **API de Stories** (Fase 2.3) - Listar y crear
7. **Story Viewer** (Fase 3.4) - Consumo básico
8. **Autenticación** (Fase 2.1) - Magic link
9. **Creator Flow** (Fase 3.1) - Crear salas
10. **Upload Stories** (Fase 3.5) - Si allow_uploads
11. **Cron Jobs** (Fase 4) - Expiración automática
12. **Polish** (Fase 6) - Detalles finales

---

## DEPENDENCIAS NECESARIAS

### Backend
- `express` - Server framework
- `pg` - PostgreSQL client
- `dotenv` - Variables de entorno
- `cors` - CORS middleware
- `express-rate-limit` - Rate limiting
- `jsonwebtoken` - Magic link tokens
- `@aws-sdk/s3-client` o `@aws-sdk/client-s3` - S3/R2
- `nanoid` o similar - Generación de códigos
- `qrcode` - Generación de QR codes

### Frontend
- Tailwind CSS (ya incluido en landing)
- Fetch API (nativo)
- Posiblemente librería para QR si se hace en frontend

### Jobs
- `node-cron` - Para cron jobs
- O usar servicio externo

---

## VARIABLES DE ENTORNO NECESARIAS

```env
# Database
DATABASE_URL=postgresql://...

# Server
PORT=3000
NODE_ENV=development

# Auth
JWT_SECRET=...
MAGIC_LINK_EXPIRY=3600

# Storage (S3/R2)
STORAGE_TYPE=s3|r2
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=...
S3_BUCKET_NAME=...
# O para R2:
R2_ACCOUNT_ID=...
R2_ENDPOINT=...

# Frontend
FRONTEND_URL=http://localhost:8080
```

---

## NOTAS IMPORTANTES

⚠️ **Principios a respetar:**
- Menos pasos > más features
- Nada social (sin followers, feed, algoritmo)
- Nada permanente (todo expira)
- Todo gira alrededor del código
- UX > tecnología
- Mobile primero siempre

⚠️ **MVP debe lograr:**
- Crear una sala ✅
- Compartir el código ✅
- Otros entran sin fricción ✅
- Se suben stories ✅
- Todo desaparece ✅

Si eso funciona → Zorem funciona.
