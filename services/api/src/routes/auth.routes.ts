import express, { type Request, type Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { query } from '../db/pool.js';
import { generateToken, verifyMagicLinkToken, verifyAuth } from '../middlewares/auth.js';
import { magicLinkLimiter, strictLimiter } from '../middlewares/rateLimit.js';
import { config } from '../config/env.js';
import { sendEmail } from '../lib/email.js';
import type { JWTPayload } from '../types/index.js';

const router = express.Router();

interface UserRow {
  id: string;
  email: string;
  password_hash: string | null;
  email_verified: boolean;
  two_factor_enabled: boolean;
  two_factor_secret: string | null;
  google_id: string | null;
  created_at: Date;
}

interface LinkEmailOptions {
  title: string;
  intro: string;
  ctaText: string;
  ctaUrl: string;
}

function renderLinkEmail({ title, intro, ctaText, ctaUrl }: LinkEmailOptions): string {
  const safeUrl = String(ctaUrl);

  return `
    <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2 style="margin:0 0 12px;color:#111">${title}</h2>
      <p style="margin:0 0 16px;color:#444;line-height:1.5">${intro}</p>
      <p style="margin:0 0 20px">
        <a href="${safeUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 16px;border-radius:10px">${ctaText}</a>
      </p>
      <p style="margin:0 0 8px;color:#666;font-size:12px">If the button doesn't work, copy and paste this link:</p>
      <p style="margin:0;color:#111;font-size:12px;word-break:break-all">${safeUrl}</p>
    </div>
  `;
}

/**
 * POST /api/auth/request-magic-link
 */
router.post(
  '/request-magic-link',
  magicLinkLimiter,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email } = req.body as { email?: string };

      if (!email || typeof email !== 'string') {
        res.status(400).json({ error: 'Valid email is required' });
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({ error: 'Invalid email format' });
        return;
      }

      const emailLower = email.toLowerCase().trim();

      let userResult = await query<UserRow>(
        'SELECT id, email FROM users WHERE email = $1',
        [emailLower]
      );

      let userId: string;

      if (userResult.rows.length === 0) {
        const newUserResult = await query<UserRow>(
          'INSERT INTO users (email) VALUES ($1) RETURNING id, email',
          [emailLower]
        );
        const newUser = newUserResult.rows[0];
        if (!newUser) {
          res.status(500).json({ error: 'Failed to create user' });
          return;
        }
        userId = newUser.id;
      } else {
        const existingUser = userResult.rows[0];
        if (!existingUser) {
          res.status(500).json({ error: 'Failed to find user' });
          return;
        }
        userId = existingUser.id;
      }

      const token = generateToken(userId);
      const magicLink = `${config.frontendUrl}/auth?token=${token}`;

      if (config.nodeEnv !== 'production') {
        res.json({
          message: 'Magic link generated (development mode)',
          magic_link: magicLink,
          token,
          warning: 'In production, the link will be sent via email only',
        });
      } else {
        try {
          await sendEmail({
            to: emailLower,
            subject: 'Your Zorem sign-in link',
            html: renderLinkEmail({
              title: 'Sign in to Zorem',
              intro: 'Use this link to sign in. This link expires soon for your security.',
              ctaText: 'Sign in',
              ctaUrl: magicLink,
            }),
            text: `Sign in to Zorem: ${magicLink}`,
          });
        } catch (emailError) {
          console.error('Failed to send magic link email:', emailError);
          res.status(500).json({ error: 'Failed to send magic link email' });
          return;
        }

        res.json({
          message: 'If an account exists with this email, a magic link has been sent',
        });
      }
    } catch (error) {
      console.error('Error requesting magic link:', error);
      res.status(500).json({ error: 'Failed to request magic link' });
    }
  }
);

/**
 * GET /api/auth/verify-magic-link
 */
router.get('/verify-magic-link', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.query as { token?: string };

    if (!token) {
      res.status(400).json({ error: 'Token is required' });
      return;
    }

    const user = await verifyMagicLinkToken(token);

    if (!user) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    await query('UPDATE users SET email_verified = true WHERE id = $1', [user.id]);

    const sessionToken = generateToken(user.id);

    res.json({
      message: 'Magic link verified successfully',
      token: sessionToken,
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    console.error('Error verifying magic link:', error);
    res.status(500).json({ error: 'Failed to verify magic link' });
  }
});

/**
 * GET /api/auth/me
 */
