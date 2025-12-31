import express, { type Request, type Response } from 'express';
import { query } from '../db/pool.js';
import { generateViewerHash, validateViewerHash } from '../lib/crypto.js';
import { validateCodeFormat } from '../lib/codes.js';

const router = express.Router();

interface JoinRequest {
  code?: string;
  nickname?: string;
}

interface RoomRow {
  id: string;
  owner_id: string;
  code: string;
  expires_at: Date;
  allow_uploads: boolean;
  is_active: boolean;
  created_at: Date;
}

interface SessionRow {
  id: string;
  room_id: string;
  viewer_hash: string;
  nickname: string;
  created_at: Date;
  code: string;
  allow_uploads: boolean;
  is_active: boolean;
  expires_at: Date;
}

/**
 * POST /api/viewer/join
 */
router.post('/join', async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, nickname } = req.body as JoinRequest;

    if (!code || !nickname) {
      res.status(400).json({ error: 'Code and nickname are required' });
      return;
    }

    if (!validateCodeFormat(code)) {
      res.status(400).json({
        error: 'Invalid code format. Code must be 6 alphanumeric characters',
      });
      return;
    }

    if (typeof nickname !== 'string' || nickname.trim().length === 0) {
      res.status(400).json({ error: 'Nickname must be a non-empty string' });
      return;
    }

    if (nickname.length > 50) {
      res.status(400).json({ error: 'Nickname must be 50 characters or less' });
      return;
    }

    const codeUpper = code.toUpperCase().trim();
    const nicknameTrimmed = nickname.trim();

    const roomResult = await query<RoomRow>(
      `SELECT id, owner_id, code, expires_at, allow_uploads, is_active, created_at
       FROM rooms 
       WHERE code = $1`,
      [codeUpper]
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

    const viewerHash = generateViewerHash(room.id, nicknameTrimmed);

    const existingSession = await query<{ id: string }>(
      `SELECT id FROM viewer_sessions 
       WHERE room_id = $1 AND viewer_hash = $2`,
      [room.id, viewerHash]
    );

    if (existingSession.rows.length === 0) {
      await query(
        `INSERT INTO viewer_sessions (room_id, viewer_hash, nickname)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [room.id, viewerHash, nicknameTrimmed]
      );
    }

    res.json({
      viewer_hash: viewerHash,
      room_id: room.id,
      room_code: room.code,
      allow_uploads: room.allow_uploads,
      expires_at: room.expires_at,
      nickname: nicknameTrimmed,
    });
  } catch (error) {
    console.error('Error joining room:', error);
    res.status(500).json({ error: 'Failed to join room' });
  }
});

/**
 * GET /api/viewer/session
 */
router.get('/session', async (req: Request, res: Response): Promise<void> => {
  try {
    const viewerHash =
      (req.query.viewer_hash as string) ||
      (req.headers['x-viewer-hash'] as string);

    if (!viewerHash) {
      res.status(400).json({ error: 'viewer_hash is required' });
      return;
    }

    if (!validateViewerHash(viewerHash)) {
      res.status(400).json({ error: 'Invalid viewer_hash format' });
      return;
    }

    const sessionResult = await query<SessionRow>(
      `SELECT vs.id, vs.room_id, vs.viewer_hash, vs.nickname, vs.created_at,
              r.code, r.allow_uploads, r.is_active, r.expires_at
       FROM viewer_sessions vs
       JOIN rooms r ON vs.room_id = r.id
       WHERE vs.viewer_hash = $1`,
      [viewerHash]
    );

    if (sessionResult.rows.length === 0) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const session = sessionResult.rows[0];
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    if (!session.is_active) {
      res.status(403).json({ error: 'Room is no longer active' });
      return;
    }

    const now = new Date();
    const expiresAt = new Date(session.expires_at);

    if (expiresAt < now) {
      res.status(403).json({ error: 'Room has expired' });
      return;
    }

    res.json({
      viewer_hash: session.viewer_hash,
      room_id: session.room_id,
      room_code: session.code,
      nickname: session.nickname,
      allow_uploads: session.allow_uploads,
      expires_at: session.expires_at,
      created_at: session.created_at,
    });
  } catch (error) {
    console.error('Error getting session:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

export default router;
