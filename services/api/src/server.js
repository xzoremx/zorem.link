import express from 'express';
import { config } from './config/env.js';
import { corsMiddleware } from './middlewares/cors.js';
import { apiLimiter } from './middlewares/rateLimit.js';
import { pool, testConnection } from './db/pool.js';

// Import routes
import authRoutes from './routes/auth.routes.js';
import roomsRoutes from './routes/rooms.routes.js';
import storiesRoutes from './routes/stories.routes.js';
import viewerRoutes from './routes/viewer.routes.js';

const app = express();

// Render (and most PaaS) run behind a proxy and set X-Forwarded-* headers
app.set('trust proxy', 1);

// Middlewares
app.use(corsMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`, {
    origin: req.headers.origin,
    'user-agent': req.headers['user-agent']?.substring(0, 50)
  });
  next();
});

app.use(apiLimiter);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Test database connection with timeout
    const queryPromise = pool.query('SELECT NOW() as time, version() as version');
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database connection timeout')), 5000)
    );
    
    await Promise.race([queryPromise, timeoutPromise]);
    
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({ 
      status: 'error', 
      database: 'disconnected',
      error: error.message,
      hint: 'Check your DATABASE_URL in .env file'
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/stories', storiesRoutes);
app.use('/api/viewer', viewerRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  const statusCode = err.statusCode || 500;
  const message = config.nodeEnv === 'production' 
    ? 'Internal server error' 
    : err.message;

  res.status(statusCode).json({
    error: message,
    ...(config.nodeEnv === 'development' && { stack: err.stack })
  });
});

// Start server
const PORT = config.port;

app.listen(PORT, async () => {
  console.log(`🚀 Zorem API server running on port ${PORT}`);
  console.log(`📝 Environment: ${config.nodeEnv}`);
  console.log(`🌐 Frontend URL: ${config.frontendUrl}`);
  console.log(`\n🔍 Testing database connection...`);
  
  // Test connection on startup
  await testConnection();
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
