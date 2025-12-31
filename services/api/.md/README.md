# Zorem API

Backend API para Zorem - Stories privadas, efímeras y sin ruido social.

## 🚀 Inicio Rápido

### Desarrollo Local

1. Instala dependencias:
```bash
npm install
```

2. Crea un archivo `.env` con las variables necesarias (ver `.env.example` o `RENDER_SETUP.md`)

3. Ejecuta las migraciones de base de datos (si aún no las ejecutaste)

4. Inicia el servidor:
```bash
npm run dev
```

El servidor estará disponible en `http://localhost:3000`

### Health Check

Verifica que el servidor esté funcionando:
```bash
curl http://localhost:3000/health
```

## 📁 Estructura del Proyecto

```
src/
├── config/
│   └── env.js          # Configuración de variables de entorno
├── db/
│   ├── migrations/      # Scripts SQL de migración
│   └── pool.js          # Pool de conexiones PostgreSQL
├── lib/
│   ├── codes.js         # Generación de códigos únicos
│   ├── crypto.js        # Hashing para viewers
│   └── s3.js            # Integración S3/R2
├── middlewares/
│   ├── auth.js          # Autenticación JWT
│   ├── cors.js          # Configuración CORS
│   └── rateLimit.js     # Rate limiting
├── routes/
│   ├── auth.routes.js   # Autenticación (magic link)
│   ├── rooms.routes.js  # Gestión de salas
│   ├── stories.routes.js # Stories
│   └── viewer.routes.js # Viewers
└── server.js            # Servidor Express principal
```

## 🔧 Variables de Entorno

Ver `RENDER_SETUP.md` para instrucciones detalladas de configuración en Render.

### Variables Requeridas

- `DATABASE_URL` - URL de conexión a PostgreSQL
- `JWT_SECRET` - Clave secreta para JWT tokens

### Variables Opcionales

- `PORT` - Puerto del servidor (default: 3000, Render lo proporciona automáticamente)
- `NODE_ENV` - Entorno (development/production)
- `FRONTEND_URL` - URL del frontend para CORS
- Variables de Storage (S3/R2) - Ver `RENDER_SETUP.md`

## 📚 API Endpoints

### Health Check
- `GET /health` - Verifica estado del servidor y conexión a DB

### Autenticación (Próximamente)
- `POST /api/auth/request-magic-link` - Solicitar magic link
- `GET /api/auth/verify-magic-link` - Verificar token
- `GET /api/auth/me` - Obtener usuario actual

### Salas (Próximamente)
- `POST /api/rooms` - Crear sala
- `GET /api/rooms/:code` - Validar código
- `GET /api/rooms/:roomId` - Obtener detalles
- `DELETE /api/rooms/:roomId` - Cerrar sala

### Stories (Próximamente)
- `GET /api/stories/room/:roomId` - Listar stories
- `POST /api/stories/upload-url` - Obtener presigned URL
- `POST /api/stories` - Crear story
- `POST /api/stories/:storyId/view` - Registrar vista

### Viewers (Próximamente)
- `POST /api/viewer/join` - Unirse a sala
- `GET /api/viewer/session` - Obtener sesión

## 🗄️ Base de Datos

Las migraciones están en `src/db/migrations/`:

1. `001_init.sql` - Tablas principales (users, rooms, stories)
2. `002_viewer_sessions.sql` - Sesiones de viewers
3. `003_stories_views.sql` - Vistas de stories

Ejecuta las migraciones en orden antes de iniciar el servidor.

## 🚀 Deploy en Render

1. Conecta tu repositorio a Render
2. Crea un servicio Web Service
3. Configura las variables de entorno (ver `RENDER_SETUP.md`)
4. Conecta PostgreSQL como Add-on
5. Deploy!

## 📝 Scripts

- `npm run dev` - Desarrollo con nodemon
- `npm start` - Producción

## 🔒 Seguridad

- Rate limiting en todos los endpoints
- JWT para autenticación de creators
- Validación de inputs
- CORS configurado
- Variables sensibles en .env (no en código)
