import pg from 'pg';
import { config } from '../config/env.js';

const { Pool } = pg;

// Create PostgreSQL connection pool
export const pool = new Pool({
  connectionString: config.databaseUrl,
  // SSL configuration - más flexible para desarrollo y producción
  ssl: config.nodeEnv === 'production' 
    ? { rejectUnauthorized: false } 
    : config.databaseUrl?.includes('render.com') || config.databaseUrl?.includes('amazonaws.com')
      ? { rejectUnauthorized: false }
      : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Aumentado a 10 segundos para dar más tiempo
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// Test connection on startup
pool.on('connect', (client) => {
  console.log('✅ New PostgreSQL client connected');
});

pool.on('error', (err, client) => {
  console.error('❌ Unexpected error on idle PostgreSQL client', err);
  // No hacer exit inmediato, solo loggear - el pool se recuperará
});

// Función para probar la conexión
export async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Database connection test successful:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    console.error('   Connection string:', config.databaseUrl?.replace(/:[^:@]+@/, ':****@')); // Ocultar password
    return false;
  }
}

// Helper function to execute queries
export const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (config.nodeEnv === 'development') {
      console.log('Executed query', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('Query error', { text, error: error.message });
    throw error;
  }
};
