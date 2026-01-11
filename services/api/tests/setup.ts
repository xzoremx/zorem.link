/**
 * Global test setup
 * Runs before all tests - handles DB connection and cleanup
 */

import { beforeAll, afterAll, beforeEach } from 'vitest';
import type { Pool } from 'pg';

let pool: Pool;

function getDatabaseName(databaseUrl: string): string | null {
  try {
    const url = new URL(databaseUrl);
    const dbName = url.pathname.replace(/^\/+/, '');
    return dbName || null;
  } catch {
    return null;
  }
}

function assertSafeTestDatabase(databaseUrl: string): void {
  const databaseName = getDatabaseName(databaseUrl);
  if (!databaseName) {
    throw new Error('Refusing to run tests: unable to parse database name from DATABASE_URL.');
  }

  if (!/test/i.test(databaseName)) {
    throw new Error(
      `Refusing to run tests against non-test database "${databaseName}". ` +
        'Set DATABASE_URL to a dedicated test database (e.g. zorem_test).'
    );
  }
}

beforeAll(async () => {
  // Ensure the service treats tests as non-production
  process.env.NODE_ENV ||= 'test';

  const db = await import('../src/db/pool.js');
  pool = db.pool as Pool;

  // Verify connection to test database
  try {
    assertSafeTestDatabase(process.env.DATABASE_URL ?? '');
    await pool.query('SELECT 1');
    console.log('✓ Test database connected');
  } catch (error) {
    console.error('✗ Failed to connect to test database:', error);
    throw error;
  }
});

beforeEach(async () => {
  // Clean all tables between tests to ensure isolation
  // Order matters due to foreign key constraints
  await pool.query(`
    TRUNCATE
      story_likes,
      views,
      stories,
      viewer_sessions,
      rooms,
      users,
      cleanup_locks,
      emoji_stats
    RESTART IDENTITY CASCADE
  `);
});

afterAll(async () => {
  // Close database connection pool
  await pool.end();
});
