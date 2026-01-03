# Plan: App Móvil Zorem (Creator-focused)

App nativa para creators. Los viewers seguirán usando la web (PWA-friendly).

## Stack Recomendado

**React Native + Expo** (reusa conocimiento de React, deploy rápido a iOS/Android)

Alternativas:
- Flutter (si prefieres Dart, mejor performance nativo)
- Swift/Kotlin nativos (más trabajo, mejor UX pero doble codebase)

## Alcance v1 (MVP)

### Funcionalidades Core

1. **Auth**
   - Login con email/password
   - Login con Google OAuth
   - Magic link (deep link handling)
   - 2FA (si está habilitado)
   - Persistencia de sesión (SecureStore)

2. **Dashboard de Rooms**
   - Lista de rooms del creator
   - Estado: activa/expirada
   - Métricas rápidas: # stories, # viewers
   - Pull-to-refresh

3. **Crear Room**
   - Configurar duración (24h, 72h, 7d)
   - Toggle allow_uploads
   - Límite de uploads por viewer
   - Generar código + QR

4. **Ver Room (como owner)**
   - Story viewer (swipe horizontal)
   - Ver quién subió cada story
   - Eliminar stories
   - Ver likes/views por story

5. **Compartir Room**
   - Share sheet nativo (código + link)
   - QR code (guardar imagen o mostrar)
   - Copy link

6. **Push Notifications**
   - Nueva story subida a tu room
   - Room por expirar (reminder)

### Fuera de alcance v1
- Upload de stories desde la app (los viewers usan web)
- Chat/comentarios
- Edición de media
- Analytics avanzados

## Estructura del Proyecto

```
apps/app/                     # Nuevo directorio
├── app/                      # Expo Router (file-based routing)
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx         # Dashboard rooms
│   │   ├── create.tsx        # Crear room
│   │   └── settings.tsx      # Perfil/config
│   ├── room/
│   │   └── [id].tsx          # Ver room + stories
│   └── _layout.tsx
├── components/
│   ├── StoryViewer.tsx
│   ├── RoomCard.tsx
│   ├── QRCode.tsx
│   └── ...
├── lib/
│   ├── api.ts                # Cliente API (reusar tipos del web)
│   ├── storage.ts            # SecureStore wrapper
│   └── notifications.ts      # Expo Notifications
├── context/
│   └── AuthContext.tsx
├── types/
│   └── index.ts              # Compartir con web-next
├── app.json
├── package.json
└── tsconfig.json
```

## Dependencias Clave

```json
{
  "expo": "~51.0.0",
  "expo-router": "~3.5.0",
  "expo-secure-store": "~13.0.0",
  "expo-notifications": "~0.28.0",
  "expo-image": "~1.12.0",
  "expo-av": "~14.0.0",
  "expo-sharing": "~12.0.0",
  "react-native-qrcode-svg": "^6.3.0",
  "@react-native-google-signin/google-signin": "^12.0.0"
}
```

## Cambios en Backend

### Nuevos endpoints (opcionales pero recomendados)

```
POST /api/auth/device-token     # Registrar token de push
DELETE /api/auth/device-token   # Eliminar token al logout

GET /api/rooms/:id/stats        # Métricas de room (viewers, views, likes)
```

### Modificaciones

- `POST /api/stories` → enviar push notification al owner de la room
- Agregar tabla `device_tokens` (user_id, token, platform, created_at)

## Fases de Implementación

### Fase 1: Setup + Auth
- Crear proyecto Expo en `apps/app/`
- Configurar Expo Router
- Implementar login/registro
- SecureStore para tokens
- Deep links para magic link

### Fase 2: Dashboard + Rooms
- Lista de rooms (GET /api/rooms)
- Crear room (POST /api/rooms)
- Pull-to-refresh
- Estado de rooms (activa/expirada)

### Fase 3: Story Viewer
- Componente StoryViewer (swipe)
- Preload de imágenes
- Video playback
- Eliminar stories

### Fase 4: Compartir
- QR code generation
- Share sheet nativo
- Copy to clipboard

### Fase 5: Push Notifications
- Expo Notifications setup
- Backend: enviar pushes
- Permisos iOS/Android

### Fase 6: Polish
- Skeleton loaders
- Error handling
- Offline state
- App icons + splash

## Consideraciones

### Deep Linking
```
zorem://room/ABC123        → Abrir room
zorem://auth/magic/TOKEN   → Magic link login
```

### OAuth en móvil
- Google Sign-In SDK nativo (no web redirect)
- Requiere configurar OAuth client IDs para iOS/Android en Google Cloud

### Almacenamiento seguro
- Usar `expo-secure-store` para JWT (no AsyncStorage)
- Limpiar tokens al logout

### Offline
- Cachear lista de rooms
- Mostrar estado "offline" claro
- Retry automático al reconectar
