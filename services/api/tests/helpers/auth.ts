/**
 * Auth helpers for testing
 * Generate JWT tokens and authenticate test requests
 */

import jwt from 'jsonwebtoken';
import { config } from '../../src/config/env.js';

interface TokenPayload {
  userId: string;
  email?: string;
}

/**
 * Generate a JWT token for testing
 * @param userId - User ID to encode in token
 * @param expiresIn - Token expiration (default: 1h)
 */
export function generateToken(userId: string, expiresIn = '1h'): string {
  const payload: TokenPayload = { userId };
  return jwt.sign(payload, config.jwtSecret, { expiresIn });
}

/**
 * Generate an expired JWT token for testing
 */
export function generateExpiredToken(userId: string): string {
  const payload: TokenPayload = { userId };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '0s' });
}

/**
 * Generate a JWT token with custom payload (for testing edge cases)
 */
export function generateCustomToken(payload: Record<string, unknown>, expiresIn = '1h'): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn });
}

/**
 * Generate a temporary 2FA token
 */
export function generate2FAToken(userId: string): string {
  const payload = { userId, type: '2fa_pending' };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '5m' });
}

/**
 * Create auth header for supertest requests
 */
export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

/**
 * Create viewer hash header for supertest requests
 */
export function viewerHashHeader(viewerHash: string): { 'x-viewer-hash': string } {
  return { 'x-viewer-hash': viewerHash };
}
