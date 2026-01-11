/**
 * Global test setup
 * Runs before all tests - handles DB connection and cleanup
 */

import { beforeAll, afterAll, beforeEach } from 'vitest';
import { pool } from '../src/db/pool.js';

beforeAll(async () => {
  // Verify connection to test database
  try {
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
