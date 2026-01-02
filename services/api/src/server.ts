import express, { type Request, type Response, type NextFunction } from 'express';
import { config } from './config/env.js';
import { corsMiddleware } from './middlewares/cors.js';
import { apiLimiter } from './middlewares/rateLimit.js';
import { pool, testConnection } from './db/pool.js';

// Import routes
import authRoutes from './routes/auth.routes.js';
import roomsRoutes from './routes/rooms.routes.js';
import storiesRoutes from './routes/stories.routes.js';
import viewerRoutes from './routes/viewer.routes.js';
import { initRoomEventsListener } from './lib/roomEvents.js';
import type { HttpError } from './types/index.js';

const app = express();

// Render (and most PaaS) run behind a proxy
app.set('trust proxy', 1);

// Middlewares
app.use(corsMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`, {
    origin: req.headers.origin,
    'user-agent': req.headers['user-agent']?.substring(0, 50),
  });
  next();
});

app.use(apiLimiter);

// Health check endpoint
app.get('/health', async (_req: Request, res: Response) => {
  try {
    const queryPromise = pool.query('SELECT NOW() as time, version() as version');
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Database connection timeout')), 5000)
    );

    await Promise.race([queryPromise, timeoutPromise]);

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch (error) {
    const err = error as Error;
    console.error('Health check error:', err);
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      error: err.message,
      hint: 'Check your DATABASE_URL in .env file',
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/stories', storiesRoutes);
app.use('/api/viewer', viewerRoutes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: HttpError | Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);

  const statusCode = 'statusCode' in err ? err.statusCode : 500;
  const message =
    config.nodeEnv === 'production' ? 'Internal server error' : err.message;

  res.status(statusCode).json({
    error: message,
    ...(config.nodeEnv === 'development' && { stack: err.stack }),
  });
});

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
