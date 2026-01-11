import express, { type Request, type Response } from 'express';
import { query } from '../db/pool.js';
import { generateViewerHash, validateViewerHash } from '../lib/crypto.js';
import { validateCodeFormat } from '../lib/codes.js';

const router = express.Router();

interface JoinRequest {
  code?: string;
  nickname?: string;
  avatar?: string;
}

const DEFAULT_AVATAR = '😀';
const MAX_AVATAR_CODEPOINTS = 25; // Allows complex emojis like 👨‍👩‍👧‍👦

function getFirstGrapheme(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const Segmenter = (Intl as any)?.Segmenter;
  if (typeof Segmenter === 'function') {
    const segmenter = new Segmenter(undefined, { granularity: 'grapheme' });
    const iterator = segmenter.segment(trimmed)[Symbol.iterator]();
    const first = iterator.next().value as { segment?: unknown } | undefined;
    if (first && typeof first.segment === 'string') {
      return first.segment;
    }
  }

  return Array.from(trimmed)[0] ?? '';
}

function isEmojiLike(value: string): boolean {
  if (!value) return false;

  // Reject plain digits, # and * (they match \p{Emoji} but aren't real emojis)
  if (/^[0-9#*]+$/.test(value)) {
    return false;
  }

  try {
    // Check for actual emoji presentation or emoji with modifiers/ZWJ
    // \p{Emoji_Presentation} = emojis that display as emoji by default
    // \p{Emoji_Modifier} = skin tone modifiers
    // \u200D = ZWJ (zero-width joiner) for composite emojis
    // \uFE0F = emoji variation selector
    return /[\p{Emoji_Presentation}\p{Extended_Pictographic}]|[\p{Emoji}][\u{FE0F}\u{200D}\p{Emoji_Modifier}]/u.test(value);
  } catch {
    // Fallback for older environments: check if it's in common emoji ranges
    const codePoint = value.codePointAt(0) ?? 0;
    return codePoint >= 0x1F300 || (codePoint >= 0x2600 && codePoint <= 0x27BF);
  }
}

function normalizeAvatar(avatar?: string): string {
  if (typeof avatar !== 'string') return DEFAULT_AVATAR;

  const grapheme = getFirstGrapheme(avatar);
  if (!grapheme) return DEFAULT_AVATAR;

  if (Array.from(grapheme).length > MAX_AVATAR_CODEPOINTS) {
    return DEFAULT_AVATAR;
  }

  if (!isEmojiLike(grapheme)) {
    return DEFAULT_AVATAR;
  }

  return grapheme;
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
  avatar: string;
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
    const { code, nickname, avatar } = req.body as JoinRequest;

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
    const avatarValue = normalizeAvatar(avatar);

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
      res.status(410).json({ error: 'Room is not active' });
      return;
    }

    const now = new Date();
    const expiresAt = new Date(room.expires_at);

    if (expiresAt < now) {
      res.status(410).json({ error: 'Room has expired' });
      return;
    }

    const viewerHash = generateViewerHash(room.id, nicknameTrimmed);

    const existingSession = await query<{ id: string }>(
      `SELECT id FROM viewer_sessions 
       WHERE room_id = $1 AND viewer_hash = $2`,
      [room.id, viewerHash]
    );

    if (existingSession.rows.length === 0) {
      // New viewer - insert
      await query(
        `INSERT INTO viewer_sessions (room_id, viewer_hash, nickname, avatar)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [room.id, viewerHash, nicknameTrimmed, avatarValue]
      );

      // Update emoji trending stats
      await query(
        `INSERT INTO emoji_stats (emoji, use_count, last_used_at)
         VALUES ($1, 1, NOW())
         ON CONFLICT (emoji) DO UPDATE SET
           use_count = emoji_stats.use_count + 1,
           last_used_at = NOW()`,
        [avatarValue]
      );
    } else {
      // Existing viewer - update avatar if changed
      await query(
        `UPDATE viewer_sessions SET avatar = $1 WHERE room_id = $2 AND viewer_hash = $3`,
        [avatarValue, room.id, viewerHash]
      );
    }

    res.json({
      viewer_hash: viewerHash,
      room_id: room.id,
      room_code: room.code,
      allow_uploads: room.allow_uploads,
      expires_at: room.expires_at,
      nickname: nicknameTrimmed,
      avatar: avatarValue,
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
      `SELECT vs.id, vs.room_id, vs.viewer_hash, vs.nickname, vs.avatar, vs.created_at,
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
      res.status(410).json({ error: 'Room is no longer active' });
      return;
    }

    const now = new Date();
    const expiresAt = new Date(session.expires_at);

    if (expiresAt < now) {
      res.status(410).json({ error: 'Room has expired' });
      return;
    }

    res.json({
      viewer_hash: session.viewer_hash,
      room_id: session.room_id,
      room_code: session.code,
      nickname: session.nickname,
      avatar: session.avatar || DEFAULT_AVATAR,
      allow_uploads: session.allow_uploads,
      expires_at: session.expires_at,
      created_at: session.created_at,
      room: {
        id: session.room_id,
        code: session.code,
        allow_uploads: session.allow_uploads,
        expires_at: session.expires_at,
      },
    });
  } catch (error) {
    console.error('Error getting session:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

export default router;
