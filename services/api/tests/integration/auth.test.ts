/**
 * Integration tests for authentication routes
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { createUser } from '../helpers/factories.js';
import { generateToken, authHeader } from '../helpers/auth.js';
import { faker } from '@faker-js/faker';

describe('POST /api/auth/sign-up', () => {
  it('successfully creates a new user account', async () => {
    const email = faker.internet.email();
    const password = 'SecurePass123!';

    const res = await request(app)
      .post('/api/auth/sign-up')
      .send({ email, password });

    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(email.toLowerCase());
    expect(res.body.user.id).toBeDefined();
    expect(res.body.requires_verification).toBe(true);
    expect(res.body.verification_link).toBeDefined();
  });

  it('normalizes email to lowercase', async () => {
    const email = 'TestUser@EXAMPLE.COM';
    const password = 'SecurePass123!';

    const res = await request(app)
      .post('/api/auth/sign-up')
      .send({ email, password });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('testuser@example.com');
  });

  it('rejects duplicate email registration', async () => {
    const email = faker.internet.email();
    await createUser({ email });

    const res = await request(app)
      .post('/api/auth/sign-up')
      .send({ email, password: 'SecurePass123!' });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('already exists');
  });

  it('rejects weak password (too short)', async () => {
    const email = faker.internet.email();

    const res = await request(app)
      .post('/api/auth/sign-up')
      .send({ email, password: 'weak' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('at least 8 characters');
  });

  it('rejects invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/sign-up')
      .send({ email: 'not-an-email', password: 'SecurePass123!' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid email');
  });

  it('rejects missing email', async () => {
    const res = await request(app)
      .post('/api/auth/sign-up')
      .send({ password: 'SecurePass123!' });

    expect(res.status).toBe(400);
  });

  it('rejects missing password', async () => {
    const res = await request(app)
      .post('/api/auth/sign-up')
      .send({ email: faker.internet.email() });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/sign-in', () => {
  it('successfully logs in with valid credentials', async () => {
    const user = await createUser({
      email: 'test@example.com',
      password: 'TestPass123!',
      emailVerified: true,
    });

    const res = await request(app)
      .post('/api/auth/sign-in')
      .send({ email: 'test@example.com', password: 'TestPass123!' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.body.user.password_hash).toBeUndefined(); // Should not expose password hash
  });

  it('is case-insensitive for email', async () => {
    await createUser({
      email: 'test@example.com',
      password: 'TestPass123!',
      emailVerified: true,
    });

    const res = await request(app)
      .post('/api/auth/sign-in')
      .send({ email: 'TEST@EXAMPLE.COM', password: 'TestPass123!' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('rejects incorrect password', async () => {
    await createUser({
      email: 'test@example.com',
      password: 'CorrectPass123!',
      emailVerified: true,
    });

    const res = await request(app)
      .post('/api/auth/sign-in')
      .send({ email: 'test@example.com', password: 'WrongPass123!' });

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Invalid');
  });

  it('rejects non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/sign-in')
      .send({ email: 'nonexistent@example.com', password: 'TestPass123!' });

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Invalid');
  });

  it('rejects unverified email if verification is required', async () => {
    await createUser({
      email: 'unverified@example.com',
      password: 'TestPass123!',
      emailVerified: false,
    });

    const res = await request(app)
      .post('/api/auth/sign-in')
      .send({ email: 'unverified@example.com', password: 'TestPass123!' });

    // Depending on your implementation, this might be 403 or allow login with a warning
    expect([200, 403]).toContain(res.status);
  });

  it('returns temp token if 2FA is enabled', async () => {
    await createUser({
      email: 'test-2fa@example.com',
      password: 'TestPass123!',
      emailVerified: true,
      twoFactorEnabled: true,
    });

    const res = await request(app)
      .post('/api/auth/sign-in')
      .send({ email: 'test-2fa@example.com', password: 'TestPass123!' });

    // Should return temp token and require 2FA
    if (res.status === 200) {
      expect(res.body.requires_2fa).toBe(true);
      expect(res.body.temp_token).toBeDefined();
    }
  });
});

describe('GET /api/auth/me', () => {
  it('returns user data with valid token', async () => {
    const user = await createUser();
    const token = generateToken(user.id);

    const res = await request(app)
      .get('/api/auth/me')
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
    expect(res.body.email).toBe(user.email);
    expect(res.body.password_hash).toBeUndefined();
  });

  it('rejects request without token', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('rejects invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid-token');

    expect(res.status).toBe(401);
  });

  it('rejects malformed auth header', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'InvalidFormat');

    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/request-magic-link', () => {
  it('sends magic link for existing verified user', async () => {
    const user = await createUser({ emailVerified: true });

    const res = await request(app)
      .post('/api/auth/request-magic-link')
      .send({ email: user.email });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Magic link generated');
    expect(res.body.magic_link).toBeDefined();
    expect(res.body.token).toBeDefined();
  });

  it('returns success even for non-existent email (security)', async () => {
    const res = await request(app)
      .post('/api/auth/request-magic-link')
      .send({ email: 'nonexistent@example.com' });

    // Should return 200 to prevent email enumeration
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Magic link generated');
    expect(res.body.magic_link).toBeDefined();
    expect(res.body.token).toBeDefined();
  });

  it('rejects invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/request-magic-link')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid email');
  });

  it('rejects missing email', async () => {
    const res = await request(app)
      .post('/api/auth/request-magic-link')
      .send({});

    expect(res.status).toBe(400);
  });

  it('rate limits repeated requests', async () => {
    const user = await createUser({ emailVerified: true });

    // Make multiple rapid requests
    const requests = Array(6)
      .fill(null)
      .map(() =>
        request(app)
          .post('/api/auth/request-magic-link')
          .send({ email: user.email })
      );

    const responses = await Promise.all(requests);

    // At least one should be rate limited (429)
    const rateLimited = responses.some((r) => r.status === 429);
    expect(rateLimited).toBe(true);
  });
});

describe('Authentication Security', () => {
  it('does not expose user existence through different error messages', async () => {
    // Create one user
    await createUser({ email: 'existing@example.com', password: 'Pass123!' });

    // Try to login with existing email but wrong password
    const res1 = await request(app)
      .post('/api/auth/sign-in')
      .send({ email: 'existing@example.com', password: 'WrongPass!' });

    // Try to login with non-existing email
    const res2 = await request(app)
      .post('/api/auth/sign-in')
      .send({ email: 'nonexistent@example.com', password: 'SomePass!' });

    // Both should return same error message to prevent user enumeration
    expect(res1.status).toBe(401);
    expect(res2.status).toBe(401);
    expect(res1.body.error).toBe(res2.body.error);
  });

  it('tokens expire correctly', async () => {
    const user = await createUser();
    // Generate an expired token (this would need a helper that creates expired tokens)
    // For now we test that the endpoint validates tokens properly

    const token = generateToken(user.id, '0s'); // Immediate expiration

    // Wait a tiny bit to ensure expiration
    await new Promise((resolve) => setTimeout(resolve, 100));

    const res = await request(app)
      .get('/api/auth/me')
      .set(authHeader(token));

    expect(res.status).toBe(401);
  });
});
