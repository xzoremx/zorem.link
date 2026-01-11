# Plan: Tests para Backend (services/api)

## Stack de Testing

```json
{
  "vitest": "^2.0.0",           // Test runner (compatible con el proyecto)
  "supertest": "^7.0.0",        // HTTP assertions
  "@faker-js/faker": "^9.0.0",  // Datos de prueba
  "testcontainers": "^10.0.0"   // PostgreSQL en Docker para tests
}
```

Alternativa sin Docker: usar `pg-mem` para simular PostgreSQL en memoria.

## Estructura de Tests

```
services/api/
├── src/
│   └── ...
├── tests/
│   ├── setup.ts              # Setup global (DB, env)
│   ├── helpers/
│   │   ├── db.ts             # Helpers para limpiar/seedear DB
│   │   ├── auth.ts           # Crear usuarios/tokens de prueba
│   │   └── factories.ts      # Factories para crear entidades
│   ├── unit/
│   │   ├── lib/
│   │   │   ├── codes.test.ts
│   │   │   ├── crypto.test.ts
│   │   │   └── s3.test.ts
│   │   └── middlewares/
│   │       ├── auth.test.ts
│   │       └── rateLimit.test.ts
│   └── integration/
│       ├── auth.test.ts
│       ├── rooms.test.ts
│       ├── stories.test.ts
│       └── viewer.test.ts
├── vitest.config.ts
└── package.json
```

## Configuración

