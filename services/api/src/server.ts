import { config } from './config/env.js';
import { pool, testConnection } from './db/pool.js';
import { app } from './app.js';

import { initRoomEventsListener } from './lib/roomEvents.js';
import { startCleanupScheduler } from './lib/cleanup.js';

// Start server
const PORT = config.port;

app.listen(PORT, async () => {
  console.log(`Zorem API server running on port ${PORT}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Frontend URL: ${config.frontendUrl}`);
  console.log(`\n Testing database connection...`);

  await testConnection();

  try {
    await initRoomEventsListener();
  } catch (error) {
    console.error('Failed to start room events listener:', error);
  }

  // Start cleanup scheduler (runs every 60 seconds)
  startCleanupScheduler(60 * 1000);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await pool.end();
  process.exit(0);
});
