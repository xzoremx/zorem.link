import { query } from '../db/pool.js';
import { deleteFile } from './s3.js';
import crypto from 'crypto';

const LOCK_ID = 'room_cleanup';
const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes - if lock is older, consider it stale
const RETENTION_DAYS = 7; // Keep metadata for 7 days after expiry

// Unique identifier for this server instance
const SERVER_ID = crypto.randomBytes(8).toString('hex');

interface StoryToClean {
  id: string;
  media_key: string;
}

interface RoomToDelete {
  id: string;
}

/**
 * Try to acquire the cleanup lock.
 * Returns true if lock acquired, false if another process holds it.
 */
async function acquireLock(): Promise<boolean> {
  try {
    // First, clean up stale locks (older than LOCK_TIMEOUT_MS)
    const staleThreshold = new Date(Date.now() - LOCK_TIMEOUT_MS);
    await query(
      `DELETE FROM cleanup_locks WHERE id = $1 AND locked_at < $2`,
      [LOCK_ID, staleThreshold]
    );

    // Try to insert our lock
    const result = await query(
      `INSERT INTO cleanup_locks (id, locked_at, locked_by)
       VALUES ($1, NOW(), $2)
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [LOCK_ID, SERVER_ID]
    );

    return result.rows.length > 0;
  } catch (error) {
    console.error('[Cleanup] Failed to acquire lock:', error);
    return false;
  }
}

/**
 * Release the cleanup lock.
 */
async function releaseLock(): Promise<void> {
  try {
    await query(
      `DELETE FROM cleanup_locks WHERE id = $1 AND locked_by = $2`,
      [LOCK_ID, SERVER_ID]
    );
  } catch (error) {
    console.error('[Cleanup] Failed to release lock:', error);
  }
}

/**
 * Phase 1: Delete media files from S3/R2 for expired rooms.
 * Marks stories with media_deleted_at after successful deletion.
 */
async function cleanupExpiredMedia(): Promise<number> {
  // Find stories in expired rooms where media hasn't been deleted yet
  const storiesResult = await query<StoryToClean>(
    `SELECT s.id, s.media_key
     FROM stories s
     JOIN rooms r ON s.room_id = r.id
     WHERE r.expires_at <= NOW()
       AND s.media_deleted_at IS NULL
       AND s.media_key IS NOT NULL
     LIMIT 100` // Process in batches to avoid long-running transactions
  );

  const stories = storiesResult.rows;
  if (stories.length === 0) {
    return 0;
  }

  let deletedCount = 0;

  for (const story of stories) {
    try {
      // Delete from S3/R2
      await deleteFile(story.media_key);

      // Mark as deleted
      await query(
        `UPDATE stories SET media_deleted_at = NOW() WHERE id = $1`,
        [story.id]
      );

      deletedCount++;
    } catch (error) {
      // Log but continue with other stories
      console.error(`[Cleanup] Failed to delete media for story ${story.id}:`, error);
    }
  }

  return deletedCount;
}

/**
 * Phase 2: Delete rooms (and cascade to stories, views, etc.)
 * that expired more than RETENTION_DAYS ago.
 */
async function cleanupOldRooms(): Promise<number> {
  const retentionThreshold = new Date();
  retentionThreshold.setDate(retentionThreshold.getDate() - RETENTION_DAYS);

  // Find rooms to delete
  const roomsResult = await query<RoomToDelete>(
    `SELECT id FROM rooms
     WHERE expires_at <= $1
     LIMIT 50`, // Process in batches
    [retentionThreshold]
  );

  const rooms = roomsResult.rows;
  if (rooms.length === 0) {
    return 0;
  }

  // Delete rooms (CASCADE will handle stories, viewer_sessions, views, story_likes)
  const roomIds = rooms.map(r => r.id);

  const deleteResult = await query(
    `DELETE FROM rooms WHERE id = ANY($1) RETURNING id`,
    [roomIds]
  );

  return deleteResult.rows.length;
}

/**
 * Main cleanup function. Runs both phases with lock protection.
 */
export async function runCleanup(): Promise<void> {
  const lockAcquired = await acquireLock();

  if (!lockAcquired) {
    // Another instance is running cleanup, skip this run
    return;
  }

  try {
    // Phase 1: Delete media from storage
    const mediaDeleted = await cleanupExpiredMedia();
    if (mediaDeleted > 0) {
      console.log(`[Cleanup] Deleted media for ${mediaDeleted} stories`);
    }

    // Phase 2: Delete old rooms completely
    const roomsDeleted = await cleanupOldRooms();
    if (roomsDeleted > 0) {
      console.log(`[Cleanup] Deleted ${roomsDeleted} expired rooms (>${RETENTION_DAYS} days old)`);
    }
  } catch (error) {
    console.error('[Cleanup] Error during cleanup:', error);
  } finally {
    await releaseLock();
  }
}

/**
 * Start the cleanup scheduler.
 * Runs cleanup every intervalMs milliseconds.
 */
export function startCleanupScheduler(intervalMs: number = 60 * 1000): NodeJS.Timeout {
  console.log(`[Cleanup] Starting scheduler (interval: ${intervalMs / 1000}s, retention: ${RETENTION_DAYS} days)`);

  // Run immediately on startup
  runCleanup().catch(err => console.error('[Cleanup] Initial run failed:', err));

  // Then run periodically
  return setInterval(() => {
    runCleanup().catch(err => console.error('[Cleanup] Scheduled run failed:', err));
  }, intervalMs);
}