router.get(
  '/me',
  verifyAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;

      const userResult = await query<UserRow>(
        'SELECT id, email, created_at FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const user = userResult.rows[0];
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const roomsCount = await query<{ count: string }>(
        'SELECT COUNT(*) as count FROM rooms WHERE owner_id = $1',
        [user.id]
      );

      res.json({
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        rooms_count: parseInt(roomsCount.rows[0]?.count ?? '0') || 0,
      });
    } catch (error) {
      console.error('Error getting user info:', error);
      res.status(500).json({ error: 'Failed to get user info' });
    }
  }
);

/**
 * POST /api/auth/sign-up
 */
router.post('/sign-up', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'Invalid email format' });
      return;
    }

    const emailLower = email.toLowerCase().trim();

    const existingUser = await query<{ id: string }>(
      'SELECT id FROM users WHERE email = $1',
      [emailLower]
    );

    if (existingUser.rows.length > 0) {
      res.status(409).json({ error: 'User with this email already exists' });
      return;
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const verificationToken = jwt.sign(
      { email: emailLower, type: 'email_verification' },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    const newUser = await query<UserRow>(
      `INSERT INTO users (email, password_hash, email_verification_token, email_verification_expires)
       VALUES ($1, $2, $3, NOW() + INTERVAL '24 hours')
       RETURNING id, email, created_at`,
      [emailLower, passwordHash, verificationToken]
    );

    const user = newUser.rows[0];
    if (!user) {
      res.status(500).json({ error: 'Failed to create user' });
      return;
    }

    const verificationLink = `${config.frontendUrl}/auth?verify=${verificationToken}`;

    if (config.nodeEnv !== 'production') {
      res.status(201).json({
        message: 'Account created successfully',
        requires_verification: true,
        verification_link: verificationLink,
        token: generateToken(user.id),
        user: { id: user.id, email: user.email },
      });
    } else {
      try {
        await sendEmail({
          to: emailLower,
          subject: 'Verify your email for Zorem',
          html: renderLinkEmail({
            title: 'Verify your email',
            intro: 'Thanks for signing up! Please verify your email to activate your account.',
            ctaText: 'Verify email',
            ctaUrl: verificationLink,
          }),
          text: `Verify your email: ${verificationLink}`,
        });
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        res.status(500).json({ error: 'Failed to send verification email' });
        return;
      }

      res.status(201).json({
        message: 'Account created. Please check your email to verify your account.',
        requires_verification: true,
      });
    }
  } catch (error) {
    console.error('Error signing up:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

/**
 * POST /api/auth/sign-in
 */
router.post('/sign-in', strictLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const emailLower = email.toLowerCase().trim();

    const userResult = await query<UserRow>(
      'SELECT id, email, password_hash, email_verified, two_factor_enabled FROM users WHERE email = $1',
      [emailLower]
    );

    if (userResult.rows.length === 0) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const user = userResult.rows[0];
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    if (!user.password_hash) {
      res.status(401).json({ error: 'Please sign in with Google or use magic link' });
      return;
    }

    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    if (config.nodeEnv === 'production' && user.email_verified !== true) {
      res.status(403).json({
        error: 'Please verify your email before signing in',
        requires_verification: true,
      });
      return;
    }

    if (user.two_factor_enabled) {
      const tempToken = jwt.sign(
        { userId: user.id, type: '2fa_temp' },
        config.jwtSecret,
        { expiresIn: '5m' }
      );

      res.json({ requires_2fa: true, temp_token: tempToken });
      return;
    }

    const token = generateToken(user.id);

    res.json({
      token,
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    console.error('Error signing in:', error);
    res.status(500).json({ error: 'Failed to sign in' });
  }
});

/**
 * POST /api/auth/verify-2fa
 */
router.post('/verify-2fa', strictLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { temp_token, code } = req.body as { temp_token?: string; code?: string };

    if (!temp_token || !code) {
      res.status(400).json({ error: 'temp_token and code are required' });
      return;
    }

    let decoded: JWTPayload;
    try {
      decoded = jwt.verify(temp_token, config.jwtSecret) as JWTPayload;
      if (decoded.type !== '2fa_temp') {
        res.status(401).json({ error: 'Invalid token type' });
        return;
      }
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    const userResult = await query<UserRow>(
      'SELECT id, email, two_factor_secret FROM users WHERE id = $1 AND two_factor_enabled = true',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found or 2FA not enabled' });
      return;
    }

    const user = userResult.rows[0];
    if (!user || !user.two_factor_secret) {
      res.status(404).json({ error: 'User not found or 2FA not enabled' });
      return;
    }

    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token: code,
      window: 2,
    });

    if (!verified) {
      res.status(401).json({ error: 'Invalid 2FA code' });
      return;
    }

    const token = generateToken(user.id);

    res.json({
      token,
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    console.error('Error verifying 2FA:', error);
    res.status(500).json({ error: 'Failed to verify 2FA' });
  }
});

/**
 * GET /api/auth/google/url
 */
router.get('/google/url', async (_req: Request, res: Response): Promise<void> => {
  try {
    if (!config.googleClientId || !config.googleRedirectUri) {
      res.status(501).json({ error: 'Google OAuth is not configured' });
      return;
    }

    const scope = 'openid email profile';
    const state = jwt.sign({ type: 'oauth_state' }, config.jwtSecret, { expiresIn: '10m' });

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', config.googleClientId);
    authUrl.searchParams.set('redirect_uri', config.googleRedirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scope);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('prompt', 'select_account');

    res.json({ auth_url: authUrl.toString() });
  } catch (error) {
    console.error('Error generating Google OAuth URL:', error);
    res.status(500).json({ error: 'Failed to generate OAuth URL' });
  }
});

/**
 * GET /api/auth/google/callback
 */
router.get('/google/callback', async (req: Request, res: Response): Promise<void> => {
  const redirectWithError = (code: string): void => {
    const url = new URL(`${config.frontendUrl}/auth`);
    url.searchParams.set('oauth_error', code);
    res.redirect(url.toString());
  };

  try {
    const { code, state, error } = req.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    if (error) {
      redirectWithError(String(error));
      return;
    }

    if (!code || !state) {
      redirectWithError('missing_params');
      return;
    }

    if (!config.googleClientId || !config.googleClientSecret || !config.googleRedirectUri) {
      redirectWithError('oauth_not_configured');
      return;
    }

    try {
      const decoded = jwt.verify(String(state), config.jwtSecret) as JWTPayload;
      if (decoded.type !== 'oauth_state') {
        redirectWithError('invalid_state');
        return;
      }
    } catch {
      redirectWithError('invalid_state');
      return;
    }

    const tokenParams = new URLSearchParams({
      code: String(code),
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: config.googleRedirectUri,
      grant_type: 'authorization_code',
    });

    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    });

    if (!tokenResp.ok) {
      const text = await tokenResp.text();
      console.error('Google token exchange failed:', tokenResp.status, text);
      redirectWithError('token_exchange_failed');
      return;
    }

    const tokenData = (await tokenResp.json()) as { access_token?: string };
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      redirectWithError('missing_access_token');
      return;
    }

    const userInfoResp = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userInfoResp.ok) {
      const text = await userInfoResp.text();
      console.error('Google userinfo failed:', userInfoResp.status, text);
      redirectWithError('userinfo_failed');
      return;
    }

    const userInfo = (await userInfoResp.json()) as { sub?: string; email?: string };
    const googleId = userInfo.sub;
    const email = userInfo.email;

    if (!googleId || !email) {
      redirectWithError('missing_user_info');
      return;
    }

    const emailLower = String(email).toLowerCase().trim();

    let userResult = await query<UserRow>(
      'SELECT id, email, google_id FROM users WHERE google_id = $1',
      [googleId]
    );

    if (userResult.rows.length === 0) {
      const byEmail = await query<UserRow>(
        'SELECT id, email, google_id FROM users WHERE email = $1',
        [emailLower]
      );

      if (byEmail.rows.length === 0) {
        userResult = await query<UserRow>(
          `INSERT INTO users (email, google_id, email_verified)
           VALUES ($1, $2, true)
           RETURNING id, email, google_id`,
          [emailLower, googleId]
        );
      } else {
        const existing = byEmail.rows[0];

        if (existing?.google_id && existing.google_id !== googleId) {
          redirectWithError('email_already_linked');
          return;
        }

        userResult = await query<UserRow>(
          `UPDATE users
           SET google_id = $1, email_verified = true
           WHERE id = $2
           RETURNING id, email, google_id`,
          [googleId, existing?.id]
        );
      }
    } else {
      const existingUser = userResult.rows[0];
      await query('UPDATE users SET email_verified = true WHERE id = $1', [existingUser?.id]);
    }

    const user = userResult.rows[0];
    if (!user) {
      redirectWithError('oauth_failed');
      return;
    }

    const sessionToken = generateToken(user.id);

    const redirectUrl = new URL(`${config.frontendUrl}/auth`);
    redirectUrl.searchParams.set('oauth_token', sessionToken);

    res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('Error handling Google OAuth callback:', error);
    redirectWithError('oauth_failed');
  }
});

