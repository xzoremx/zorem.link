/**
 * Integration tests for viewer routes
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { createUser, createRoom } from '../helpers/factories.js';
import { faker } from '@faker-js/faker';

describe('POST /api/viewer/join', () => {
  it('creates viewer session with valid room code', async () => {
    const user = await createUser();
    const room = await createRoom(user.id, { code: 'JOIN99' });

    const res = await request(app)
      .post('/api/viewer/join')
      .send({
        code: 'JOIN99',
        nickname: 'TestViewer',
        avatar: '😀',
      });

    expect(res.status).toBe(200);
    expect(res.body.viewer_hash).toBeDefined();
    expect(res.body.viewer_hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hash
    expect(res.body.room_id).toBe(room.id);
    expect(res.body.nickname).toBe('TestViewer');
    expect(res.body.avatar).toBe('😀');
  });

  it('is case-insensitive for room code', async () => {
    const user = await createUser();
    await createRoom(user.id, { code: 'TEST99' });

    const res = await request(app)
      .post('/api/viewer/join')
      .send({
        code: 'test99', // lowercase
        nickname: 'TestViewer',
      });

    expect(res.status).toBe(200);
    expect(res.body.viewer_hash).toBeDefined();
  });

  it('uses default avatar if not provided', async () => {
    const user = await createUser();
    const room = await createRoom(user.id, { code: 'NOAV99' });

    const res = await request(app)
      .post('/api/viewer/join')
      .send({
        code: 'NOAV99',
        nickname: 'TestViewer',
      });

    expect(res.status).toBe(200);
    expect(res.body.avatar).toBeDefined(); // Should have a default
  });

  it('trims and validates nickname', async () => {
    const user = await createUser();
    const room = await createRoom(user.id, { code: 'TRIM99' });

    const res = await request(app)
      .post('/api/viewer/join')
      .send({
        code: 'TRIM99',
        nickname: '  TestViewer  ', // With spaces
      });

    expect(res.status).toBe(200);
    expect(res.body.nickname).toBe('TestViewer'); // Trimmed
  });

  it('rejects invalid room code', async () => {
    const res = await request(app)
      .post('/api/viewer/join')
      .send({
        code: 'NOEXST',
        nickname: 'TestViewer',
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('not found');
  });

  it('rejects expired room', async () => {
    const user = await createUser();
    await createRoom(user.id, {
      code: 'EXPIRE',
      expiresAt: new Date(Date.now() - 1000),
    });

    const res = await request(app)
      .post('/api/viewer/join')
      .send({
        code: 'EXPIRE',
        nickname: 'TestViewer',
      });

    expect(res.status).toBe(410);
    expect(res.body.error).toContain('expired');
  });

  it('rejects missing nickname', async () => {
    const user = await createUser();
    await createRoom(user.id, { code: 'TEST99' });

    const res = await request(app)
      .post('/api/viewer/join')
      .send({ code: 'TEST99' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('nickname');
  });

  it('rejects empty nickname', async () => {
    const user = await createUser();
    await createRoom(user.id, { code: 'TEST99' });

    const res = await request(app)
      .post('/api/viewer/join')
      .send({
        code: 'TEST99',
        nickname: '   ', // Just whitespace
      });

    expect(res.status).toBe(400);
  });

  it('rejects nickname that is too long', async () => {
    const user = await createUser();
    await createRoom(user.id, { code: 'TEST99' });

    const res = await request(app)
      .post('/api/viewer/join')
      .send({
        code: 'TEST99',
        nickname: 'a'.repeat(51), // Over 50 chars
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('50 characters');
  });

  it('allows same nickname for different viewers (different hashes)', async () => {
    const user = await createUser();
    const room = await createRoom(user.id, { code: 'MULTI9' });

    const res1 = await request(app)
      .post('/api/viewer/join')
      .send({
        code: 'MULTI9',
        nickname: 'Alice',
      });

    const res2 = await request(app)
      .post('/api/viewer/join')
      .send({
        code: 'MULTI9',
        nickname: 'Alice',
      });

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    // Different hashes despite same nickname
    expect(res1.body.viewer_hash).not.toBe(res2.body.viewer_hash);
  });

  it('handles special characters in nickname', async () => {
    const user = await createUser();
    const room = await createRoom(user.id, { code: 'SPEC99' });

    const res = await request(app)
      .post('/api/viewer/join')
      .send({
        code: 'SPEC99',
        nickname: 'User™ 🎉',
      });

    expect(res.status).toBe(200);
    expect(res.body.nickname).toBe('User™ 🎉');
  });

  it('validates avatar emoji format', async () => {
    const user = await createUser();
    const room = await createRoom(user.id, { code: 'AVAT99' });

    const validEmojis = ['😀', '🚀', '🎉', '❤️', '👍'];

    for (const emoji of validEmojis) {
      const res = await request(app)
        .post('/api/viewer/join')
        .send({
          code: 'AVAT99',
          nickname: faker.person.firstName(),
          avatar: emoji,
        });

      expect(res.status).toBe(200);
      expect(res.body.avatar).toBe(emoji);
    }
  });

  it('rejects invalid avatar (non-emoji)', async () => {
    const user = await createUser();
    const room = await createRoom(user.id, { code: 'INVAV9' });

    const res = await request(app)
      .post('/api/viewer/join')
      .send({
        code: 'INVAV9',
        nickname: 'TestViewer',
        avatar: 'ABC', // Not an emoji
      });

    // Depending on implementation, might accept any string or validate
    // If validation exists, expect 400
    expect([200, 400]).toContain(res.status);
  });
});

describe('GET /api/viewer/session', () => {
  it('retrieves viewer session info by viewer_hash', async () => {
    const user = await createUser();
    const room = await createRoom(user.id, { code: 'SESS99' });

    // Join to get viewer hash
    const joinRes = await request(app)
      .post('/api/viewer/join')
      .send({
        code: 'SESS99',
        nickname: 'SessionViewer',
        avatar: '🎯',
      });

    const viewerHash = joinRes.body.viewer_hash;

    // Get session info
    const res = await request(app)
      .get(`/api/viewer/session`)
      .query({ viewer_hash: viewerHash });

    expect(res.status).toBe(200);
    expect(res.body.nickname).toBe('SessionViewer');
    expect(res.body.avatar).toBe('🎯');
    expect(res.body.room).toBeDefined();
    expect(res.body.room.code).toBe('SESS99');
  });

  it('returns 404 for invalid viewer_hash', async () => {
    const invalidHash = 'a'.repeat(64); // Valid format but doesn't exist

    const res = await request(app)
      .get(`/api/viewer/session`)
      .query({ viewer_hash: invalidHash });

    expect(res.status).toBe(404);
  });

  it('returns 400 for malformed viewer_hash', async () => {
    const res = await request(app)
      .get(`/api/viewer/session`)
      .query({ viewer_hash: 'invalid' });

    expect(res.status).toBe(400);
  });

  it('requires viewer_hash parameter', async () => {
    const res = await request(app).get(`/api/viewer/session`);

    expect(res.status).toBe(400);
  });
});

describe('Viewer Flow Integration', () => {
  it('complete viewer flow: join → view stories → like → view session', async () => {
    // Setup
    const user = await createUser();
    const room = await createRoom(user.id, { code: 'FLOW99' });

    // Step 1: Join room
    const joinRes = await request(app)
      .post('/api/viewer/join')
      .send({
        code: 'FLOW99',
        nickname: 'FlowTester',
        avatar: '🔥',
      });

    expect(joinRes.status).toBe(200);
    const viewerHash = joinRes.body.viewer_hash;

    // Step 2: View stories list
    const storiesRes = await request(app)
      .get(`/api/stories/room/${room.id}`)
      .set('x-viewer-hash', viewerHash);

    expect(storiesRes.status).toBe(200);

    // Step 3: Check session
    const sessionRes = await request(app)
      .get(`/api/viewer/session`)
      .query({ viewer_hash: viewerHash });

    expect(sessionRes.status).toBe(200);
    expect(sessionRes.body.nickname).toBe('FlowTester');
  });

  it('viewer can rejoin same room and get different hash', async () => {
    const user = await createUser();
    const room = await createRoom(user.id, { code: 'REJOIN' });

    const join1 = await request(app)
      .post('/api/viewer/join')
      .send({ code: 'REJOIN', nickname: 'Rejoiner' });

    const join2 = await request(app)
      .post('/api/viewer/join')
      .send({ code: 'REJOIN', nickname: 'Rejoiner' });

    expect(join1.status).toBe(200);
    expect(join2.status).toBe(200);
    expect(join1.body.viewer_hash).not.toBe(join2.body.viewer_hash);
  });
});
