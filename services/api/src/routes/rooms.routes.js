import express from 'express';
import { query } from '../db/pool.js';
import { verifyAuth } from '../middlewares/auth.js';
import { generateUniqueCode, validateCodeFormat } from '../lib/codes.js';
import { roomCreationLimiter } from '../middlewares/rateLimit.js';
import QRCode from 'qrcode';
import { config } from '../config/env.js';

const router = express.Router();

/**
 * POST /api/rooms
 * Crear una nueva sala (requiere autenticación)
 */
router.post('/', verifyAuth, roomCreationLimiter, async (req, res) => {
  try {
    const { duration, allow_uploads } = req.body;
    const userId = req.user.id;

    // Validar inputs
    if (!duration) {
      return res.status(400).json({ 
        error: 'Duration is required' 
      });
    }

    // Validar duración
    const validDurations = ['24h', '72h', '7d'];
    if (!validDurations.includes(duration)) {
      return res.status(400).json({ 
        error: 'Invalid duration. Must be one of: 24h, 72h, 7d' 
      });
    }

    // Calcular expires_at
    const now = new Date();
    let expiresAt = new Date();

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

    // Generar código único
    const code = await generateUniqueCode();

    // Crear sala
    const roomResult = await query(
      `INSERT INTO rooms (owner_id, code, expires_at, allow_uploads, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, code, expires_at, allow_uploads, is_active, created_at`,
      [userId, code, expiresAt, allow_uploads === true]
    );

    const room = roomResult.rows[0];

    // Generar link directo
    const link = `${config.frontendUrl}/room?code=${code}`;

    // Generar QR code
    let qrDataUrl = null;
    try {
      qrDataUrl = await QRCode.toDataURL(link);
    } catch (qrError) {
      console.warn('Failed to generate QR code:', qrError);
      // No fallar si el QR falla, solo continuar sin él
    }

    res.status(201).json({
      room_id: room.id,
      code: room.code,
      link: link,
      qr_data: qrDataUrl,
      expires_at: room.expires_at,
      allow_uploads: room.allow_uploads,
      duration: duration
    });

  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ 
      error: 'Failed to create room' 
    });
  }
});

/**
 * GET /api/rooms/:code
 * Validar código de sala (público, no requiere auth)
 */
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;

    // Validar formato
    if (!validateCodeFormat(code)) {
      return res.status(400).json({ 
        valid: false,
        error: 'Invalid code format' 
      });
    }

    const codeUpper = code.toUpperCase();

    // Buscar sala
    const roomResult = await query(
      `SELECT id, code, expires_at, allow_uploads, is_active
       FROM rooms 
       WHERE code = $1`,
      [codeUpper]
    );

    if (roomResult.rows.length === 0) {
      return res.json({ 
        valid: false,
        error: 'Room not found' 
      });
    }

    const room = roomResult.rows[0];

    // Verificar que esté activa
    if (!room.is_active) {
      return res.json({ 
        valid: false,
        error: 'Room is not active' 
      });
    }

    // Verificar que no haya expirado
    const now = new Date();
    const expiresAt = new Date(room.expires_at);
    
    if (expiresAt < now) {
      return res.json({ 
        valid: false,
        error: 'Room has expired' 
      });
    }

    // Sala válida
    res.json({
      valid: true,
      room_id: room.id,
      code: room.code,
      expires_at: room.expires_at,
      allow_uploads: room.allow_uploads
    });

  } catch (error) {
    console.error('Error validating room code:', error);
    res.status(500).json({ 
      valid: false,
      error: 'Failed to validate room code' 
    });
  }
});

/**
 * GET /api/rooms/:roomId
 * Obtener detalles de una sala (solo el owner)
 */
router.get('/id/:roomId', verifyAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    // Buscar sala y verificar ownership
    const roomResult = await query(
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
      return res.status(404).json({ 
        error: 'Room not found or you are not the owner' 
      });
    }

    const room = roomResult.rows[0];

    // Calcular tiempo restante
    const now = new Date();
    const expiresAt = new Date(room.expires_at);
    const timeRemaining = expiresAt - now;
    const hoursRemaining = Math.max(0, Math.floor(timeRemaining / (1000 * 60 * 60)));

    res.json({
      room_id: room.id,
      code: room.code,
      expires_at: room.expires_at,
      hours_remaining: hoursRemaining,
      allow_uploads: room.allow_uploads,
      is_active: room.is_active,
      viewer_count: parseInt(room.viewer_count) || 0,
      story_count: parseInt(room.story_count) || 0,
      created_at: room.created_at
    });

  } catch (error) {
    console.error('Error getting room details:', error);
    res.status(500).json({ 
      error: 'Failed to get room details' 
    });
  }
});

/**
 * DELETE /api/rooms/:roomId
 * Cerrar/borrar una sala (solo el owner)
 */
router.delete('/:roomId', verifyAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    // Verificar ownership y desactivar sala
    const roomResult = await query(
      `UPDATE rooms 
       SET is_active = false
       WHERE id = $1 AND owner_id = $2
       RETURNING id, code`,
      [roomId, userId]
    );

    if (roomResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Room not found or you are not the owner' 
      });
    }

    res.json({
      message: 'Room closed successfully',
      room_id: roomResult.rows[0].id,
      code: roomResult.rows[0].code
    });

  } catch (error) {
    console.error('Error closing room:', error);
    res.status(500).json({ 
      error: 'Failed to close room' 
    });
  }
});

/**
 * GET /api/rooms
 * Listar todas las salas del usuario autenticado
 */
router.get('/', verifyAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const roomsResult = await query(
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

    const rooms = roomsResult.rows.map(room => {
      const now = new Date();
      const expiresAt = new Date(room.expires_at);
      const timeRemaining = expiresAt - now;
      const hoursRemaining = Math.max(0, Math.floor(timeRemaining / (1000 * 60 * 60)));

      return {
        room_id: room.id,
        code: room.code,
        expires_at: room.expires_at,
        hours_remaining: hoursRemaining,
        allow_uploads: room.allow_uploads,
        is_active: room.is_active,
        viewer_count: parseInt(room.viewer_count) || 0,
        story_count: parseInt(room.story_count) || 0,
        created_at: room.created_at
      };
    });

    res.json({ rooms });

  } catch (error) {
    console.error('Error listing rooms:', error);
    res.status(500).json({ 
      error: 'Failed to list rooms' 
    });
  }
});

export default router;
