/**
 * Database helpers for testing
 * Utilities for managing test database state
 */

import { pool } from '../../src/db/pool.js';

/**
 * Clear all data from the database
 * Useful for resetting state between test suites
 */
export async function clearDatabase() {
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
}

/**
 * Get count of records in a table
 */
export async function getTableCount(tableName: string): Promise<number> {
  const result = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
  return parseInt(result.rows[0].count, 10);
}

/**
 * Check if a record exists
 */
export async function recordExists(
  tableName: string,
  column: string,
  value: string | number
): Promise<boolean> {
  const result = await pool.query(
    `SELECT EXISTS(SELECT 1 FROM ${tableName} WHERE ${column} = $1) as exists`,
    [value]
  );
  return result.rows[0].exists;
}

/**
 * Get a single record by ID
 */
export async function getRecordById(
  tableName: string,
  id: string
): Promise<Record<string, unknown> | null> {
  const result = await pool.query(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

/**
 * Execute raw SQL query (use with caution)
 */
export async function query(sql: string, params: unknown[] = []): Promise<unknown[]> {
  const result = await pool.query(sql, params);
  return result.rows;
}
