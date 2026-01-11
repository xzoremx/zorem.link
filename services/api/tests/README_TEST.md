# Backend Tests

Complete test suite for Zorem API using Vitest and Supertest.

## 📦 Test Stack

- **Vitest** - Fast unit test framework
- **Supertest** - HTTP assertions for integration tests
- **Faker** - Generate realistic test data
- **Coverage** - v8 coverage provider

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd services/api
npm install
```

### 2. Setup Test Database

Create a **separate** PostgreSQL database for testing:

```sql
CREATE DATABASE zorem_test;
```

**IMPORTANT:** Never use your production or development database for tests! Tests will truncate all tables between runs.

### 3. Configure Environment

Copy the example env file:

```bash
cp .env.test.example .env.test
```

Edit `.env.test` and set your test database URL:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/zorem_test
JWT_SECRET=any-secret-key-for-tests
NODE_ENV=test
```

Notes:
- When running `npm test` / `vitest`, the API loads `.env.test` automatically (and does **not** auto-load `.env`).
- Tests refuse to run unless the database name in `DATABASE_URL` contains `test` (e.g. `zorem_test`).

### 4. Run Migrations

Apply database migrations to the test database:

```bash
# Set env to test database
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/zorem_test"

# Run migrations manually or use your migration script
psql -d zorem_test -f src/db/migrations/001_init.sql
psql -d zorem_test -f src/db/migrations/002_viewer_sessions.sql
# ... repeat for all migrations
```

Or use a migration tool if available.

### 5. Run Tests

```bash
# Run all tests
npm test

# Run tests once (CI mode)
npm run test:run

# Run with coverage
npm run test:coverage

# Run with UI (interactive)
npm run test:ui

# Watch mode (re-run on changes)
npm run test:watch
```

## 📁 Test Structure

```
tests/
├── setup.ts                 # Global setup (DB connection, cleanup)
├── helpers/
│   ├── factories.ts         # Create test entities (users, rooms, stories)
│   ├── auth.ts              # Generate JWT tokens for tests
│   └── db.ts                # Database utilities
├── unit/
│   └── lib/
│       ├── codes.test.ts    # Code generation & validation
│       └── crypto.test.ts   # Hashing & validation
└── integration/
    ├── auth.test.ts         # Authentication endpoints
    ├── rooms.test.ts        # Room CRUD operations
    ├── stories.test.ts      # Story management & engagement
    └── viewer.test.ts       # Viewer sessions & join flow
```

## 🧪 Test Types

### Unit Tests

Test individual functions in isolation.

**Example:**
```typescript
import { validateCodeFormat } from '@/lib/codes';

it('accepts valid 6-character code', () => {
  expect(validateCodeFormat('ABC123')).toBe(true);
});
```

**Location:** `tests/unit/**/*.test.ts`

### Integration Tests

Test complete HTTP endpoints with real database.

**Example:**
```typescript
import request from 'supertest';
import { app } from '@/app.js';

it('creates a new room', async () => {
  const res = await request(app)
    .post('/api/rooms')
    .set('Authorization', `Bearer ${token}`)
    .send({ duration: '1h' });

  expect(res.status).toBe(201);
});
```

**Location:** `tests/integration/**/*.test.ts`

## 🛠️ Test Helpers

### Factories

Easily create test data:

```typescript
import { createUser, createRoom, createStory } from './helpers/factories.js';

const user = await createUser({ email: 'test@example.com' });
const room = await createRoom(user.id, { code: 'TEST99' });
const story = await createStory(room.id);
```

### Auth Helpers

Generate tokens for authenticated requests:

```typescript
import { generateToken, authHeader } from './helpers/auth.js';

const token = generateToken(user.id);

await request(app)
  .get('/api/auth/me')
  .set(authHeader(token));
```

## 📊 Coverage

Run tests with coverage report:

```bash
npm run test:coverage
```

Coverage reports are generated in:
- `coverage/index.html` - HTML report (open in browser)
- Terminal output - Summary

**Target Coverage:**
- Overall: 75%+
- Unit tests (lib/): 90%+
- Integration tests (routes/): 80%+

## ⚠️ Important Notes

### Database Safety

- **Always use a separate test database**
- Tests truncate all tables between runs
- Never point to production or development DB

### Test Isolation

- Each test starts with a clean database
- Tests run sequentially to avoid conflicts
- Use factories to create test data, not shared fixtures

### CI/CD

Tests are designed to run in CI environments:

```yaml
# GitHub Actions example
- name: Run tests
  run: |
    cd services/api
    npm run test:run
  env:
    DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
    JWT_SECRET: test-secret
```

## 🐛 Troubleshooting

### "Cannot connect to database"

- Ensure PostgreSQL is running
- Check DATABASE_URL in `.env.test`
- Verify test database exists

### "Migrations not applied"

Run migrations on test database first.

### "Tests hang or timeout"

- Check for missing `await` on async operations
- Ensure database connections are closed properly
- Verify test database isn't locked

### "Rate limit errors"

Tests include rate limiting checks. If you see false positives:
- Increase timeout in failing tests
- Check rate limit configuration in test setup

## 📝 Writing New Tests

### 1. Unit Test Example

```typescript
// tests/unit/lib/myfunction.test.ts
import { describe, it, expect } from 'vitest';
import { myFunction } from '@/lib/myfunction';

describe('myFunction', () => {
  it('does what it should', () => {
    expect(myFunction('input')).toBe('expected');
  });
});
```

### 2. Integration Test Example

```typescript
// tests/integration/myroute.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '@/app.js';
import { createUser } from '../helpers/factories.js';
import { generateToken, authHeader } from '../helpers/auth.js';

describe('POST /api/myroute', () => {
  it('works correctly', async () => {
    const user = await createUser();
    const token = generateToken(user.id);

    const res = await request(app)
      .post('/api/myroute')
      .set(authHeader(token))
      .send({ data: 'test' });

    expect(res.status).toBe(200);
  });
});
```

## 🎯 Best Practices

1. **Descriptive test names** - Test names should explain what is being tested
2. **One assertion per test** - Keep tests focused
3. **Use factories** - Don't manually insert data
4. **Test edge cases** - Empty strings, nulls, invalid formats
5. **Test error cases** - Not just happy paths
6. **Clean up** - Trust the global cleanup, don't add extra cleanup
7. **Avoid test interdependence** - Each test should be independent

## 📚 Resources

- [Vitest Documentation](https://vitest.dev/)
- [Supertest GitHub](https://github.com/ladjs/supertest)
- [Faker.js Guide](https://fakerjs.dev/guide/)
