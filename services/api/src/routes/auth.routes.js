import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool.js';
import { generateToken, verifyMagicLinkToken } from '../middlewares/auth.js';
import { magicLinkLimiter } from '../middlewares/rateLimit.js';
import { verifyAuth } from '../middlewares/auth.js';
import { config } from '../config/env.js';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

const router = express.Router();

/**
 * POST /api/auth/request-magic-link
 * Solicitar magic link por email
 */
router.post('/request-magic-link', magicLinkLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    // Validar email
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ 
        error: 'Valid email is required' 
      });
    }

    // Validar formato de email básico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Invalid email format' 
      });
    }

    const emailLower = email.toLowerCase().trim();

    // Buscar o crear usuario
    let userResult = await query(
      'SELECT id, email FROM users WHERE email = $1',
      [emailLower]
    );

    let userId;

    if (userResult.rows.length === 0) {
      // Crear nuevo usuario
      const newUserResult = await query(
        'INSERT INTO users (email) VALUES ($1) RETURNING id, email',
        [emailLower]
      );
      userId = newUserResult.rows[0].id;
    } else {
      userId = userResult.rows[0].id;
    }

    // Generar token JWT
    const token = generateToken(userId);

    // Generar magic link
    const magicLink = `${config.frontendUrl}/auth/verify?token=${token}`;

    // En un entorno real, aquí enviarías el email
    // Por ahora, en desarrollo, devolvemos el link directamente
    // ⚠️ EN PRODUCCIÓN: Enviar email, NO devolver el link en la respuesta

    if (config.nodeEnv === 'development') {
      // Solo en desarrollo: devolver el link
      res.json({
        message: 'Magic link generated (development mode)',
        magic_link: magicLink,
        token: token, // Solo en desarrollo
        warning: 'In production, the link will be sent via email only'
      });
    } else {
      // En producción: simular envío de email
      // TODO: Integrar servicio de email (SendGrid, AWS SES, etc.)
      console.log(`[PRODUCTION] Magic link for ${emailLower}: ${magicLink}`);
      
      res.json({
        message: 'If an account exists with this email, a magic link has been sent'
      });
    }

  } catch (error) {
    console.error('Error requesting magic link:', error);
    res.status(500).json({ 
      error: 'Failed to request magic link' 
    });
  }
});

/**
 * GET /api/auth/verify-magic-link
 * Verificar token de magic link y crear sesión
 */
router.get('/verify-magic-link', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ 
        error: 'Token is required' 
      });
    }

    // Verificar token
    const user = await verifyMagicLinkToken(token);

    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid or expired token' 
      });
    }

    // Generar nuevo token JWT para la sesión
    const sessionToken = generateToken(user.userId);

    // En un entorno real, aquí redirigirías al frontend con el token
    // Por ahora devolvemos el token en la respuesta

    res.json({
      message: 'Magic link verified successfully',
      token: sessionToken,
      user: {
        id: user.userId,
        email: user.email
      },
      // En producción, redirigir al frontend:
      // redirect_url: `${config.frontendUrl}/dashboard?token=${sessionToken}`
    });

  } catch (error) {
    console.error('Error verifying magic link:', error);
    res.status(500).json({ 
      error: 'Failed to verify magic link' 
    });
  }
});

/**
 * GET /api/auth/me
 * Obtener información del usuario autenticado
 */
router.get('/me', verifyAuth, async (req, res) => {
  try {
    // req.user ya está disponible gracias a verifyAuth middleware
    const userResult = await query(
      'SELECT id, email, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }

    const user = userResult.rows[0];

    // Contar salas del usuario
    const roomsCount = await query(
      'SELECT COUNT(*) as count FROM rooms WHERE owner_id = $1',
      [user.id]
    );

    res.json({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      rooms_count: parseInt(roomsCount.rows[0].count) || 0
    });

  } catch (error) {
    console.error('Error getting user info:', error);
    res.status(500).json({ 
      error: 'Failed to get user info' 
    });
  }
});

/**
 * POST /api/auth/sign-up
 * Register new user with email and password
 */
router.post('/sign-up', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }

    if (password.length < 8) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters' 
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Invalid email format' 
      });
    }

    const emailLower = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [emailLower]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ 
        error: 'User with this email already exists' 
      });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Generate email verification token
    const verificationToken = jwt.sign(
      { email: emailLower, type: 'email_verification' },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    // Create user
    const newUser = await query(
      `INSERT INTO users (email, password_hash, email_verification_token, email_verification_expires)
       VALUES ($1, $2, $3, NOW() + INTERVAL '24 hours')
       RETURNING id, email, created_at`,
      [emailLower, passwordHash, verificationToken]
    );

    const user = newUser.rows[0];

    // Generate verification link
    const verificationLink = `${config.frontendUrl}/auth.html?verify=${verificationToken}`;

    // In development, return token and verification link
    if (config.nodeEnv === 'development') {
      res.status(201).json({
        message: 'Account created successfully',
        requires_verification: true,
        verification_link: verificationLink,
        // In development, also return session token for convenience
        token: generateToken(user.id),
        user: {
          id: user.id,
          email: user.email
        }
      });
    } else {
      // In production, require email verification
      // TODO: Send verification email with verificationLink
      console.log(`[PRODUCTION] Email verification link for ${emailLower}: ${verificationLink}`);
      res.status(201).json({
        message: 'Account created. Please check your email to verify your account.',
        requires_verification: true
      });
    }

  } catch (error) {
    console.error('Error signing up:', error);
    res.status(500).json({ 
      error: 'Failed to create account' 
    });
  }
});

