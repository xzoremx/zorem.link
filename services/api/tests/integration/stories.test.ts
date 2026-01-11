/**
 * Integration tests for stories routes
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import {
  createUser,
  createRoom,
  createStory,
  createViewerSession,
  createLike,
  createView,
} from '../helpers/factories.js';
import { generateToken, authHeader, viewerHashHeader } from '../helpers/auth.js';

describe('GET /api/stories/room/:roomId', () => {
  it('returns all stories for a room', async () => {
    const user = await createUser();
    const room = await createRoom(user.id);

    await createStory(room.id);
    await createStory(room.id);
    await createStory(room.id);

    const res = await request(app).get(`/api/stories/room/${room.id}`);

    expect(res.status).toBe(200);
    expect(res.body.stories).toHaveLength(3);
    expect(res.body.stories[0].media_url).toBeDefined();
    expect(res.body.stories[0].media_type).toBeDefined();
  });

  it('includes like_count and view_count for each story', async () => {
    const user = await createUser();
    const room = await createRoom(user.id);
    const story = await createStory(room.id);
    const viewer = await createViewerSession(room.id);

    // Add likes and views
    await createLike(story.id, viewer.viewer_hash);
    await createView(story.id, viewer.viewer_hash);

    const res = await request(app).get(`/api/stories/room/${room.id}`);

    expect(res.status).toBe(200);
    expect(res.body.stories[0].like_count).toBeGreaterThanOrEqual(1);
    expect(res.body.stories[0].view_count).toBeGreaterThanOrEqual(1);
  });

  it('includes liked=true when viewer has liked the story', async () => {
    const user = await createUser();
    const room = await createRoom(user.id);
    const story = await createStory(room.id);
    const viewer = await createViewerSession(room.id);

    await createLike(story.id, viewer.viewer_hash);

    const res = await request(app)
      .get(`/api/stories/room/${room.id}`)
      .set(viewerHashHeader(viewer.viewer_hash));

    expect(res.status).toBe(200);
    expect(res.body.stories[0].liked).toBe(true);
  });

  it('includes liked=false when viewer has not liked the story', async () => {
    const user = await createUser();
    const room = await createRoom(user.id);
    await createStory(room.id);
    const viewer = await createViewerSession(room.id);

    const res = await request(app)
      .get(`/api/stories/room/${room.id}`)
      .set(viewerHashHeader(viewer.viewer_hash));

    expect(res.status).toBe(200);
    expect(res.body.stories[0].liked).toBe(false);
  });

  it('includes creator nickname when story was uploaded by viewer', async () => {
    const user = await createUser();
    const room = await createRoom(user.id);
    const viewer = await createViewerSession(room.id, { nickname: 'TestViewer' });
    await createStory(room.id, { creatorViewerHash: viewer.viewer_hash });

    const res = await request(app).get(`/api/stories/room/${room.id}`);

    expect(res.status).toBe(200);
    expect(res.body.stories[0].creator_nickname).toBe('TestViewer');
  });

  it('returns cache-control: no-store header', async () => {
    const user = await createUser();
    const room = await createRoom(user.id);

    const res = await request(app).get(`/api/stories/room/${room.id}`);

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toContain('no-store');
  });

  it('returns 404 for non-existent room', async () => {
    const res = await request(app).get(
      `/api/stories/room/99999999-9999-9999-9999-999999999999`
    );

    expect(res.status).toBe(404);
  });

  it('returns empty array for room with no stories', async () => {
    const user = await createUser();
    const room = await createRoom(user.id);

    const res = await request(app).get(`/api/stories/room/${room.id}`);

    expect(res.status).toBe(200);
    expect(res.body.stories).toEqual([]);
  });

  it('orders stories by creation time (oldest first)', async () => {
    const user = await createUser();
    const room = await createRoom(user.id);

    // Create stories with small delays
    const story1 = await createStory(room.id);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const story2 = await createStory(room.id);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const story3 = await createStory(room.id);

    const res = await request(app).get(`/api/stories/room/${room.id}`);

    expect(res.status).toBe(200);
    // Oldest should be first
    expect(res.body.stories[0].id).toBe(story1.id);
    expect(res.body.stories[2].id).toBe(story3.id);
  });
});

describe('POST /api/stories/upload-url', () => {
  it('generates presigned upload URL for viewer', async () => {
    const user = await createUser();
    const room = await createRoom(user.id);
    const viewer = await createViewerSession(room.id);

    const res = await request(app)
      .post('/api/stories/upload-url')
      .set(viewerHashHeader(viewer.viewer_hash))
      .send({
        room_id: room.id,
        media_type: 'image',
        file_size: 1024 * 1024, // 1MB
        content_type: 'image/jpeg',
      });

    expect(res.status).toBe(200);
    expect(res.body.upload_url).toBeDefined();
    expect(res.body.media_key).toBeDefined();
    expect(res.body.upload_url).toContain('http'); // Should be a URL
  });

  it('works for room owner without viewer hash', async () => {
    const user = await createUser();
    const token = generateToken(user.id);
    const room = await createRoom(user.id);

    const res = await request(app)
      .post('/api/stories/upload-url')
      .set(authHeader(token))
      .send({
        room_id: room.id,
        media_type: 'video',
        file_size: 5 * 1024 * 1024, // 5MB
      });

    expect(res.status).toBe(200);
    expect(res.body.upload_url).toBeDefined();
  });

  it('rejects if uploads are disabled for the room', async () => {
    const user = await createUser();
    const room = await createRoom(user.id, { allowUploads: false });
    const viewer = await createViewerSession(room.id);

    const res = await request(app)
      .post('/api/stories/upload-url')
      .set(viewerHashHeader(viewer.viewer_hash))
      .send({
        room_id: room.id,
        media_type: 'image',
        file_size: 1024 * 1024,
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('not allowed');
  });

  it('rejects file size over 50MB', async () => {
    const user = await createUser();
    const token = generateToken(user.id);
    const room = await createRoom(user.id);

    const res = await request(app)
      .post('/api/stories/upload-url')
      .set(authHeader(token))
      .send({
        room_id: room.id,
        media_type: 'video',
        file_size: 60 * 1024 * 1024, // 60MB
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('50MB');
  });

  it('requires authentication or viewer hash', async () => {
    const user = await createUser();
    const room = await createRoom(user.id);

    const res = await request(app)
      .post('/api/stories/upload-url')
      .send({
        room_id: room.id,
        media_type: 'image',
        file_size: 1024 * 1024,
      });

    expect(res.status).toBe(401);
  });
});

describe('POST /api/stories', () => {
  it('creates story record after upload', async () => {
    const user = await createUser();
    const token = generateToken(user.id);
    const room = await createRoom(user.id);

    const res = await request(app)
      .post('/api/stories')
      .set(authHeader(token))
      .send({
        room_id: room.id,
        media_key: 'stories/test-image.jpg',
        media_type: 'image',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.media_key).toBe('stories/test-image.jpg');
    expect(res.body.media_type).toBe('image');
  });

  it('associates story with viewer when viewer_hash provided', async () => {
    const user = await createUser();
    const room = await createRoom(user.id);
    const viewer = await createViewerSession(room.id, { nickname: 'TestUploader' });

    const res = await request(app)
      .post('/api/stories')
      .set(viewerHashHeader(viewer.viewer_hash))
      .send({
        room_id: room.id,
        media_key: 'stories/viewer-image.jpg',
        media_type: 'image',
      });

    expect(res.status).toBe(201);

    // Verify it shows creator nickname
    const listRes = await request(app).get(`/api/stories/room/${room.id}`);
    expect(listRes.body.stories[0].creator_nickname).toBe('TestUploader');
  });
});

describe('POST /api/stories/:storyId/like', () => {
  it('toggles like on a story', async () => {
    const user = await createUser();
    const room = await createRoom(user.id);
    const story = await createStory(room.id);
    const viewer = await createViewerSession(room.id);

    // First like
    const res1 = await request(app)
      .post(`/api/stories/${story.id}/like`)
      .send({ viewer_hash: viewer.viewer_hash });

    expect(res1.status).toBe(200);
    expect(res1.body.liked).toBe(true);
    expect(res1.body.like_count).toBe(1);

    // Unlike
    const res2 = await request(app)
      .post(`/api/stories/${story.id}/like`)
      .send({ viewer_hash: viewer.viewer_hash });

    expect(res2.status).toBe(200);
    expect(res2.body.liked).toBe(false);
    expect(res2.body.like_count).toBe(0);
  });

  it('requires valid viewer hash', async () => {
    const user = await createUser();
    const room = await createRoom(user.id);
    const story = await createStory(room.id);

    const res = await request(app)
      .post(`/api/stories/${story.id}/like`)
      .send({ viewer_hash: 'invalid-hash' });

    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent story', async () => {
    const user = await createUser();
    const room = await createRoom(user.id);
    const viewer = await createViewerSession(room.id);

    const res = await request(app)
      .post(`/api/stories/99999999-9999-9999-9999-999999999999/like`)
      .send({ viewer_hash: viewer.viewer_hash });

    expect(res.status).toBe(404);
  });
});

describe('POST /api/stories/:storyId/view', () => {
  it('records a view on a story', async () => {
    const user = await createUser();
    const room = await createRoom(user.id);
    const story = await createStory(room.id);
    const viewer = await createViewerSession(room.id);

    const res = await request(app)
      .post(`/api/stories/${story.id}/view`)
      .send({ viewer_hash: viewer.viewer_hash });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('recorded');
  });

  it('is idempotent (same viewer viewing twice)', async () => {
    const user = await createUser();
    const room = await createRoom(user.id);
    const story = await createStory(room.id);
    const viewer = await createViewerSession(room.id);

    // First view
    await request(app)
      .post(`/api/stories/${story.id}/view`)
      .send({ viewer_hash: viewer.viewer_hash });

    // Second view
    const res = await request(app)
      .post(`/api/stories/${story.id}/view`)
      .send({ viewer_hash: viewer.viewer_hash });

    expect(res.status).toBe(200);

    // Check view count is still 1
    const listRes = await request(app).get(`/api/stories/room/${room.id}`);
    expect(listRes.body.stories[0].view_count).toBe(1);
  });
});

describe('DELETE /api/stories/:storyId', () => {
  it('allows room owner to delete any story', async () => {
    const user = await createUser();
    const token = generateToken(user.id);
    const room = await createRoom(user.id);
    const story = await createStory(room.id);

    const res = await request(app)
      .delete(`/api/stories/${story.id}`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('deleted');

    // Verify story is gone
    const listRes = await request(app).get(`/api/stories/room/${room.id}`);
    expect(listRes.body.stories).toHaveLength(0);
  });

  it('prevents non-owner from deleting stories', async () => {
    const owner = await createUser();
    const other = await createUser();
    const otherToken = generateToken(other.id);
    const room = await createRoom(owner.id);
    const story = await createStory(room.id);

    const res = await request(app)
      .delete(`/api/stories/${story.id}`)
      .set(authHeader(otherToken));

    expect(res.status).toBe(403);
  });

  it('requires authentication', async () => {
    const user = await createUser();
    const room = await createRoom(user.id);
    const story = await createStory(room.id);

    const res = await request(app).delete(`/api/stories/${story.id}`);

    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent story', async () => {
    const user = await createUser();
    const token = generateToken(user.id);

    const res = await request(app)
      .delete(`/api/stories/99999999-9999-9999-9999-999999999999`)
      .set(authHeader(token));

    expect(res.status).toBe(404);
  });
});
