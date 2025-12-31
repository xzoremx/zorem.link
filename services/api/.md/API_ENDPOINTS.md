# 📡 API Endpoints - Zorem

Documentación completa de todos los endpoints disponibles.

**Base URL:** `http://localhost:3000` (desarrollo) o tu URL de producción

---

## 🔐 Autenticación (`/api/auth`)

### POST `/api/auth/request-magic-link`
Solicitar magic link por email (para creators).

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (desarrollo):**
```json
{
  "message": "Magic link generated (development mode)",
  "magic_link": "http://localhost:8080/auth/verify?token=...",
  "token": "eyJhbGc..."
}
```

**Rate Limit:** 3 requests por hora por IP

---

### GET `/api/auth/verify-magic-link?token=xxx`
Verificar token de magic link y obtener token de sesión.

**Response:**
```json
{
  "message": "Magic link verified successfully",
  "token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

---

### GET `/api/auth/me`
Obtener información del usuario autenticado.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "created_at": "2025-01-01T00:00:00Z",
  "rooms_count": 5
}
```

---

## 🏠 Salas (`/api/rooms`)

### POST `/api/rooms`
Crear una nueva sala (requiere autenticación).

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "duration": "24h",  // "24h", "72h", o "7d"
  "allow_uploads": true
}
```

**Response:**
```json
{
  "room_id": "uuid",
  "code": "Z7K9M2",
  "link": "http://localhost:8080/room?code=Z7K9M2",
  "qr_data": "data:image/png;base64,...",
  "expires_at": "2025-01-02T00:00:00Z",
  "allow_uploads": true,
  "duration": "24h"
}
```

**Rate Limit:** 5 creaciones por hora por IP

---

### GET `/api/rooms/:code`
Validar código de sala (público, no requiere auth).

**Response (válido):**
```json
{
  "valid": true,
  "room_id": "uuid",
  "code": "Z7K9M2",
  "expires_at": "2025-01-02T00:00:00Z",
  "allow_uploads": true
}
```

**Response (inválido):**
```json
{
  "valid": false,
  "error": "Room not found"
}
```

---

### GET `/api/rooms/id/:roomId`
Obtener detalles de una sala (solo el owner).

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "room_id": "uuid",
  "code": "Z7K9M2",
  "expires_at": "2025-01-02T00:00:00Z",
  "hours_remaining": 18,
  "allow_uploads": true,
  "is_active": true,
  "viewer_count": 15,
  "story_count": 8,
  "created_at": "2025-01-01T00:00:00Z"
}
```

---