/**
 * POST /api/auth/sign-in
 * Sign in with email and password
 */
router.post('/sign-in', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }

    const emailLower = email.toLowerCase().trim();

    // Find user
    const userResult = await query(
      'SELECT id, email, password_hash, two_factor_enabled FROM users WHERE email = $1',
      [emailLower]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Invalid email or password' 
      });
    }

    const user = userResult.rows[0];

    // Check if user has password (not OAuth-only user)
    if (!user.password_hash) {
      return res.status(401).json({ 
        error: 'Please sign in with Google or use magic link' 
      });
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ 
        error: 'Invalid email or password' 
      });
    }

    // Check if 2FA is enabled
    if (user.two_factor_enabled) {
      // Generate temporary token for 2FA verification
      const tempToken = jwt.sign(
        { userId: user.id, type: '2fa_temp' },
        config.jwtSecret,
        { expiresIn: '5m' }
      );

      return res.json({
        requires_2fa: true,
        temp_token: tempToken
      });
    }

    // Generate session token
    const token = generateToken(user.id);

    res.json({
      token: token,
      user: {
        id: user.id,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Error signing in:', error);
    res.status(500).json({ 
      error: 'Failed to sign in' 
    });
  }
});

/**
 * POST /api/auth/verify-2fa
 * Verify 2FA code
 */
router.post('/verify-2fa', async (req, res) => {
  try {
    const { temp_token, code } = req.body;

    if (!temp_token || !code) {
      return res.status(400).json({ 
        error: 'temp_token and code are required' 
      });
    }

    // Verify temp token
    let decoded;
    try {
      decoded = jwt.verify(temp_token, config.jwtSecret);
      if (decoded.type !== '2fa_temp') {
        return res.status(401).json({ 
          error: 'Invalid token type' 
        });
      }
    } catch (error) {
      return res.status(401).json({ 
        error: 'Invalid or expired token' 
      });
    }

    // Get user and 2FA secret
    const userResult = await query(
      'SELECT id, email, two_factor_secret FROM users WHERE id = $1 AND two_factor_enabled = true',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'User not found or 2FA not enabled' 
      });
    }

    const user = userResult.rows[0];

    // Verify 2FA code
    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token: code,
      window: 2 // Allow 2 time steps of tolerance
    });

    if (!verified) {
      return res.status(401).json({ 
        error: 'Invalid 2FA code' 
      });
    }

    // Generate session token
    const token = generateToken(user.id);

    res.json({
      token: token,
      user: {
        id: user.id,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Error verifying 2FA:', error);
    res.status(500).json({ 
      error: 'Failed to verify 2FA' 
    });
  }
});

/**
 * GET /api/auth/google/url
 * Get Google OAuth URL
 */
