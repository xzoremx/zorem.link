# 🎓 Explicación Completa del Backend de Zorem

Este documento explica cómo funciona el backend que hemos construido, archivo por archivo.

---

## 📐 Arquitectura General

```
Tu Computadora (localhost:3000)
    ↓
Express Server (server.js)
    ↓
Middlewares (CORS, Rate Limiting, JSON parsing)
    ↓
Routes (endpoints de la API - por ahora solo /health)
    ↓
Database Pool (pool.js)
    ↓
PostgreSQL en Render (base de datos remota)
```

---

## 🔄 Flujo de Conexión a la Base de Datos

### Paso 1: Variables de Entorno (`.env`)
Cuando ejecutas `npm run dev`, Node.js lee el archivo `.env` que contiene:
```env
DATABASE_URL=postgresql://usuario:password@host.render.com:5432/database
```

**¿Por qué `.env`?**
- Mantiene las credenciales fuera del código
- No se sube a Git (está en `.gitignore`)
- Diferentes valores para desarrollo y producción

### Paso 2: Configuración (`config/env.js`)
Este archivo:
1. **Carga** las variables del `.env` usando `dotenv`
2. **Valida** que las variables requeridas existan
3. **Exporta** un objeto `config` con todas las configuraciones

```javascript
// Lee DATABASE_URL del .env
databaseUrl: process.env.DATABASE_URL
```

### Paso 3: Pool de Conexiones (`db/pool.js`)
Este es el **corazón de la conexión**:

```javascript
export const pool = new Pool({
  connectionString: config.databaseUrl,  // ← Usa la URL del .env
  ssl: { rejectUnauthorized: false },    // ← Necesario para Render
  max: 20,                                // ← Máximo 20 conexiones simultáneas
})
```

**¿Qué es un "Pool"?**
- En lugar de crear una nueva conexión cada vez, mantiene un "pool" (grupo) de conexiones listas
- Cuando necesitas hacer una query, tomas una conexión del pool
- Cuando terminas, la devuelves al pool
- Es **mucho más eficiente** que crear/cerrar conexiones constantemente

**¿Cómo funciona la conexión desde localhost?**
1. Tu computadora (localhost) ejecuta el servidor Node.js
2. El servidor lee `DATABASE_URL` del `.env`
3. Usa la librería `pg` (PostgreSQL client) para conectarse
4. La URL contiene: `postgresql://usuario:password@host.render.com:5432/database`
5. `pg` hace una conexión **TCP/IP** a través de internet hasta Render
6. Render autentica usando usuario/password
7. ¡Conexión establecida! 🎉

**¿Por qué funciona desde localhost?**
- Render permite conexiones externas a su PostgreSQL
- Solo necesitas la URL correcta con usuario/password
- La conexión es **segura** (SSL/TLS)

### Paso 4: Ejecutar Queries
Cuando llamas a `query('SELECT * FROM users')`:
1. El pool toma una conexión disponible (o crea una nueva)
2. Envía el SQL a PostgreSQL en Render
3. Espera la respuesta
4. Devuelve los resultados
5. La conexión vuelve al pool

---

## 📁 Estructura de Archivos y su Rol

### 🎯 **`package.json`** - Dependencias del Proyecto
**Rol:** Define qué librerías necesita el proyecto

**Dependencias principales:**
- `express` - Framework web (crea el servidor HTTP)
- `pg` - Cliente de PostgreSQL (conecta a la base de datos)
- `dotenv` - Lee el archivo `.env`
- `cors` - Permite requests desde el frontend
- `jsonwebtoken` - Para autenticación (magic links)
- `nanoid` - Genera códigos únicos para salas
- `@aws-sdk/client-s3` - Para subir archivos a S3/R2

**Scripts:**
- `npm run dev` - Inicia el servidor con auto-reload (nodemon)
- `npm start` - Inicia el servidor en producción
- `npm run generate-secret` - Genera un JWT_SECRET seguro

---

### ⚙️ **`config/env.js`** - Configuración Centralizada
**Rol:** Centraliza todas las variables de entorno

**¿Qué hace?**
1. Carga `.env` con `dotenv.config()`
2. Valida que existan variables críticas (`DATABASE_URL`, `JWT_SECRET`)
3. Exporta un objeto `config` con todas las configuraciones

**Ejemplo de uso:**
```javascript
import { config } from './config/env.js';
console.log(config.databaseUrl); // ← Lee de process.env.DATABASE_URL
```

**¿Por qué centralizar?**
- Un solo lugar para todas las configuraciones
- Validación temprana (si falta algo, el servidor no inicia)
- Valores por defecto (ej: `PORT || '3000'`)

---

### 🗄️ **`db/pool.js`** - Gestión de Conexiones a PostgreSQL
**Rol:** Crea y gestiona el pool de conexiones a la base de datos

