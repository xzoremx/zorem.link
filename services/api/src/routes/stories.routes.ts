import express, { type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool.js';
import {
  generateUploadUrl,
  generateDownloadUrl,
  generateMediaKey,
  resolveUploadContent,
} from '../lib/s3.js';
import { config } from '../config/env.js';
import { validateViewerHash } from '../lib/crypto.js';
import type { JWTPayload, MediaType } from '../types/index.js';

const router = express.Router();

interface RoomRow {
  id: string;
  owner_id: string;
  allow_uploads: boolean;
  is_active: boolean;
  expires_at: Date;
  max_uploads_per_viewer: number | null;
}

interface StoryRow {
  id: string;
  room_id: string;
  media_type: MediaType;
  media_key: string;
  created_at: Date;
  expires_at: Date;
  view_count?: string;
  like_count?: string;
  creator_nickname?: string;
  creator_viewer_hash?: string;
}

/**
 * GET /api/stories/room/:roomId
 */
router.get('/room/:roomId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { roomId } = req.params;
    const viewerHash =
      (req.query.viewer_hash as string) ||
      (req.headers['x-viewer-hash'] as string);

    const roomResult = await query<RoomRow>(
      `SELECT id, is_active, expires_at, allow_uploads
       FROM rooms 
       WHERE id = $1`,
      [roomId]
    );

    if (roomResult.rows.length === 0) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    const room = roomResult.rows[0];
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    if (!room.is_active) {
      res.status(403).json({ error: 'Room is not active' });
      return;
    }

    const now = new Date();
    const expiresAt = new Date(room.expires_at);
    if (expiresAt < now) {
      res.status(403).json({ error: 'Room has expired' });
      return;
    }

    const storiesResult = await query<StoryRow>(
      `SELECT s.id, s.media_type, s.media_key, s.created_at, s.expires_at, s.creator_viewer_hash,
              COUNT(DISTINCT v.id) as view_count,
              COUNT(DISTINCT sl.id) as like_count,
              vs.nickname as creator_nickname
       FROM stories s
       LEFT JOIN views v ON s.id = v.story_id
       LEFT JOIN story_likes sl ON s.id = sl.story_id
       LEFT JOIN viewer_sessions vs ON s.room_id = vs.room_id AND s.creator_viewer_hash = vs.viewer_hash
       WHERE s.room_id = $1 AND s.expires_at > NOW()
       GROUP BY s.id, vs.nickname
       ORDER BY s.created_at ASC`,
      [roomId]
    );

    let viewedStoryIds: string[] = [];
    let likedStoryIds: string[] = [];
    if (viewerHash && validateViewerHash(viewerHash)) {
      const viewsResult = await query<{ story_id: string }>(
        `SELECT story_id FROM views WHERE viewer_hash = $1`,
        [viewerHash]
      );
      viewedStoryIds = viewsResult.rows.map((row) => row.story_id);

      const likesResult = await query<{ story_id: string }>(
        `SELECT story_id FROM story_likes WHERE viewer_hash = $1`,
        [viewerHash]
      );
      likedStoryIds = likesResult.rows.map((row) => row.story_id);
    }

    const stories = await Promise.all(
      storiesResult.rows.map(async (story) => {
        let mediaUrl: string | null = null;

        if (config.s3BucketName) {
          if (config.storageType === 'r2' && config.r2Endpoint) {
            const endpoint = config.r2Endpoint.replace(/\/$/, '');
            mediaUrl = `${endpoint}/${story.media_key}`;
          } else {
            mediaUrl = await generateDownloadUrl(story.media_key, 3600);
          }
        }

        return {
          id: story.id,
          media_type: story.media_type,
          media_url: mediaUrl,
          media_key: story.media_key,
          created_at: story.created_at,
          expires_at: story.expires_at,
          view_count: parseInt(story.view_count ?? '0') || 0,
          like_count: parseInt(story.like_count ?? '0') || 0,
          viewed: viewedStoryIds.includes(story.id),
          liked: likedStoryIds.includes(story.id),
          creator_nickname: story.creator_nickname || null,
        };
      })
    );

    res.json({
      room_id: roomId,
      allow_uploads: room.allow_uploads,
      stories,
      total: stories.length,
    });
  } catch (error) {
    console.error('Error getting stories:', error);
    res.status(500).json({ error: 'Failed to get stories' });
  }
});

