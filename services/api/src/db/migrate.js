/**
 * Script de migración de base de datos
 * Ejecuta todas las migraciones en orden
 * 
 * Uso:
 *   node src/db/migrate.js
 *   npm run migrate
 */

import { pool } from './pool.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const migrations = [
  '001_init.sql',
  '002_viewer_sessions.sql',
  '003_stories_views.sql',
  '004_auth_enhancements.sql'
];

async function runMigrations() {
  console.log('🚀 Starting database migrations...\n');

  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful\n');

    for (const migration of migrations) {
      try {
        console.log(`📄 Running migration: ${migration}...`);
        const sql = readFileSync(join(__dirname, 'migrations', migration), 'utf8');
        await pool.query(sql);
        console.log(`✅ Migration ${migration} completed\n`);
      } catch (error) {
        if (error.code === '42P07' || error.message.includes('already exists')) {
          // Table/object already exists, skip
          console.log(`⏭️  Migration ${migration} already applied (skipping)\n`);
        } else {
          console.error(`❌ Error in migration ${migration}:`, error.message);
          throw error;
        }
      }
    }
    
    console.log('✅ All migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();