### GET `/api/rooms`
Listar todas las salas del usuario autenticado.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "rooms": [
    {
      "room_id": "uuid",
      "code": "Z7K9M2",
      "expires_at": "2025-01-02T00:00:00Z",
      "hours_remaining": 18,
      "allow_uploads": true,
      "is_active": true,
      "viewer_count": 15,
      "story_count": 8,
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

---

### DELETE `/api/rooms/:roomId`
Cerrar/desactivar una sala (solo el owner).

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Room closed successfully",
  "room_id": "uuid",
  "code": "Z7K9M2"
}
```

---

## 👥 Viewers (`/api/viewer`)

### POST `/api/viewer/join`
Unirse a una sala con código y nickname.

**Request:**
```json
{
  "code": "Z7K9M2",
  "nickname": "Juan"
}
```

**Response:**
```json
{
  "viewer_hash": "abc123...",
  "room_id": "uuid",
  "room_code": "Z7K9M2",
  "allow_uploads": true,
  "expires_at": "2025-01-02T00:00:00Z",
  "nickname": "Juan"
}
```

---

### GET `/api/viewer/session?viewer_hash=xxx`
Obtener información de la sesión actual.

**Query Params o Header:**
- `viewer_hash` (query param) o `x-viewer-hash` (header)

**Response:**
```json
{
  "viewer_hash": "abc123...",
  "room_id": "uuid",
  "room_code": "Z7K9M2",
  "nickname": "Juan",
  "allow_uploads": true,
  "expires_at": "2025-01-02T00:00:00Z",
  "created_at": "2025-01-01T00:00:00Z"
}
```

---

## 📸 Stories (`/api/stories`)

### GET `/api/stories/room/:roomId`
Listar todas las stories de una sala (orden cronológico).

**Query Params (opcional):**
- `viewer_hash` - Para marcar cuáles stories ya fueron vistas

**Response:**
```json
{
  "room_id": "uuid",
  "allow_uploads": true,
  "stories": [
    {
      "id": "uuid",
      "media_type": "image",
      "media_url": "https://...",
      "media_key": "stories/...",
      "created_at": "2025-01-01T00:00:00Z",
      "expires_at": "2025-01-02T00:00:00Z",
      "view_count": 5,
      "viewed": false
    }
  ],
  "total": 1
}
```

---

### POST `/api/stories/upload-url`
Obtener presigned URL para subir un archivo.

**Request:**
```json
{
  "room_id": "uuid",
  "media_type": "image",  // "image" o "video"
  "file_size": 1024000
}
```

**Headers (uno de estos):**
- `Authorization: Bearer <token>` (si es creator)
- `x-viewer-hash: <viewer_hash>` (si es viewer con permisos)

**Response:**
```json
{
  "upload_url": "https://s3.amazonaws.com/...",
  "media_key": "stories/uuid/timestamp-random.jpg",
  "expires_in": 300,
  "room_expires_at": "2025-01-02T00:00:00Z"
}
```

**Nota:** El `upload_url` es válido por 5 minutos. Debes subir el archivo directamente a S3/R2 usando este URL.

---

### POST `/api/stories`
Confirmar upload y crear story en la base de datos.

**Request:**
```json
{
  "room_id": "uuid",
  "media_key": "stories/uuid/timestamp-random.jpg",
  "media_type": "image"
}
```

**Headers (uno de estos):**
- `Authorization: Bearer <token>` (si es creator)
- `x-viewer-hash: <viewer_hash>` (si es viewer con permisos)

**Response:**
```json
{
  "id": "uuid",
  "room_id": "uuid",
  "media_type": "image",
  "media_key": "stories/uuid/timestamp-random.jpg",
  "created_at": "2025-01-01T00:00:00Z",
  "expires_at": "2025-01-02T00:00:00Z"
}
```

---

### POST `/api/stories/:storyId/view`
Registrar que un viewer vio una story.

**Request:**
```json
{
  "viewer_hash": "abc123..."
}
```

**Response:**
```json
{
  "message": "View recorded",
  "story_id": "uuid"
}
```

---

## 🔍 Health Check

### GET `/health`
Verificar estado del servidor y conexión a base de datos.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-01T00:00:00Z",
  "database": "connected"
}
```

---

## 📝 Notas Importantes

### Autenticación
- Los endpoints de **creators** requieren `Authorization: Bearer <token>` en headers
- Los endpoints de **viewers** usan `viewer_hash` (en body, query params, o header `x-viewer-hash`)

### Rate Limiting
- General: 100 requests por 15 minutos
- Magic links: 3 por hora
- Creación de salas: 5 por hora

### Códigos de Error Comunes
- `400` - Bad Request (datos inválidos)
- `401` - Unauthorized (token inválido o faltante)
- `403` - Forbidden (sin permisos o sala expirada)
- `404` - Not Found (recurso no existe)
- `429` - Too Many Requests (rate limit excedido)
- `500` - Internal Server Error

### Flujo Típico

**Creator:**
1. `POST /api/auth/request-magic-link` → obtener token
2. `GET /api/auth/verify-magic-link?token=xxx` → verificar y obtener session token
3. `POST /api/rooms` → crear sala
4. Compartir código

**Viewer:**
1. `GET /api/rooms/:code` → validar código
2. `POST /api/viewer/join` → unirse con nickname
3. `GET /api/stories/room/:roomId` → ver stories
4. `POST /api/stories/upload-url` → (opcional) subir story
5. `POST /api/stories` → confirmar upload

---

## 🧪 Probar los Endpoints

### Con cURL:

```bash
# Health check
curl http://localhost:3000/health

# Crear sala (requiere token)
curl -X POST http://localhost:3000/api/rooms \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"duration": "24h", "allow_uploads": true}'

# Validar código
curl http://localhost:3000/api/rooms/Z7K9M2

# Unirse a sala
curl -X POST http://localhost:3000/api/viewer/join \
  -H "Content-Type: application/json" \
  -d '{"code": "Z7K9M2", "nickname": "Juan"}'
```

### Con JavaScript (fetch):

```javascript
// Unirse a sala
const response = await fetch('http://localhost:3000/api/viewer/join', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    code: 'Z7K9M2',
    nickname: 'Juan'
  })
});

const data = await response.json();
console.log(data);
```

---

¡Todos los endpoints están listos para usar! 🚀