### vitest.config.ts
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/types/**', 'src/db/migrations/**']
    },
    // Ejecutar tests secuencialmente para evitar conflictos de DB
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  }
});
```

### tests/setup.ts
```typescript
import { beforeAll, afterAll, beforeEach } from 'vitest';
import { pool } from '../src/db/pool';

beforeAll(async () => {
  // Verificar conexión a DB de test
  await pool.query('SELECT 1');
});

beforeEach(async () => {
  // Limpiar tablas entre tests
  await pool.query(`
    TRUNCATE users, rooms, stories, viewer_sessions, views, story_likes
    RESTART IDENTITY CASCADE
  `);
});

afterAll(async () => {
  await pool.end();
});
```

### tests/helpers/factories.ts
```typescript
import { faker } from '@faker-js/faker';
import { pool } from '../../src/db/pool';
import bcrypt from 'bcrypt';

export async function createUser(overrides = {}) {
  const password = overrides.password || 'testpass123';
  const passwordHash = await bcrypt.hash(password, 10);

  const result = await pool.query(`
    INSERT INTO users (email, password_hash, email_verified)
    VALUES ($1, $2, true)
    RETURNING *
  `, [
    overrides.email || faker.internet.email(),
    passwordHash
  ]);

  return { ...result.rows[0], password };
}

export async function createRoom(userId: string, overrides = {}) {
  const result = await pool.query(`
    INSERT INTO rooms (owner_id, code, expires_at, allow_uploads)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `, [
    userId,
    overrides.code || faker.string.alphanumeric(6).toUpperCase(),
    overrides.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000),
    overrides.allowUploads ?? true
  ]);

  return result.rows[0];
}

export async function createStory(roomId: string, overrides = {}) {
  const result = await pool.query(`
    INSERT INTO stories (room_id, media_type, media_key, expires_at)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `, [
    roomId,
    overrides.mediaType || 'image',
    overrides.mediaKey || `stories/${faker.string.uuid()}.jpg`,
    overrides.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000)
  ]);

  return result.rows[0];
}
```

## Tests por Módulo

### 1. Unit Tests

#### tests/unit/lib/codes.test.ts
```typescript
import { describe, it, expect } from 'vitest';
import { generateCode } from '../../../src/lib/codes';

describe('generateCode', () => {
  it('genera código de 6 caracteres', () => {
    const code = generateCode();
    expect(code).toHaveLength(6);
  });

  it('solo contiene caracteres alfanuméricos uppercase', () => {
    const code = generateCode();
    expect(code).toMatch(/^[A-Z0-9]+$/);
  });

  it('genera códigos únicos', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateCode()));
    expect(codes.size).toBe(100);
  });
});
```

#### tests/unit/middlewares/auth.test.ts
```typescript
import { describe, it, expect, vi } from 'vitest';
import { authenticateCreator } from '../../../src/middlewares/auth';
import jwt from 'jsonwebtoken';

describe('authenticateCreator middleware', () => {
  it('rechaza requests sin token', async () => {
    const req = { headers: {} };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await authenticateCreator(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rechaza token inválido', async () => {
    const req = { headers: { authorization: 'Bearer invalid' } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await authenticateCreator(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('acepta token válido y setea req.user', async () => {
    const token = jwt.sign({ userId: '123' }, process.env.JWT_SECRET!);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await authenticateCreator(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
  });
});
```

### 2. Integration Tests

#### tests/integration/auth.test.ts
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/server';
import { createUser } from '../helpers/factories';

describe('POST /api/auth/login', () => {
  it('login exitoso retorna token', async () => {
    const user = await createUser({ email: 'test@example.com', password: 'pass123' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'pass123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('test@example.com');
  });

  it('credenciales incorrectas retorna 401', async () => {
    await createUser({ email: 'test@example.com', password: 'pass123' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'wrongpass' });

    expect(res.status).toBe(401);
  });

  it('email no registrado retorna 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'noexiste@example.com', password: 'pass123' });

    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/register', () => {
  it('registro exitoso crea usuario', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'nuevo@example.com', password: 'pass123' });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('nuevo@example.com');
  });

  it('email duplicado retorna 409', async () => {
    await createUser({ email: 'existe@example.com' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'existe@example.com', password: 'pass123' });

    expect(res.status).toBe(409);
  });
});
```

#### tests/integration/rooms.test.ts
```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/server';
import { createUser, createRoom } from '../helpers/factories';
import { generateToken } from '../helpers/auth';

describe('POST /api/rooms', () => {
  it('crea room con código único', async () => {
    const user = await createUser();
    const token = generateToken(user.id);

    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ duration: '24h', allow_uploads: true });

    expect(res.status).toBe(201);
    expect(res.body.code).toHaveLength(6);
    expect(res.body.allow_uploads).toBe(true);
  });

  it('requiere autenticación', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .send({ duration: '24h' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/rooms', () => {
  it('retorna solo rooms del usuario autenticado', async () => {
    const user1 = await createUser();
    const user2 = await createUser();
    await createRoom(user1.id);
    await createRoom(user1.id);
    await createRoom(user2.id);

    const token = generateToken(user1.id);
    const res = await request(app)
      .get('/api/rooms')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.rooms).toHaveLength(2);
  });
});

describe('GET /api/rooms/validate/:code', () => {
  it('código válido retorna room info', async () => {
    const user = await createUser();
    const room = await createRoom(user.id, { code: 'ABC123' });

    const res = await request(app)
      .get('/api/rooms/validate/ABC123');

    expect(res.status).toBe(200);
    expect(res.body.room_id).toBe(room.id);
  });

  it('código inválido retorna 404', async () => {
    const res = await request(app)
      .get('/api/rooms/validate/NOEXISTE');

    expect(res.status).toBe(404);
  });

  it('room expirada retorna 410', async () => {
    const user = await createUser();
    await createRoom(user.id, {
      code: 'EXPIRED',
      expiresAt: new Date(Date.now() - 1000)
    });

    const res = await request(app)
      .get('/api/rooms/validate/EXPIRED');

    expect(res.status).toBe(410);
  });
});
```

#### tests/integration/stories.test.ts
```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/server';
import { createUser, createRoom, createStory } from '../helpers/factories';
import { generateToken, createViewerSession } from '../helpers/auth';

describe('GET /api/stories/room/:roomId', () => {
  it('retorna stories de la room', async () => {
    const user = await createUser();
    const room = await createRoom(user.id);
    await createStory(room.id);
    await createStory(room.id);

    const res = await request(app)
      .get(`/api/stories/room/${room.id}`);

    expect(res.status).toBe(200);
    expect(res.body.stories).toHaveLength(2);
  });

  it('incluye liked=true si viewer dio like', async () => {
    const user = await createUser();
    const room = await createRoom(user.id);
    const story = await createStory(room.id);
    const viewerHash = await createViewerSession(room.id, 'TestViewer');

    // Dar like
    await request(app)
      .post(`/api/stories/${story.id}/like`)
      .send({ viewer_hash: viewerHash });

    const res = await request(app)
      .get(`/api/stories/room/${room.id}?viewer_hash=${viewerHash}`);

    expect(res.body.stories[0].liked).toBe(true);
  });

  it('header Cache-Control: no-store presente', async () => {
    const user = await createUser();
    const room = await createRoom(user.id);

    const res = await request(app)
      .get(`/api/stories/room/${room.id}`);

    expect(res.headers['cache-control']).toContain('no-store');
  });
});

describe('DELETE /api/stories/:storyId', () => {
  it('owner puede eliminar story', async () => {
    const user = await createUser();
    const room = await createRoom(user.id);
    const story = await createStory(room.id);
    const token = generateToken(user.id);

    const res = await request(app)
      .delete(`/api/stories/${story.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('no-owner no puede eliminar story', async () => {
    const owner = await createUser();
    const other = await createUser();
    const room = await createRoom(owner.id);
    const story = await createStory(room.id);
    const token = generateToken(other.id);

    const res = await request(app)
      .delete(`/api/stories/${story.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});
```

#### tests/integration/viewer.test.ts
```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/server';
import { createUser, createRoom } from '../helpers/factories';

describe('POST /api/viewer/join', () => {
  it('crea sesión de viewer con nickname', async () => {
    const user = await createUser();
    const room = await createRoom(user.id, { code: 'TESTROOM' });

    const res = await request(app)
      .post('/api/viewer/join')
      .send({ code: 'TESTROOM', nickname: 'TestViewer' });

    expect(res.status).toBe(200);
    expect(res.body.viewer_hash).toBeDefined();
    expect(res.body.room_id).toBe(room.id);
  });

  it('código inválido retorna 404', async () => {
    const res = await request(app)
      .post('/api/viewer/join')
      .send({ code: 'NOEXISTE', nickname: 'Test' });

    expect(res.status).toBe(404);
  });

  it('nickname requerido', async () => {
    const user = await createUser();
    await createRoom(user.id, { code: 'TESTROOM' });

    const res = await request(app)
      .post('/api/viewer/join')
      .send({ code: 'TESTROOM' });

    expect(res.status).toBe(400);
  });
});
```

## Scripts en package.json

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui",
    "test:watch": "vitest --watch"
  }
}
```

## Variables de Entorno para Tests

Crear `services/api/.env.test`:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/zorem_test
JWT_SECRET=test-secret-key-for-testing
NODE_ENV=test
```

## Fases de Implementación

### Fase 1: Setup
- Instalar dependencias (vitest, supertest, faker)
- Crear vitest.config.ts
- Crear tests/setup.ts
- Crear DB de test (zorem_test)
- Configurar scripts en package.json

### Fase 2: Helpers
- tests/helpers/db.ts
- tests/helpers/auth.ts
- tests/helpers/factories.ts

### Fase 3: Unit Tests
- lib/codes.test.ts
- lib/crypto.test.ts
- middlewares/auth.test.ts
- middlewares/rateLimit.test.ts

### Fase 4: Integration Tests (Auth)
- tests/integration/auth.test.ts (login, register, OAuth mock, 2FA)

### Fase 5: Integration Tests (Core)
- tests/integration/rooms.test.ts
- tests/integration/stories.test.ts
- tests/integration/viewer.test.ts

### Fase 6: CI/CD
- GitHub Actions workflow para correr tests
- Coverage reports
- Fail PR si coverage baja

## Cobertura Objetivo

- **Unit tests**: 90%+ en lib/ y middlewares/
- **Integration tests**: 80%+ en routes/
- **Overall**: 75%+ cobertura total
