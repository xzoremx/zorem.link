import express, { type Request, type Response } from 'express';
import { query } from '../db/pool.js';
import { verifyAuth } from '../middlewares/auth.js';
import { generateUniqueCode, validateCodeFormat } from '../lib/codes.js';
import { roomCreationLimiter } from '../middlewares/rateLimit.js';
import QRCode from 'qrcode';
import { config } from '../config/env.js';
import type { RoomDuration } from '../types/index.js';

const router = express.Router();

interface CreateRoomBody {
  duration?: RoomDuration;
  allow_uploads?: boolean;
}

interface RoomRow {
  id: string;
  code: string;
  expires_at: Date;
  allow_uploads: boolean;
  is_active: boolean;
  created_at: Date;
  viewer_count?: string;
  story_count?: string;
}

const VALID_DURATIONS: RoomDuration[] = ['24h', '72h', '7d'];

/**
 * POST /api/rooms
 */
router.post(
  '/',
  verifyAuth,
  roomCreationLimiter,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { duration, allow_uploads } = req.body as CreateRoomBody;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      if (!duration) {
        res.status(400).json({ error: 'Duration is required' });
        return;
      }

      if (!VALID_DURATIONS.includes(duration)) {
        res.status(400).json({
          error: 'Invalid duration. Must be one of: 24h, 72h, 7d',
        });
        return;
      }

      const expiresAt = new Date();

      switch (duration) {
        case '24h':
          expiresAt.setHours(expiresAt.getHours() + 24);
          break;
        case '72h':
          expiresAt.setHours(expiresAt.getHours() + 72);
          break;
        case '7d':
          expiresAt.setDate(expiresAt.getDate() + 7);
          break;
      }

      const code = await generateUniqueCode();

      const roomResult = await query<RoomRow>(
        `INSERT INTO rooms (owner_id, code, expires_at, allow_uploads, is_active)
         VALUES ($1, $2, $3, $4, true)
         RETURNING id, code, expires_at, allow_uploads, is_active, created_at`,
        [userId, code, expiresAt, allow_uploads === true]
      );

      const room = roomResult.rows[0];
      if (!room) {
        res.status(500).json({ error: 'Failed to create room' });
        return;
      }

      const link = `${config.frontendUrl}/nickname.html?code=${code}`;

      let qrDataUrl: string | null = null;
      try {
        qrDataUrl = await QRCode.toDataURL(link);
      } catch (qrError) {
        console.warn('Failed to generate QR code:', qrError);
      }

      res.status(201).json({
        room_id: room.id,
        code: room.code,
        link,
        qr_data: qrDataUrl,
        expires_at: room.expires_at,
        allow_uploads: room.allow_uploads,
        duration,
      });
    } catch (error) {
      console.error('Error creating room:', error);
      res.status(500).json({ error: 'Failed to create room' });
    }
  }
);

/**
 * GET /api/rooms/:code
 */
router.get('/:code', async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.params;

    if (!validateCodeFormat(code)) {
      res.status(400).json({ valid: false, error: 'Invalid code format' });
      return;
    }

    const codeUpper = code.toUpperCase();

    const roomResult = await query<RoomRow>(
      `SELECT id, code, expires_at, allow_uploads, is_active
       FROM rooms 
       WHERE code = $1`,
      [codeUpper]
    );

    if (roomResult.rows.length === 0) {
      res.json({ valid: false, error: 'Room not found' });
      return;
    }

    const room = roomResult.rows[0];
    if (!room) {
      res.json({ valid: false, error: 'Room not found' });
      return;
    }

    if (!room.is_active) {
      res.json({ valid: false, error: 'Room is not active' });
      return;
    }

    const now = new Date();
    const expiresAt = new Date(room.expires_at);

    if (expiresAt < now) {
      res.json({ valid: false, error: 'Room has expired' });
      return;
    }

    res.json({
      valid: true,
      room_id: room.id,
      code: room.code,
      expires_at: room.expires_at,
      allow_uploads: room.allow_uploads,
    });
  } catch (error) {
    console.error('Error validating room code:', error);
    res.status(500).json({ valid: false, error: 'Failed to validate room code' });
  }
});

