import pg from 'pg';
import { config } from '../config/env.js';

const { Pool } = pg;

// Create PostgreSQL connection pool
export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl:
    config.nodeEnv === 'production'
      ? { rejectUnauthorized: false }
      : config.databaseUrl?.includes('render.com') ||
          config.databaseUrl?.includes('amazonaws.com')
        ? { rejectUnauthorized: false }
        : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

pool.on('connect', () => {
  console.log('New PostgreSQL client connected');
});

pool.on('error', (err: Error) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

export async function testConnection(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('Database connection test successful:', result.rows[0]?.now);
    return true;
  } catch (error) {
    const err = error as Error;
    console.error('Database connection test failed:', err.message);
    console.error(
      '   Connection string:',
      config.databaseUrl?.replace(/:[^:@]+@/, ':****@')
    );
    return false;
  }
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    if (config.nodeEnv === 'development') {
      console.log('Executed query', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    const err = error as Error;
    console.error('Query error', { text, error: err.message });
    throw error;
  }
}