/**
 * POST /api/stories/upload-url
 */
router.post('/upload-url', async (req: Request, res: Response): Promise<void> => {
  try {
    const { room_id, media_type, file_size, content_type } = req.body as {
      room_id?: string;
      media_type?: string;
      file_size?: number;
      content_type?: string;
    };
    const authHeader = req.headers.authorization;
    const viewerHash =
      (req.body as { viewer_hash?: string }).viewer_hash ||
      (req.headers['x-viewer-hash'] as string);

    if (!room_id || !media_type) {
      res.status(400).json({ error: 'room_id and media_type are required' });
      return;
    }

    if (media_type !== 'image' && media_type !== 'video') {
      res.status(400).json({ error: 'media_type must be "image" or "video"' });
      return;
    }

    const maxSize = 50 * 1024 * 1024;
    if (file_size && file_size > maxSize) {
      res.status(400).json({ error: 'File size exceeds maximum of 50MB' });
      return;
    }

    const roomResult = await query<RoomRow>(
      `SELECT id, owner_id, allow_uploads, is_active, expires_at, max_uploads_per_viewer
       FROM rooms 
       WHERE id = $1`,
      [room_id]
    );

    if (roomResult.rows.length === 0) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    const room = roomResult.rows[0];
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    if (!room.is_active) {
      res.status(403).json({ error: 'Room is not active' });
      return;
    }

    const now = new Date();
    const expiresAt = new Date(room.expires_at);
    if (expiresAt < now) {
      res.status(403).json({ error: 'Room has expired' });
      return;
    }

    let hasPermission = false;
    let uploadsRemaining: number | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, config.jwtSecret) as JWTPayload;

        if (decoded.userId === room.owner_id) {
          hasPermission = true;
        }
      } catch {
        // Token inválido
      }
    }

    if (!hasPermission && viewerHash) {
      if (!room.allow_uploads) {
        res.status(403).json({ error: 'Room does not allow viewer uploads' });
        return;
      }

      const viewerResult = await query<{ id: string }>(
        `SELECT id FROM viewer_sessions 
         WHERE room_id = $1 AND viewer_hash = $2`,
        [room_id, viewerHash]
      );

      if (viewerResult.rows.length > 0) {
        hasPermission = true;

        // Check upload limit for viewers
        if (room.max_uploads_per_viewer !== null) {
          const uploadCountResult = await query<{ count: string }>(
            `SELECT COUNT(*) as count FROM stories 
             WHERE room_id = $1 AND creator_viewer_hash = $2`,
            [room_id, viewerHash]
          );
          const uploadCount = parseInt(uploadCountResult.rows[0]?.count || '0');
          uploadsRemaining = room.max_uploads_per_viewer - uploadCount;
          
          if (uploadsRemaining <= 0) {
            res.status(403).json({ 
              error: `Upload limit reached. Maximum ${room.max_uploads_per_viewer} stories per viewer.`,
              uploads_remaining: 0,
              max_uploads: room.max_uploads_per_viewer
            });
            return;
          }
        }
      }
    }

    if (!hasPermission) {
      res.status(403).json({
        error: 'Permission denied. Must be room owner or authorized viewer',
      });
      return;
    }

    let uploadContent;
    try {
      uploadContent = resolveUploadContent(media_type as MediaType, content_type);
    } catch (err) {
      const error = err as Error;
      res.status(400).json({ error: error.message || 'Invalid content_type' });
      return;
    }

    const mediaKey = generateMediaKey(
      room_id,
      media_type as MediaType,
      uploadContent.fileExtension
    );

    if (!config.awsAccessKeyId || !config.s3BucketName) {
      res.status(503).json({ error: 'Storage not configured' });
      return;
    }

    const uploadUrl = await generateUploadUrl(mediaKey, uploadContent.contentType, 300);

    res.json({
      upload_url: uploadUrl,
      media_key: mediaKey,
      expires_in: 300,
      room_expires_at: room.expires_at,
    });
  } catch (error) {
    console.error('Error generating upload URL:', error);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

/**
 * POST /api/stories
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { room_id, media_key, media_type } = req.body as {
      room_id?: string;
      media_key?: string;
      media_type?: string;
    };
    const authHeader = req.headers.authorization;
    const viewerHash =
      (req.body as { viewer_hash?: string }).viewer_hash ||
      (req.headers['x-viewer-hash'] as string);

    if (!room_id || !media_key || !media_type) {
      res.status(400).json({
        error: 'room_id, media_key, and media_type are required',
      });
      return;
    }

    if (media_type !== 'image' && media_type !== 'video') {
      res.status(400).json({ error: 'media_type must be "image" or "video"' });
      return;
    }

    const roomResult = await query<RoomRow>(
      `SELECT id, owner_id, allow_uploads, is_active, expires_at, max_uploads_per_viewer
       FROM rooms 
       WHERE id = $1`,
      [room_id]
    );

    if (roomResult.rows.length === 0) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    const room = roomResult.rows[0];
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    if (!room.is_active) {
      res.status(403).json({ error: 'Room is not active' });
      return;
    }

    const now = new Date();
    const expiresAt = new Date(room.expires_at);
    if (expiresAt < now) {
      res.status(403).json({ error: 'Room has expired' });
      return;
    }

    let hasPermission = false;
    let isOwner = false;
    let creatorViewerHash: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, config.jwtSecret) as JWTPayload;

        if (decoded.userId === room.owner_id) {
          hasPermission = true;
          isOwner = true;
        }
      } catch {
        // Token inválido
      }
    }

    if (!hasPermission && viewerHash) {
      if (!room.allow_uploads) {
        res.status(403).json({ error: 'Room does not allow viewer uploads' });
        return;
      }

      const viewerResult = await query<{ id: string }>(
        `SELECT id FROM viewer_sessions 
         WHERE room_id = $1 AND viewer_hash = $2`,
        [room_id, viewerHash]
      );

      if (viewerResult.rows.length > 0) {
        hasPermission = true;
        creatorViewerHash = viewerHash;

        // Check upload limit for viewers
        if (room.max_uploads_per_viewer !== null) {
          const uploadCountResult = await query<{ count: string }>(
            `SELECT COUNT(*) as count FROM stories 
             WHERE room_id = $1 AND creator_viewer_hash = $2`,
            [room_id, viewerHash]
          );
          const uploadCount = parseInt(uploadCountResult.rows[0]?.count || '0');
          
          if (uploadCount >= room.max_uploads_per_viewer) {
            res.status(403).json({ 
              error: `Upload limit reached. Maximum ${room.max_uploads_per_viewer} stories per viewer.`,
              uploads_remaining: 0,
              max_uploads: room.max_uploads_per_viewer
            });
            return;
          }
        }
      }
    }

    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const storyResult = await query<StoryRow>(
      `INSERT INTO stories (room_id, media_type, media_key, expires_at, creator_viewer_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, room_id, media_type, media_key, created_at, expires_at`,
      [room_id, media_type, media_key, room.expires_at, creatorViewerHash]
    );

    const story = storyResult.rows[0];

    res.status(201).json({
      id: story?.id,
      room_id: story?.room_id,
      media_type: story?.media_type,
      media_key: story?.media_key,
      created_at: story?.created_at,
      expires_at: story?.expires_at,
    });
  } catch (error) {
    console.error('Error creating story:', error);
    res.status(500).json({ error: 'Failed to create story' });
  }
});

/**
 * POST /api/stories/:storyId/view
 */
router.post('/:storyId/view', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storyId } = req.params;
    const { viewer_hash } = req.body as { viewer_hash?: string };

    if (!viewer_hash) {
      res.status(400).json({ error: 'viewer_hash is required' });
      return;
    }

    if (!validateViewerHash(viewer_hash)) {
      res.status(400).json({ error: 'Invalid viewer_hash format' });
      return;
    }

    const storyResult = await query<StoryRow>(
      `SELECT s.id, s.room_id, s.expires_at
       FROM stories s
       WHERE s.id = $1`,
      [storyId]
    );

    if (storyResult.rows.length === 0) {
      res.status(404).json({ error: 'Story not found' });
      return;
    }

    const story = storyResult.rows[0];
    if (!story) {
      res.status(404).json({ error: 'Story not found' });
      return;
    }

    const now = new Date();
    const expiresAt = new Date(story.expires_at);
    if (expiresAt < now) {
      res.status(403).json({ error: 'Story has expired' });
      return;
    }

    const viewerResult = await query<{ id: string }>(
      `SELECT id FROM viewer_sessions 
       WHERE room_id = $1 AND viewer_hash = $2`,
      [story.room_id, viewer_hash]
    );

    if (viewerResult.rows.length === 0) {
      res.status(403).json({ error: 'Invalid viewer for this room' });
      return;
    }

    try {
      await query(
        `INSERT INTO views (story_id, viewer_hash)
         VALUES ($1, $2)
         ON CONFLICT (story_id, viewer_hash) DO NOTHING`,
        [storyId, viewer_hash]
      );

      res.json({ message: 'View recorded', story_id: storyId });
    } catch (error) {
      const err = error as { code?: string };
      if (err.code === '23505') {
        res.json({ message: 'View already recorded', story_id: storyId });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error recording view:', error);
    res.status(500).json({ error: 'Failed to record view' });
  }
});

