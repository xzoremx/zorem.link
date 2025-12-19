import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { query } from '../db/pool.js';

/**
 * Middleware to verify JWT token for authenticated creators
 */
export async function verifyAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      
      // Verify user still exists in database
      const result = await query('SELECT id, email FROM users WHERE id = $1', [decoded.userId]);
      
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'User not found' });
      }

      // Attach user info to request
      req.user = {
        id: result.rows[0].id,
        email: result.rows[0].email,
      };

      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
      }
      throw error;
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
}

/**
 * Generate JWT token for authenticated user
 * @param {string} userId - User ID
 * @returns {string} JWT token
 */
export function generateToken(userId) {
  return jwt.sign(
    { userId },
    config.jwtSecret,
    { expiresIn: config.magicLinkExpiry }
  );
}

/**
 * Verify magic link token (used in GET endpoint)
 * @param {string} token - Magic link token
 * @returns {Promise<{userId: string, email: string} | null>}
 */
export async function verifyMagicLinkToken(token) {
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    
    // Verify user exists
    const result = await query('SELECT id, email FROM users WHERE id = $1', [decoded.userId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return {
      userId: result.rows[0].id,
      email: result.rows[0].email,
    };
  } catch (error) {
    return null;
  }
}