/**
 * GET /api/auth/verify-email
 */
router.get('/verify-email', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.query as { token?: string };

    if (!token) {
      res.status(400).json({ error: 'Verification token is required' });
      return;
    }

    let decoded: JWTPayload;
    try {
      decoded = jwt.verify(token, config.jwtSecret) as JWTPayload;
      if (decoded.type !== 'email_verification') {
        res.status(401).json({ error: 'Invalid token type' });
        return;
      }
    } catch {
      res.status(401).json({ error: 'Invalid or expired verification token' });
      return;
    }

    const result = await query<UserRow>(
      `UPDATE users 
       SET email_verified = true, 
           email_verification_token = NULL,
           email_verification_expires = NULL
       WHERE email = $1 AND email_verification_token = $2
       RETURNING id, email`,
      [decoded.email, token]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Verification token not found or already used' });
      return;
    }

    const user = result.rows[0];
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const sessionToken = generateToken(user.id);

    res.json({
      message: 'Email verified successfully',
      token: sessionToken,
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    console.error('Error verifying email:', error);
    res.status(500).json({ error: 'Failed to verify email' });
  }
});

/**
 * POST /api/auth/2fa/setup
 */
router.post(
  '/2fa/setup',
  verifyAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const userEmail = req.user?.email;

      const userResult = await query<UserRow>(
        'SELECT two_factor_enabled FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const user = userResult.rows[0];

      if (user?.two_factor_enabled) {
        res.status(400).json({ error: '2FA is already enabled' });
        return;
      }

      const secret = speakeasy.generateSecret({
        name: `Zorem (${userEmail})`,
        issuer: 'Zorem',
      });

      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url ?? '');

      await query('UPDATE users SET two_factor_secret = $1 WHERE id = $2', [
        secret.base32,
        userId,
      ]);

      res.json({
        secret: secret.base32,
        qr_code: qrCodeUrl,
        manual_entry_key: secret.base32,
      });
    } catch (error) {
      console.error('Error setting up 2FA:', error);
      res.status(500).json({ error: 'Failed to setup 2FA' });
    }
  }
);