/**
 * GET /api/rooms/id/:roomId
 */
router.get(
  '/id/:roomId',
  verifyAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { roomId } = req.params;
      const userId = req.user?.id;

      const roomResult = await query<RoomRow>(
        `SELECT r.id, r.code, r.expires_at, r.allow_uploads, r.is_active, r.created_at,
                COUNT(DISTINCT vs.id) as viewer_count,
                COUNT(DISTINCT s.id) as story_count
         FROM rooms r
         LEFT JOIN viewer_sessions vs ON r.id = vs.room_id
         LEFT JOIN stories s ON r.id = s.room_id
         WHERE r.id = $1 AND r.owner_id = $2
         GROUP BY r.id`,
        [roomId, userId]
      );

      if (roomResult.rows.length === 0) {
        res.status(404).json({ error: 'Room not found or you are not the owner' });
        return;
      }

      const room = roomResult.rows[0];
      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }

      const now = new Date();
      const expiresAt = new Date(room.expires_at);
      const timeRemaining = expiresAt.getTime() - now.getTime();
      const hoursRemaining = Math.max(0, Math.floor(timeRemaining / (1000 * 60 * 60)));

      res.json({
        room_id: room.id,
        code: room.code,
        expires_at: room.expires_at,
        hours_remaining: hoursRemaining,
        allow_uploads: room.allow_uploads,
        is_active: room.is_active,
        viewer_count: parseInt(room.viewer_count ?? '0') || 0,
        story_count: parseInt(room.story_count ?? '0') || 0,
        created_at: room.created_at,
      });
    } catch (error) {
      console.error('Error getting room details:', error);
      res.status(500).json({ error: 'Failed to get room details' });
    }
  }
);

/**
 * DELETE /api/rooms/:roomId
 */
router.delete(
  '/:roomId',
  verifyAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { roomId } = req.params;
      const userId = req.user?.id;

      const roomResult = await query<{ id: string; code: string }>(
        `UPDATE rooms 
         SET is_active = false
         WHERE id = $1 AND owner_id = $2
         RETURNING id, code`,
        [roomId, userId]
      );

      if (roomResult.rows.length === 0) {
        res.status(404).json({ error: 'Room not found or you are not the owner' });
        return;
      }

      const room = roomResult.rows[0];

      res.json({
        message: 'Room closed successfully',
        room_id: room?.id,
        code: room?.code,
      });
    } catch (error) {
      console.error('Error closing room:', error);
      res.status(500).json({ error: 'Failed to close room' });
    }
  }
);

/**
 * GET /api/rooms
 */
router.get(
  '/',
  verifyAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;

      const roomsResult = await query<RoomRow>(
        `SELECT r.id, r.code, r.expires_at, r.allow_uploads, r.is_active, r.created_at,
                COUNT(DISTINCT vs.id) as viewer_count,
                COUNT(DISTINCT s.id) as story_count
         FROM rooms r
         LEFT JOIN viewer_sessions vs ON r.id = vs.room_id
         LEFT JOIN stories s ON r.id = s.room_id
         WHERE r.owner_id = $1
         GROUP BY r.id
         ORDER BY r.created_at DESC`,
        [userId]
      );

      const rooms = roomsResult.rows.map((room) => {
        const now = new Date();
        const expiresAt = new Date(room.expires_at);
        const timeRemaining = expiresAt.getTime() - now.getTime();
        const hoursRemaining = Math.max(
          0,
          Math.floor(timeRemaining / (1000 * 60 * 60))
        );

        return {
          room_id: room.id,
          code: room.code,
          expires_at: room.expires_at,
          hours_remaining: hoursRemaining,
          allow_uploads: room.allow_uploads,
          is_active: room.is_active,
          viewer_count: parseInt(room.viewer_count ?? '0') || 0,
          story_count: parseInt(room.story_count ?? '0') || 0,
          created_at: room.created_at,
        };
      });

      res.json({ rooms });
    } catch (error) {
      console.error('Error listing rooms:', error);
      res.status(500).json({ error: 'Failed to list rooms' });
    }
  }
);

export default router;