**Componentes:**

#### 1. **Creación del Pool**
```javascript
export const pool = new Pool({
  connectionString: config.databaseUrl,  // URL de conexión
  ssl: { rejectUnauthorized: false },    // SSL para Render
  max: 20,                                // Máx 20 conexiones
  connectionTimeoutMillis: 10000,        // Timeout de 10s
})
```

#### 2. **Event Listeners**
```javascript
pool.on('connect', ...)  // Se ejecuta cuando se conecta un cliente
pool.on('error', ...)    // Se ejecuta si hay un error
```

#### 3. **Función `testConnection()`**
- Prueba la conexión al iniciar el servidor
- Ejecuta `SELECT NOW()` para verificar que funciona
- Muestra mensajes claros de éxito/error

#### 4. **Función `query()`**
- Helper para ejecutar queries SQL
- Mide el tiempo de ejecución (útil para debugging)
- Maneja errores de forma consistente

**Uso típico:**
```javascript
import { query } from './db/pool.js';
const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
```

---

### 🚀 **`server.js`** - Servidor Express Principal
**Rol:** Punto de entrada del servidor, configura Express y maneja requests HTTP

**Flujo de ejecución:**

#### 1. **Imports y Setup**
```javascript
import express from 'express';
const app = express();  // Crea la aplicación Express
```

#### 2. **Middlewares (se ejecutan en orden)**
```javascript
app.use(corsMiddleware);           // Permite CORS
app.use(express.json());           // Parsea JSON en requests
app.use(express.urlencoded(...));  // Parsea form data
app.use(apiLimiter);               // Rate limiting
```

**¿Qué son los middlewares?**
- Funciones que se ejecutan **antes** de llegar a las rutas
- Pueden modificar el request, validar, o bloquear
- Ejemplo: `express.json()` convierte `{"name": "Juan"}` en un objeto JavaScript

#### 3. **Rutas (Endpoints)**
```javascript
app.get('/health', async (req, res) => {
  // Código que se ejecuta cuando alguien hace GET /health
})
```

**Por ahora solo tenemos:**
- `GET /health` - Verifica que el servidor y DB funcionen

#### 4. **Error Handlers**
```javascript
app.use((req, res) => {
  // 404 - Ruta no encontrada
})

app.use((err, req, res, next) => {
  // 500 - Error del servidor
})
```

#### 5. **Inicio del Servidor**
```javascript
app.listen(PORT, async () => {
  console.log('🚀 Server running...');
  await testConnection();  // Prueba la DB al iniciar
})
```

**¿Qué pasa cuando alguien hace un request?**
1. Request llega a Express (`GET http://localhost:3000/health`)
2. Pasa por middlewares (CORS, JSON parser, rate limiter)
3. Llega a la ruta `/health`
4. La ruta ejecuta `pool.query('SELECT NOW()')`
5. Espera respuesta de PostgreSQL
6. Responde con JSON: `{"status": "ok", ...}`

---

### 🛡️ **`middlewares/`** - Funciones de Seguridad y Configuración

#### **`cors.js`** - Cross-Origin Resource Sharing
**Rol:** Permite que el frontend (en otro puerto/dominio) haga requests

**¿Por qué es necesario?**
- Frontend: `http://localhost:8080`
- Backend: `http://localhost:3000`
- Los navegadores bloquean requests entre diferentes orígenes por seguridad
- CORS dice: "Sí, permite requests desde localhost:8080"

#### **`rateLimit.js`** - Límite de Requests
**Rol:** Previene abuso (spam, DDoS)

**Tipos de limiters:**
- `apiLimiter` - 100 requests por 15 minutos (general)
- `strictLimiter` - 10 requests por 15 minutos (sensible)
- `roomCreationLimiter` - 5 creaciones por hora
- `magicLinkLimiter` - 3 magic links por hora

**¿Cómo funciona?**
- Cuenta requests por IP
- Si excedes el límite, responde con error 429
- Se resetea después del tiempo definido

#### **`auth.js`** - Autenticación JWT
**Rol:** Verifica que los creators estén autenticados

**Funciones:**
- `verifyAuth()` - Middleware que verifica el token JWT
- `generateToken()` - Crea un token JWT
- `verifyMagicLinkToken()` - Verifica tokens de magic links

**¿Cómo funciona JWT?**
1. Usuario se autentica → servidor genera un token
2. Token se envía al cliente
3. Cliente incluye token en headers: `Authorization: Bearer <token>`
4. Middleware verifica el token en cada request protegido

---

### 🧰 **`lib/`** - Utilidades y Helpers

#### **`codes.js`** - Generación de Códigos de Sala
**Rol:** Genera códigos únicos de 6 caracteres para las salas