/**
 * POST /api/auth/2fa/enable
 */
router.post(
  '/2fa/enable',
  verifyAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { code } = req.body as { code?: string };
      const userId = req.user?.id;

      if (!code) {
        res.status(400).json({ error: 'Verification code is required' });
        return;
      }

      const userResult = await query<UserRow>(
        'SELECT two_factor_secret FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0 || !userResult.rows[0]?.two_factor_secret) {
        res.status(400).json({ error: '2FA not set up. Please run /2fa/setup first' });
        return;
      }

      const secret = userResult.rows[0].two_factor_secret;

      const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token: code,
        window: 2,
      });

      if (!verified) {
        res.status(401).json({ error: 'Invalid verification code' });
        return;
      }

      await query('UPDATE users SET two_factor_enabled = true WHERE id = $1', [userId]);

      res.json({ message: '2FA enabled successfully' });
    } catch (error) {
      console.error('Error enabling 2FA:', error);
      res.status(500).json({ error: 'Failed to enable 2FA' });
    }
  }
);

/**
 * POST /api/auth/2fa/disable
 */
router.post(
  '/2fa/disable',
  verifyAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { code } = req.body as { code?: string };
      const userId = req.user?.id;

      if (!code) {
        res.status(400).json({ error: 'Verification code is required to disable 2FA' });
        return;
      }

      const userResult = await query<UserRow>(
        'SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0 || !userResult.rows[0]?.two_factor_enabled) {
        res.status(400).json({ error: '2FA is not enabled' });
        return;
      }

      const secret = userResult.rows[0].two_factor_secret;
      if (!secret) {
        res.status(400).json({ error: '2FA secret not found' });
        return;
      }

      const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token: code,
        window: 2,
      });

      if (!verified) {
        res.status(401).json({ error: 'Invalid verification code' });
        return;
      }

      await query(
        'UPDATE users SET two_factor_enabled = false, two_factor_secret = NULL WHERE id = $1',
        [userId]
      );

      res.json({ message: '2FA disabled successfully' });
    } catch (error) {
      console.error('Error disabling 2FA:', error);
      res.status(500).json({ error: 'Failed to disable 2FA' });
    }
  }
);

export default router;
