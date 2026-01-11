/**
 * Test data factories
 * Helper functions to create test entities easily
 */

import { faker } from '@faker-js/faker';
import { pool } from '../../src/db/pool.js';
import bcrypt from 'bcrypt';
import { generateViewerHash } from '../../src/lib/crypto.js';

interface CreateUserOptions {
  email?: string;
  password?: string;
  emailVerified?: boolean;
  twoFactorEnabled?: boolean;
}

export async function createUser(overrides: CreateUserOptions = {}) {
  const password = overrides.password || 'TestPass123!';
  const passwordHash = await bcrypt.hash(password, 10);

  const result = await pool.query(
    `
    INSERT INTO users (email, password_hash, email_verified, two_factor_enabled)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `,
    [
      overrides.email || faker.internet.email(),
      passwordHash,
      overrides.emailVerified !== undefined ? overrides.emailVerified : true,
      overrides.twoFactorEnabled || false,
    ]
  );

  return { ...result.rows[0], password };
}

interface CreateRoomOptions {
  code?: string;
  expiresAt?: Date;
  allowUploads?: boolean;
  maxUploadsPerViewer?: number;
}

export async function createRoom(
  userId: string,
  overrides: CreateRoomOptions = {}
) {
  const code =
    overrides.code ||
    faker.string.alphanumeric({ length: 6, casing: 'upper' });
  const expiresAt =
    overrides.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h from now
  const allowUploads = overrides.allowUploads !== undefined ? overrides.allowUploads : true;
  const maxUploadsPerViewer = overrides.maxUploadsPerViewer || 5;

  const result = await pool.query(
    `
    INSERT INTO rooms (owner_id, code, expires_at, allow_uploads, max_uploads_per_viewer)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `,
    [userId, code, expiresAt, allowUploads, maxUploadsPerViewer]
  );

  return result.rows[0];
}

interface CreateStoryOptions {
  mediaType?: 'image' | 'video';
  mediaKey?: string;
  expiresAt?: Date;
  creatorViewerHash?: string;
}

export async function createStory(
  roomId: string,
  overrides: CreateStoryOptions = {}
) {
  const mediaType = overrides.mediaType || 'image';
  const mediaKey =
    overrides.mediaKey || `stories/${faker.string.uuid()}.${mediaType === 'image' ? 'jpg' : 'mp4'}`;
  const expiresAt =
    overrides.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000);

  const result = await pool.query(
    `
    INSERT INTO stories (room_id, media_type, media_key, expires_at, creator_viewer_hash)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `,
    [roomId, mediaType, mediaKey, expiresAt, overrides.creatorViewerHash || null]
  );

  return result.rows[0];
}

interface CreateViewerSessionOptions {
  nickname?: string;
  avatar?: string;
}

export async function createViewerSession(
  roomId: string,
  overrides: CreateViewerSessionOptions = {}
) {
  const nickname = overrides.nickname || faker.person.firstName();
  const avatar = overrides.avatar || faker.helpers.arrayElement(['😀', '😎', '🚀', '🎉']);

  // Generate a unique viewer hash
  const viewerHash = generateViewerHash(roomId, nickname);

  const result = await pool.query(
    `
    INSERT INTO viewer_sessions (room_id, nickname, viewer_hash, avatar)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `,
    [roomId, nickname, viewerHash, avatar]
  );

  return { ...result.rows[0], viewer_hash: viewerHash };
}

/**
 * Create a like on a story from a viewer
 */
export async function createLike(storyId: string, viewerHash: string) {
  const result = await pool.query(
    `
    INSERT INTO story_likes (story_id, viewer_hash)
    VALUES ($1, $2)
    ON CONFLICT (story_id, viewer_hash) DO NOTHING
    RETURNING *
  `,
    [storyId, viewerHash]
  );

  return result.rows[0];
}

/**
 * Create a view on a story from a viewer
 */
export async function createView(storyId: string, viewerHash: string) {
  const result = await pool.query(
    `
    INSERT INTO views (story_id, viewer_hash)
    VALUES ($1, $2)
    ON CONFLICT (story_id, viewer_hash) DO NOTHING
    RETURNING *
  `,
    [storyId, viewerHash]
  );

  return result.rows[0];
}
