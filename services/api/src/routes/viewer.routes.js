import express from 'express';
import { query } from '../db/pool.js';
import { generateViewerHash, validateViewerHash } from '../lib/crypto.js';
import { validateCodeFormat } from '../lib/codes.js';

const router = express.Router();

/**
 * POST /api/viewer/join
 * Unirse a una sala con código y nickname
 */
router.post('/join', async (req, res) => {
  try {
    const { code, nickname } = req.body;

    // Validar inputs
    if (!code || !nickname) {
      return res.status(400).json({ 
        error: 'Code and nickname are required' 
      });
    }

    // Validar formato del código
    if (!validateCodeFormat(code)) {
      return res.status(400).json({ 
        error: 'Invalid code format. Code must be 6 alphanumeric characters' 
      });
    }

    // Validar nickname
    if (typeof nickname !== 'string' || nickname.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Nickname must be a non-empty string' 
      });
    }

    if (nickname.length > 50) {
      return res.status(400).json({ 
        error: 'Nickname must be 50 characters or less' 
      });
    }

    const codeUpper = code.toUpperCase().trim();
    const nicknameTrimmed = nickname.trim();

    // Buscar sala por código
    const roomResult = await query(
      `SELECT id, owner_id, code, expires_at, allow_uploads, is_active, created_at
       FROM rooms 
       WHERE code = $1`,
      [codeUpper]
    );

    if (roomResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Room not found' 
      });
    }

    const room = roomResult.rows[0];

    // Verificar que la sala esté activa
    if (!room.is_active) {
      return res.status(403).json({ 
        error: 'Room is not active' 
      });
    }

    // Verificar que no haya expirado
    const now = new Date();
    const expiresAt = new Date(room.expires_at);
    
    if (expiresAt < now) {
      return res.status(403).json({ 
        error: 'Room has expired' 
      });
    }

    // Generar viewer_hash único para este viewer en esta sala
    const viewerHash = generateViewerHash(room.id, nicknameTrimmed);

    // Verificar si ya existe una sesión con este hash en esta sala
    const existingSession = await query(
      `SELECT id FROM viewer_sessions 
       WHERE room_id = $1 AND viewer_hash = $2`,
      [room.id, viewerHash]
    );

    let sessionId;

    if (existingSession.rows.length > 0) {
      // Sesión ya existe, usar la existente
      sessionId = existingSession.rows[0].id;
    } else {
      // Crear nueva sesión
      const sessionResult = await query(
        `INSERT INTO viewer_sessions (room_id, viewer_hash, nickname)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [room.id, viewerHash, nicknameTrimmed]
      );
      sessionId = sessionResult.rows[0].id;
    }

    // Responder con información de la sesión
    res.json({
      viewer_hash: viewerHash,
      room_id: room.id,
      room_code: room.code,
      allow_uploads: room.allow_uploads,
      expires_at: room.expires_at,
      nickname: nicknameTrimmed
    });

  } catch (error) {
    console.error('Error joining room:', error);
    res.status(500).json({ 
      error: 'Failed to join room' 
    });
  }
});

/**
 * GET /api/viewer/session
 * Obtener información de la sesión actual
 * Requiere viewer_hash en query params o header
 */
router.get('/session', async (req, res) => {
  try {
    const viewerHash = req.query.viewer_hash || req.headers['x-viewer-hash'];

    if (!viewerHash) {
      return res.status(400).json({ 
        error: 'viewer_hash is required' 
      });
    }

    if (!validateViewerHash(viewerHash)) {
      return res.status(400).json({ 
        error: 'Invalid viewer_hash format' 
      });
    }

    // Buscar sesión
    const sessionResult = await query(
      `SELECT vs.id, vs.room_id, vs.viewer_hash, vs.nickname, vs.created_at,
              r.code, r.allow_uploads, r.is_active, r.expires_at
       FROM viewer_sessions vs
       JOIN rooms r ON vs.room_id = r.id
       WHERE vs.viewer_hash = $1`,
      [viewerHash]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Session not found' 
      });
    }

    const session = sessionResult.rows[0];

    // Verificar que la sala siga activa
    if (!session.is_active) {
      return res.status(403).json({ 
        error: 'Room is no longer active' 
      });
    }

    // Verificar que no haya expirado
    const now = new Date();
    const expiresAt = new Date(session.expires_at);
    
    if (expiresAt < now) {
      return res.status(403).json({ 
        error: 'Room has expired' 
      });
    }

    res.json({
      viewer_hash: session.viewer_hash,
      room_id: session.room_id,
      room_code: session.code,
      nickname: session.nickname,
      allow_uploads: session.allow_uploads,
      expires_at: session.expires_at,
      created_at: session.created_at
    });

  } catch (error) {
    console.error('Error getting session:', error);
    res.status(500).json({ 
      error: 'Failed to get session' 
    });
  }
});

export default router;
