# Zorem

Zorem es una app de **stories efímeros** (tipo Instagram) pero basada en **rooms privadas** con código de 6 caracteres. Un creator crea una room, comparte el código/QR y los viewers entran, ven stories y (si está habilitado) suben stories **sin crear cuenta**.

> Nota: el frontend principal del proyecto es `apps/web-next` (Next.js). Los otros frontends (`apps/web-react`, `apps/web`) existen como alternativos/legacy.

## Conceptos Clave

- **Creator**: usuario autenticado (JWT). Puede crear rooms, ver su panel y borrar stories.
- **Viewer**: entra con nickname y obtiene un `viewer_hash` (guest session) guardado en `localStorage`.
- **Room**: contenedor con `code`, `expires_at`, `allow_uploads`, `max_uploads_per_viewer` y `stories_version` (para refrescos).
- **Story**: media (image/video) guardada en storage (S3/R2) como `media_key` y expira con la room.
- **Realtime**: la room usa SSE para refrescar stories cuando cambia `stories_version`.

## Estructura del Monorepo

```
zorem/
├── apps/
│   ├── web-next/       # Frontend principal (Next.js 15 + React 19)
│   ├── web-react/      # Frontend alternativo (React + Vite)
│   ├── web/            # Frontend legacy (HTML estático)
│   └── app/            # (vacío/reservado)
├── services/
│   ├── api/            # Backend (Express + TypeScript)
│   └── jobs/           # (placeholder) tareas programadas/cleanup
```

## Flujos Principales

### Creator (autenticado)
1. Login: `/auth` (email/password, magic link, Google OAuth, 2FA según configuración).
2. Crear room: `/create-room` → `POST /api/rooms`.
3. Ver rooms: `/my-rooms` → `GET /api/rooms`.
4. Ver room: `/room` (carga stories por roomId) → `GET /api/stories/room/:roomId`.
5. Borrar story: `DELETE /api/stories/:storyId` (solo owner).

### Viewer (guest)
1. Landing: `/` → valida `code`.
2. Nickname: `/nickname?code=XXXXXX` → `POST /api/viewer/join`.
3. Room: `/room` → `GET /api/stories/room/:roomId`.
4. (Opcional) Upload: `POST /api/stories/upload-url` → PUT directo a storage → `POST /api/stories`.
5. Likes: `POST /api/stories/:storyId/like` (requiere `viewer_hash` válido en la room).

## Frontend Principal (apps/web-next)

Rutas (App Router):
- `/` landing + navegación del creator
- `/auth` login/registro/OAuth/magic link
- `/my-rooms` dashboard de rooms del creator
- `/create-room` creación de rooms
- `/nickname` join de viewers (nickname)
- `/room` viewer de stories + upload + acciones

Piezas importantes:
- `apps/web-next/src/lib/api.ts`: cliente tipado del API (incluye `storage` con `auth_token`, `viewer_hash`, `current_room_id`, `current_room_code`).
- `apps/web-next/src/context/AuthContext.tsx`: estado de auth del creator (`login/logout/refreshUser`).
- `apps/web-next/src/app/room/page.tsx`: consume stories, maneja SSE, preload de imágenes y retry de media URLs.

## Backend (services/api)

Estructura:
```
services/api/src/
├── server.ts            # Express + middlewares + routes
├── routes/
│   ├── auth.routes.ts   # auth: password, OAuth, 2FA, magic links
│   ├── rooms.routes.ts  # rooms del creator
│   ├── stories.routes.ts# stories: listado, upload-url, create, view, like, delete, SSE
│   └── viewer.routes.ts # join viewer y sesión
├── lib/
│   ├── s3.ts            # presigned PUT/GET + media keys
│   ├── roomEvents.ts    # SSE + Postgres LISTEN/NOTIFY (room_events)
│   └── cleanup.ts       # eliminación automática de rooms/media expirados
├── db/
│   ├── pool.ts
│   └── migrations/      # SQL migrations (001..007)
└── config/env.ts        # env vars + defaults
```

Base de datos (tablas relevantes, ver migraciones):
- `users`, `rooms`, `stories`
- `viewer_sessions` (nickname + viewer_hash por room)
- `views` (tracking de vistas)
- `story_likes` (likes por viewer_hash)
- `cleanup_locks` (lock distribuido para cleanup)

## Sistema de Cleanup (Eliminación Automática)

El cleanup corre cada 60 segundos dentro del servidor Express:

1. **Fase 1 - Media**: Cuando una room expira, elimina archivos de S3/R2 inmediatamente (máx ~1 min de retraso).
2. **Fase 2 - Metadata**: Después de 7 días, elimina la room y todos sus datos de la DB.

Esto permite que el creator vea stats de rooms expiradas por 7 días en `/my-rooms`.

Archivos relevantes:
- `lib/cleanup.ts`: lógica de cleanup con lock distribuido
- `migrations/007_cleanup.sql`: tabla de locks + columna `media_deleted_at`

El endpoint `GET /api/rooms` ahora retorna:
- `is_expired`: boolean - si la room ya expiró
- `total_views`, `total_likes`: stats agregadas (útil para rooms expiradas)

## Variables de Entorno

### API (services/api)
Requeridas:
```env
DATABASE_URL=postgresql://...
JWT_SECRET=...
```
Recomendadas:
```env
FRONTEND_URL=https://zorem.link
```
Storage (una de las dos):
```env
# S3
STORAGE_TYPE=s3
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
S3_BUCKET_NAME=...

# R2 (requiere endpoint configurado y bucket accesible)
STORAGE_TYPE=r2
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=auto
S3_BUCKET_NAME=...
R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com
```

### Web (apps/web-next)
```env
NEXT_PUBLIC_API_URL=https://api.zorem.link
```


## Desarrollo Local (recomendado)

1. API: `cd services/api && npm run dev` (por defecto puerto 3000).
2. Web: `cd apps/web-next && npm run dev -- -p 3001` (o deja que Next elija el siguiente puerto libre).
3. Migraciones: `services/api/src/db/migrations/*.sql` (001..006).

## Gotchas (para evitar bugs)

- **No cachear stories**: el listado incluye `media_url` que puede ser presigned (expira). El endpoint de stories debe responder `Cache-Control: no-store` y el cliente debe pedirlo sin caché.
- **Likes vs creator**: `liked` (estado boolean) depende de `viewer_hash`. El creator puede ver `like_count` aunque no tenga `viewer_hash`.
- **Logout**: usa `AuthContext.logout()` para limpiar token + estado en memoria (no solo `localStorage`).

## Documentación Adicional

- `README.md` - overview/plan del proyecto
- `DEPLOYMENT.md` - guía de despliegue (revisar: algunas secciones pueden estar desactualizadas respecto a `apps/web-next`)
- `QUICK_DEPLOY.md` - checklist rápido para Render
