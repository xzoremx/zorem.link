/**
 * Integration tests for rooms routes
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { createUser, createRoom, createStory, createViewerSession } from '../helpers/factories.js';
import { generateToken, authHeader } from '../helpers/auth.js';

describe('POST /api/rooms', () => {
  it('creates a new room with valid data', async () => {
    const user = await createUser();
    const token = generateToken(user.id);

    const res = await request(app)
      .post('/api/rooms')
      .set(authHeader(token))
      .send({
        duration: '1h',
        allow_uploads: true,
        max_uploads_per_viewer: 5,
      });

    expect(res.status).toBe(201);
    expect(res.body.room_id).toBeDefined();
    expect(res.body.code).toBeDefined();
    expect(res.body.code).toHaveLength(6);
    expect(res.body.expires_at).toBeDefined();
    expect(res.body.allow_uploads).toBe(true);
    expect(res.body.qr_data).toBeDefined(); // QR code data URL
  });

  it('creates room with default upload settings', async () => {
    const user = await createUser();
    const token = generateToken(user.id);

    const res = await request(app)
      .post('/api/rooms')
      .set(authHeader(token))
      .send({ duration: '24h' });

    expect(res.status).toBe(201);
    expect(res.body.allow_uploads).toBeDefined();
  });

  it('calculates correct expiration time for different durations', async () => {
    const user = await createUser();
    const token = generateToken(user.id);

    const testCases = ['1h', '3h', '6h', '12h', '24h'];

    for (const duration of testCases) {
      const res = await request(app)
        .post('/api/rooms')
        .set(authHeader(token))
        .send({ duration });

      expect(res.status).toBe(201);

      const expiresAt = new Date(res.body.expires_at);
      const now = new Date();
      const diffHours = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Check that expiration is approximately correct (within 1 minute tolerance)
      const expectedHours = parseInt(duration);
      expect(Math.abs(diffHours - expectedHours)).toBeLessThan(0.02);
    }
  });

  it('requires authentication', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .send({ duration: '1h' });

    expect(res.status).toBe(401);
  });

  it('rejects invalid duration format', async () => {
    const user = await createUser();
    const token = generateToken(user.id);

    const res = await request(app)
      .post('/api/rooms')
      .set(authHeader(token))
      .send({ duration: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('rate limits room creation', async () => {
    const user = await createUser();
    const token = generateToken(user.id);

    // Create multiple rooms rapidly
    const requests = Array(6)
      .fill(null)
      .map(() =>
        request(app)
          .post('/api/rooms')
          .set(authHeader(token))
          .send({ duration: '1h' })
      );

    const responses = await Promise.all(requests);

    // At least one should be rate limited
    const rateLimited = responses.some((r) => r.status === 429);
    expect(rateLimited).toBe(true);
  });
});

describe('GET /api/rooms', () => {
  it('returns all rooms owned by the authenticated user', async () => {
    const user = await createUser();
    const token = generateToken(user.id);

    // Create some rooms
    await createRoom(user.id);
    await createRoom(user.id);

    const res = await request(app)
      .get('/api/rooms')
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.rooms).toHaveLength(2);
    expect(res.body.rooms[0].owner_id).toBe(user.id);
  });

  it('does not return rooms from other users', async () => {
    const user1 = await createUser();
    const user2 = await createUser();
    const token = generateToken(user1.id);

    await createRoom(user1.id);
    await createRoom(user2.id);
    await createRoom(user2.id);

    const res = await request(app)
      .get('/api/rooms')
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.rooms).toHaveLength(1);
  });

  it('includes stats (views, likes, story count) for each room', async () => {
    const user = await createUser();
    const token = generateToken(user.id);
    const room = await createRoom(user.id);

    // Create story and add some engagement
    const story = await createStory(room.id);
    const viewer = await createViewerSession(room.id);

    // Add view and like
    await request(app)
      .post(`/api/stories/${story.id}/view`)
      .send({ viewer_hash: viewer.viewer_hash });

    await request(app)
      .post(`/api/stories/${story.id}/like`)
      .send({ viewer_hash: viewer.viewer_hash });

    const res = await request(app)
      .get('/api/rooms')
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.rooms[0].total_stories).toBe(1);
    expect(res.body.rooms[0].total_views).toBeGreaterThanOrEqual(1);
    expect(res.body.rooms[0].total_likes).toBeGreaterThanOrEqual(1);
  });

  it('marks expired rooms correctly', async () => {
    const user = await createUser();
    const token = generateToken(user.id);

    // Create expired room
    await createRoom(user.id, {
      expiresAt: new Date(Date.now() - 1000), // 1 second ago
    });

    const res = await request(app)
      .get('/api/rooms')
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.rooms[0].is_expired).toBe(true);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/rooms');

    expect(res.status).toBe(401);
  });

  it('returns empty array when user has no rooms', async () => {
    const user = await createUser();
    const token = generateToken(user.id);

    const res = await request(app)
      .get('/api/rooms')
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.rooms).toEqual([]);
  });
});

describe('GET /api/rooms/:code', () => {
  it('validates and returns room for valid code', async () => {
    const user = await createUser();
    const room = await createRoom(user.id, { code: 'TEST99' });

    const res = await request(app).get('/api/rooms/TEST99');

    expect(res.status).toBe(200);
    expect(res.body.room_id).toBe(room.id);
    expect(res.body.code).toBe('TEST99');
    expect(res.body.allow_uploads).toBeDefined();
  });

  it('is case-insensitive for room codes', async () => {
    const user = await createUser();
    await createRoom(user.id, { code: 'TEST99' });

    const res = await request(app).get('/api/rooms/test99');

    expect(res.status).toBe(200);
    expect(res.body.code).toBe('TEST99');
  });

  it('returns 404 for non-existent code', async () => {
    const res = await request(app).get('/api/rooms/NOEXIST');

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('not found');
  });

  it('returns 410 for expired room', async () => {
    const user = await createUser();
    await createRoom(user.id, {
      code: 'EXPIRE',
      expiresAt: new Date(Date.now() - 1000),
    });

    const res = await request(app).get('/api/rooms/EXPIRE');

    expect(res.status).toBe(410);
    expect(res.body.error).toContain('expired');
  });

  it('rejects invalid code format', async () => {
    const res = await request(app).get('/api/rooms/ABC'); // Too short

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid');
  });
});

describe('DELETE /api/rooms/:roomId', () => {
  it('allows owner to close their room', async () => {
    const user = await createUser();
    const token = generateToken(user.id);
    const room = await createRoom(user.id);

    const res = await request(app)
      .delete(`/api/rooms/${room.id}`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('closed');

    // Verify room is actually expired
    const checkRes = await request(app).get(`/api/rooms/${room.code}`);
    expect(checkRes.status).toBe(410); // Gone - expired
  });

  it('prevents non-owner from closing room', async () => {
    const owner = await createUser();
    const other = await createUser();
    const otherToken = generateToken(other.id);
    const room = await createRoom(owner.id);

    const res = await request(app)
      .delete(`/api/rooms/${room.id}`)
      .set(authHeader(otherToken));

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('not authorized');
  });

  it('requires authentication', async () => {
    const user = await createUser();
    const room = await createRoom(user.id);

    const res = await request(app).delete(`/api/rooms/${room.id}`);

    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent room', async () => {
    const user = await createUser();
    const token = generateToken(user.id);

    const res = await request(app)
      .delete(`/api/rooms/99999999-9999-9999-9999-999999999999`)
      .set(authHeader(token));

    expect(res.status).toBe(404);
  });
});

describe('GET /api/rooms/:roomId/viewers', () => {
  it('returns list of viewers in the room', async () => {
    const user = await createUser();
    const token = generateToken(user.id);
    const room = await createRoom(user.id);

    // Create some viewers
    await createViewerSession(room.id, { nickname: 'Alice' });
    await createViewerSession(room.id, { nickname: 'Bob' });

    const res = await request(app)
      .get(`/api/rooms/${room.id}/viewers`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.viewers).toHaveLength(2);
    expect(res.body.total).toBe(2);
    expect(res.body.viewers[0].nickname).toBeDefined();
    expect(res.body.viewers[0].avatar).toBeDefined();
  });

  it('requires authentication from room owner', async () => {
    const user = await createUser();
    const room = await createRoom(user.id);

    const res = await request(app).get(`/api/rooms/${room.id}/viewers`);

    expect(res.status).toBe(401);
  });

  it('prevents non-owners from viewing viewer list', async () => {
    const owner = await createUser();
    const other = await createUser();
    const otherToken = generateToken(other.id);
    const room = await createRoom(owner.id);

    const res = await request(app)
      .get(`/api/rooms/${room.id}/viewers`)
      .set(authHeader(otherToken));

    expect(res.status).toBe(403);
  });
});