router.get('/google/url', async (req, res) => {
  try {
    // For now, return a placeholder URL
    // In production, implement proper Google OAuth flow
    const clientId = config.googleClientId || 'YOUR_GOOGLE_CLIENT_ID';
    const redirectUri = `${config.frontendUrl}/auth.html`;
    const scope = 'openid email profile';
    const state = jwt.sign({ type: 'oauth_state' }, config.jwtSecret, { expiresIn: '10m' });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(scope)}&` +
      `state=${state}`;

    res.json({
      auth_url: authUrl
    });

  } catch (error) {
    console.error('Error generating Google OAuth URL:', error);
    res.status(500).json({ 
      error: 'Failed to generate OAuth URL' 
    });
  }
});

/**
 * GET /api/auth/google/callback
 * Handle Google OAuth callback
 */
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state, token } = req.query;

    // For now, in development, accept token directly
    if (token && config.nodeEnv === 'development') {
      try {
        const decoded = jwt.verify(token, config.jwtSecret);
        if (decoded.type === 'oauth_user') {
          const userResult = await query(
            'SELECT id, email FROM users WHERE id = $1',
            [decoded.userId]
          );

          if (userResult.rows.length > 0) {
            const sessionToken = generateToken(userResult.rows[0].id);
            return res.redirect(`${config.frontendUrl}/auth.html?oauth_token=${sessionToken}`);
          }
        }
      } catch (error) {
        // Invalid token
      }
    }

    // In production, exchange code for token with Google
    // TODO: Implement full OAuth flow
    res.status(501).json({ 
      error: 'Google OAuth not fully implemented yet' 
    });

  } catch (error) {
    console.error('Error handling Google OAuth callback:', error);
    res.status(500).json({ 
      error: 'Failed to complete OAuth sign in' 
    });
  }
});

/**
 * GET /api/auth/verify-email
 * Verify email with token
 */
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ 
        error: 'Verification token is required' 
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
      if (decoded.type !== 'email_verification') {
        return res.status(401).json({ 
          error: 'Invalid token type' 
        });
      }
    } catch (error) {
      return res.status(401).json({ 
        error: 'Invalid or expired verification token' 
      });
    }

    // Update user email_verified status
    const result = await query(
      `UPDATE users 
       SET email_verified = true, 
           email_verification_token = NULL,
           email_verification_expires = NULL
       WHERE email = $1 AND email_verification_token = $2
       RETURNING id, email`,
      [decoded.email, token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Verification token not found or already used' 
      });
    }

    // Generate session token
    const sessionToken = generateToken(result.rows[0].id);

    res.json({
      message: 'Email verified successfully',
      token: sessionToken,
      user: {
        id: result.rows[0].id,
        email: result.rows[0].email
      }
    });

  } catch (error) {
    console.error('Error verifying email:', error);
    res.status(500).json({ 
      error: 'Failed to verify email' 
    });
  }
});

/**
 * POST /api/auth/2fa/setup
 * Generate 2FA secret and QR code
 */
router.post('/2fa/setup', verifyAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if 2FA is already enabled
    const userResult = await query(
      'SELECT two_factor_enabled FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }

    if (userResult.rows[0].two_factor_enabled) {
      return res.status(400).json({ 
        error: '2FA is already enabled' 
      });
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `Zorem (${req.user.email})`,
      issuer: 'Zorem'
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    // Store secret temporarily (user needs to verify before enabling)
    await query(
      'UPDATE users SET two_factor_secret = $1 WHERE id = $2',
      [secret.base32, userId]
    );

    res.json({
      secret: secret.base32,
      qr_code: qrCodeUrl,
      manual_entry_key: secret.base32
    });

  } catch (error) {
    console.error('Error setting up 2FA:', error);
    res.status(500).json({ 
      error: 'Failed to setup 2FA' 
    });
  }
});

/**
 * POST /api/auth/2fa/enable
 * Enable 2FA after verifying code
 */
router.post('/2fa/enable', verifyAuth, async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user.id;

    if (!code) {
      return res.status(400).json({ 
        error: 'Verification code is required' 
      });
    }

    // Get user's 2FA secret
    const userResult = await query(
      'SELECT two_factor_secret FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].two_factor_secret) {
      return res.status(400).json({ 
        error: '2FA not set up. Please run /2fa/setup first' 
      });
    }

    const secret = userResult.rows[0].two_factor_secret;

    // Verify code
    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: code,
      window: 2
    });

    if (!verified) {
      return res.status(401).json({ 
        error: 'Invalid verification code' 
      });
    }

    // Enable 2FA
    await query(
      'UPDATE users SET two_factor_enabled = true WHERE id = $1',
      [userId]
    );

    res.json({
      message: '2FA enabled successfully'
    });

  } catch (error) {
    console.error('Error enabling 2FA:', error);
    res.status(500).json({ 
      error: 'Failed to enable 2FA' 
    });
  }
});

/**
 * POST /api/auth/2fa/disable
 * Disable 2FA
 */
router.post('/2fa/disable', verifyAuth, async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user.id;

    // Get user's 2FA secret
    const userResult = await query(
      'SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].two_factor_enabled) {
      return res.status(400).json({ 
        error: '2FA is not enabled' 
      });
    }

    // Verify code before disabling
    if (code) {
      const secret = userResult.rows[0].two_factor_secret;
      const verified = speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: code,
        window: 2
      });

      if (!verified) {
        return res.status(401).json({ 
          error: 'Invalid verification code' 
        });
      }
    }

    // Disable 2FA
    await query(
      'UPDATE users SET two_factor_enabled = false, two_factor_secret = NULL WHERE id = $1',
      [userId]
    );

    res.json({
      message: '2FA disabled successfully'
    });

  } catch (error) {
    console.error('Error disabling 2FA:', error);
    res.status(500).json({ 
      error: 'Failed to disable 2FA' 
    });
  }
});

export default router;