**Funciones:**
- `generateUniqueCode()` - Genera un código y verifica que sea único
- `validateCodeFormat()` - Valida que el formato sea correcto

**Ejemplo:**
```javascript
const code = await generateUniqueCode(); // "Z7K9M2"
```

#### **`crypto.js`** - Hashing para Viewers
**Rol:** Genera hashes únicos para identificar viewers sin cuentas

**¿Por qué?**
- Viewers no tienen cuentas
- Necesitamos identificarlos de forma única pero temporal
- Usamos SHA-256 hash

#### **`s3.js`** - Integración con Storage (S3/R2)
**Rol:** Maneja subida de archivos (fotos/videos de stories)

**Funciones:**
- `generateUploadUrl()` - Crea una URL firmada para subir archivos
- `deleteFile()` - Borra archivos del storage
- `generateMediaKey()` - Genera nombres únicos para archivos

**¿Cómo funciona presigned URLs?**
1. Frontend pide: "Quiero subir una foto"
2. Backend genera URL firmada (válida por 5 minutos)
3. Frontend sube directamente a S3/R2 usando esa URL
4. Backend confirma que se subió correctamente

---

### 📊 **`db/migrations/`** - Scripts SQL
**Rol:** Define la estructura de la base de datos

**Archivos:**
- `001_init.sql` - Tablas principales (users, rooms, stories)
- `002_viewer_sessions.sql` - Tabla de sesiones de viewers
- `003_stories_views.sql` - Tabla de vistas de stories

**¿Cómo se usan?**
- Los ejecutaste manualmente en pgAdmin
- En producción, se pueden automatizar con herramientas de migración

---

## 🔄 Flujo Completo: Request a `/health`

```
1. Cliente hace: GET http://localhost:3000/health
   ↓
2. Express recibe el request
   ↓
3. Middleware CORS: "¿Viene de un origen permitido?" → ✅
   ↓
4. Middleware JSON: (no aplica, es GET)
   ↓
5. Middleware Rate Limit: "¿Excedió límite?" → ✅
   ↓
6. Ruta /health se ejecuta:
   - Llama a pool.query('SELECT NOW()')
   ↓
7. Pool toma una conexión disponible
   ↓
8. Conexión TCP/IP a Render PostgreSQL
   ↓
9. PostgreSQL ejecuta SELECT NOW()
   ↓
10. PostgreSQL responde con timestamp
    ↓
11. Pool devuelve resultado a la ruta
    ↓
12. Ruta responde con JSON:
    {
      "status": "ok",
      "timestamp": "2025-12-17T23:20:34.574Z",
      "database": "connected"
    }
    ↓
13. Cliente recibe la respuesta
```

---

## 🔐 Seguridad y Mejores Prácticas

### ✅ Lo que estamos haciendo bien:

1. **Variables sensibles en `.env`** - No en el código
2. **Rate limiting** - Previene abuso
3. **CORS configurado** - Solo permite orígenes conocidos
4. **Connection pooling** - Eficiente y seguro
5. **SSL/TLS** - Conexión encriptada a PostgreSQL
6. **Error handling** - No expone información sensible en producción
7. **Validación de inputs** - (se implementará en las rutas)

### ⚠️ Cosas a tener en cuenta:

1. **`.env` nunca se sube a Git** - Ya está en `.gitignore`
2. **JWT_SECRET debe ser fuerte** - Usa `npm run generate-secret`
3. **Rate limits son importantes** - Ajusta según necesidad
4. **Logs en producción** - No mostrar información sensible

---

## 📝 Resumen Visual

```
┌─────────────────────────────────────────┐
│         Tu Computadora                  │
│  ┌──────────────────────────────────┐  │
│  │  npm run dev                     │  │
│  │  ↓                               │  │
│  │  server.js (Express)            │  │
│  │  ↓                               │  │
│  │  Middlewares (CORS, Rate Limit)  │  │
│  │  ↓                               │  │
│  │  Routes (/health, /api/...)     │  │
│  │  ↓                               │  │
│  │  pool.js (PostgreSQL Client)    │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
                    ↓
         (Conexión TCP/IP con SSL)
                    ↓
┌─────────────────────────────────────────┐
│         Render (Cloud)                   │
│  ┌──────────────────────────────────┐  │
│  │  PostgreSQL Database             │  │
│  │  - users                         │  │
│  │  - rooms                         │  │
│  │  - stories                       │  │
│  │  - viewer_sessions               │  │
│  │  - views                         │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

## 🎯 Próximos Pasos

Ahora que entiendes cómo funciona:

1. **Routes** - Crearemos endpoints como `/api/rooms`, `/api/viewer`
2. **Business Logic** - Lógica de negocio (crear salas, validar códigos)
3. **Frontend Integration** - Conectar el frontend con estos endpoints

¿Listo para continuar? 🚀
