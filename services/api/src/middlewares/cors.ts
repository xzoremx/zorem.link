import cors from 'cors';
import { config } from '../config/env.js';

function buildAllowedOrigins(): Set<string> {
  const allowed = new Set<string>([
    'http://localhost:8080',
    'http://localhost:3000',
  ]);

  const addOrigin = (origin: string | undefined): void => {
    if (!origin) return;

    try {
      const url = new URL(origin);
      const host = url.hostname.startsWith('www.')
        ? url.hostname.slice(4)
        : url.hostname;
      allowed.add(`${url.protocol}//${host}`);
      allowed.add(`${url.protocol}//www.${host}`);
    } catch {
      allowed.add(origin);
    }
  };

  addOrigin(config.corsOrigin);
  addOrigin(config.frontendUrl);

  return allowed;
}

const allowedOrigins = buildAllowedOrigins();

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.has(origin) || config.nodeEnv === 'development') {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-viewer-hash'],
});