/**
 * POST /api/stories/:storyId/like
 */
router.post('/:storyId/like', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storyId } = req.params;
    const { viewer_hash } = req.body as { viewer_hash?: string };

    if (!viewer_hash) {
      res.status(400).json({ error: 'viewer_hash is required' });
      return;
    }

    if (!validateViewerHash(viewer_hash)) {
      res.status(400).json({ error: 'Invalid viewer_hash format' });
      return;
    }

    const storyResult = await query<StoryRow>(
      `SELECT s.id, s.room_id, s.expires_at
       FROM stories s
       WHERE s.id = $1`,
      [storyId]
    );

    if (storyResult.rows.length === 0) {
      res.status(404).json({ error: 'Story not found' });
      return;
    }

    const story = storyResult.rows[0];
    if (!story) {
      res.status(404).json({ error: 'Story not found' });
      return;
    }

    const now = new Date();
    const expiresAt = new Date(story.expires_at);
    if (expiresAt < now) {
      res.status(403).json({ error: 'Story has expired' });
      return;
    }

    // Verify viewer is in this room
    const viewerResult = await query<{ id: string }>(
      `SELECT id FROM viewer_sessions 
       WHERE room_id = $1 AND viewer_hash = $2`,
      [story.room_id, viewer_hash]
    );

    if (viewerResult.rows.length === 0) {
      res.status(403).json({ error: 'Invalid viewer for this room' });
      return;
    }

    // Toggle like
    const existingLike = await query<{ id: string }>(
      `SELECT id FROM story_likes WHERE story_id = $1 AND viewer_hash = $2`,
      [storyId, viewer_hash]
    );

    let liked: boolean;
    if (existingLike.rows.length > 0) {
      // Unlike
      await query(
        `DELETE FROM story_likes WHERE story_id = $1 AND viewer_hash = $2`,
        [storyId, viewer_hash]
      );
      liked = false;
    } else {
      // Like
      await query(
        `INSERT INTO story_likes (story_id, viewer_hash) VALUES ($1, $2)
         ON CONFLICT (story_id, viewer_hash) DO NOTHING`,
        [storyId, viewer_hash]
      );
      liked = true;
    }

    // Get updated like count
    const likeCountResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM story_likes WHERE story_id = $1`,
      [storyId]
    );
    const likeCount = parseInt(likeCountResult.rows[0]?.count || '0');

    res.json({ 
      story_id: storyId, 
      liked, 
      like_count: likeCount 
    });
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

export default router;
