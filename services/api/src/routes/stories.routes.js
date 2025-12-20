import express from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool.js';
import { generateUploadUrl, generateMediaKey, deleteFile } from '../lib/s3.js';
import { config } from '../config/env.js';
import { verifyAuth } from '../middlewares/auth.js';
import { validateViewerHash } from '../lib/crypto.js';

const router = express.Router();

function resolveUploadContent(mediaType, requestedContentType) {
  const normalized = typeof requestedContentType === 'string'
    ? requestedContentType.toLowerCase().trim()
    : '';

  const imageTypes = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };

  const videoTypes = {
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
  };

  if (!normalized) {
    return mediaType === 'image'
      ? { contentType: 'image/jpeg', fileExtension: 'jpg' }
      : { contentType: 'video/mp4', fileExtension: 'mp4' };
  }

  if (mediaType === 'image') {
    const ext = imageTypes[normalized];
    if (!ext) {
      throw new Error('Unsupported image content_type');
    }
    return { contentType: normalized, fileExtension: ext };
  }

  if (mediaType === 'video') {
    const ext = videoTypes[normalized];
    if (!ext) {
      throw new Error('Unsupported video content_type');
    }
    return { contentType: normalized, fileExtension: ext };
  }

  throw new Error('Invalid media_type');
}

/**
 * GET /api/stories/room/:roomId
 * Listar todas las stories de una sala (orden cronológico)
 */
router.get('/room/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const viewerHash = req.query.viewer_hash || req.headers['x-viewer-hash'];

    // Verificar que la sala existe y está activa
    const roomResult = await query(
      `SELECT id, is_active, expires_at, allow_uploads
       FROM rooms 
       WHERE id = $1`,
      [roomId]
    );

    if (roomResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Room not found' 
      });
    }

    const room = roomResult.rows[0];

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

    // Obtener stories (solo las que no han expirado)
    const storiesResult = await query(
      `SELECT s.id, s.media_type, s.media_key, s.created_at, s.expires_at,
              COUNT(DISTINCT v.id) as view_count
       FROM stories s
       LEFT JOIN views v ON s.id = v.story_id
       WHERE s.room_id = $1 AND s.expires_at > NOW()
       GROUP BY s.id
       ORDER BY s.created_at ASC`,
      [roomId]
    );

    // Si hay viewer_hash, marcar cuáles ya fueron vistas
    let viewedStoryIds = [];
    if (viewerHash && validateViewerHash(viewerHash)) {
      const viewsResult = await query(
        `SELECT story_id FROM views WHERE viewer_hash = $1`,
        [viewerHash]
      );
      viewedStoryIds = viewsResult.rows.map(row => row.story_id);
    }

    const stories = storiesResult.rows.map(story => {
      // Construir URL del media (asumiendo que S3/R2 está configurado)
      // En producción, esto debería ser una URL pública o presigned URL
      let mediaUrl = null;
      if (config.s3BucketName) {
        if (config.storageType === 'r2' && config.r2Endpoint) {
          // Para R2, construir URL pública
          const endpoint = config.r2Endpoint.replace(/\/$/, ''); // Remove trailing slash
          mediaUrl = `${endpoint}/${story.media_key}`;
        } else {
          // Para S3, usar el formato estándar
          mediaUrl = `https://${config.s3BucketName}.s3.${config.awsRegion}.amazonaws.com/${story.media_key}`;
        }
      } else {
        // Si no hay storage configurado, devolver null (el frontend manejará esto)
        mediaUrl = null;
      }

      return {
        id: story.id,
        media_type: story.media_type,
        media_url: mediaUrl,
        media_key: story.media_key,
        created_at: story.created_at,
        expires_at: story.expires_at,
        view_count: parseInt(story.view_count) || 0,
        viewed: viewedStoryIds.includes(story.id)
      };
    });

    res.json({
      room_id: roomId,
      allow_uploads: room.allow_uploads,
      stories: stories,
      total: stories.length
    });

  } catch (error) {
    console.error('Error getting stories:', error);
    res.status(500).json({ 
      error: 'Failed to get stories' 
    });
  }
});

/**
 * POST /api/stories/upload-url
 * Obtener presigned URL para subir un archivo
 * Requiere autenticación si es creator, o viewer_hash si es viewer
 */
router.post('/upload-url', async (req, res) => {
  try {
    const { room_id, media_type, file_size, content_type } = req.body;
    const authHeader = req.headers.authorization;
    const viewerHash = req.body.viewer_hash || req.headers['x-viewer-hash'];

    // Validar inputs
    if (!room_id || !media_type) {
      return res.status(400).json({ 
        error: 'room_id and media_type are required' 
      });
    }

    if (!['image', 'video'].includes(media_type)) {
      return res.status(400).json({ 
        error: 'media_type must be "image" or "video"' 
      });
    }

    // Validar tamaño de archivo (máx 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file_size && file_size > maxSize) {
      return res.status(400).json({ 
        error: 'File size exceeds maximum of 50MB' 
      });
    }

    // Verificar permisos: debe ser owner o viewer con allow_uploads
    const roomResult = await query(
      `SELECT id, owner_id, allow_uploads, is_active, expires_at
       FROM rooms 
       WHERE id = $1`,
      [room_id]
    );

    if (roomResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Room not found' 
      });
    }

    const room = roomResult.rows[0];

    if (!room.is_active) {
      return res.status(403).json({ 
        error: 'Room is not active' 
      });
    }

    // Verificar expiración
    const now = new Date();
    const expiresAt = new Date(room.expires_at);
    if (expiresAt < now) {
      return res.status(403).json({ 
        error: 'Room has expired' 
      });
    }

    let hasPermission = false;

    // Verificar si es el owner (con auth token)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        // Verificar token
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, config.jwtSecret);
        
        if (decoded.userId === room.owner_id) {
          hasPermission = true;
        }
      } catch (tokenError) {
        // Token inválido, continuar con verificación de viewer
      }
    }

    // Verificar si es viewer con permisos
    if (!hasPermission && viewerHash) {
      if (!room.allow_uploads) {
        return res.status(403).json({ 
          error: 'Room does not allow viewer uploads' 
        });
      }

      // Verificar que el viewer_hash existe en esta sala
      const viewerResult = await query(
        `SELECT id FROM viewer_sessions 
         WHERE room_id = $1 AND viewer_hash = $2`,
        [room_id, viewerHash]
      );

      if (viewerResult.rows.length > 0) {
        hasPermission = true;
      }
    }

    if (!hasPermission) {
      return res.status(403).json({ 
        error: 'Permission denied. Must be room owner or authorized viewer' 
      });
    }

    let uploadContent;
    try {
      uploadContent = resolveUploadContent(media_type, content_type);
    } catch (err) {
      return res.status(400).json({
        error: err.message || 'Invalid content_type'
      });
    }

    const mediaKey = generateMediaKey(room_id, media_type, uploadContent.fileExtension);
    const contentType = uploadContent.contentType;

    // Generar presigned URL
    if (!config.awsAccessKeyId || !config.s3BucketName) {
      return res.status(503).json({ 
        error: 'Storage not configured' 
      });
    }

    const uploadUrl = await generateUploadUrl(mediaKey, contentType, 300); // 5 minutos

    // Calcular expires_at para la story (mismo que la sala)
    res.json({
      upload_url: uploadUrl,
      media_key: mediaKey,
      expires_in: 300, // 5 minutos para subir
      room_expires_at: room.expires_at
    });

  } catch (error) {
    console.error('Error generating upload URL:', error);
    res.status(500).json({ 
      error: 'Failed to generate upload URL' 
    });
  }
});

/**
 * POST /api/stories
 * Confirmar upload y crear story en la base de datos
 */
router.post('/', async (req, res) => {
  try {
    const { room_id, media_key, media_type } = req.body;
    const authHeader = req.headers.authorization;
    const viewerHash = req.body.viewer_hash || req.headers['x-viewer-hash'];

    // Validar inputs
    if (!room_id || !media_key || !media_type) {
      return res.status(400).json({ 
        error: 'room_id, media_key, and media_type are required' 
      });
    }

    if (!['image', 'video'].includes(media_type)) {
      return res.status(400).json({ 
        error: 'media_type must be "image" or "video"' 
      });
    }

    // Verificar permisos (misma lógica que upload-url)
    const roomResult = await query(
      `SELECT id, owner_id, allow_uploads, is_active, expires_at
       FROM rooms 
       WHERE id = $1`,
      [room_id]
    );

    if (roomResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Room not found' 
      });
    }

    const room = roomResult.rows[0];

    if (!room.is_active) {
      return res.status(403).json({ 
        error: 'Room is not active' 
      });
    }

    // Verificar expiración
    const now = new Date();
    const expiresAt = new Date(room.expires_at);
    if (expiresAt < now) {
      return res.status(403).json({ 
        error: 'Room has expired' 
      });
    }

    let hasPermission = false;

    // Verificar si es el owner
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const jwt = await import('jsonwebtoken');
        const decoded = jwt.default.verify(token, config.jwtSecret);
        
        if (decoded.userId === room.owner_id) {
          hasPermission = true;
        }
      } catch (tokenError) {
        // Token inválido
      }
    }

    // Verificar si es viewer con permisos
    if (!hasPermission && viewerHash) {
      if (!room.allow_uploads) {
        return res.status(403).json({ 
          error: 'Room does not allow viewer uploads' 
        });
      }

      const viewerResult = await query(
        `SELECT id FROM viewer_sessions 
         WHERE room_id = $1 AND viewer_hash = $2`,
        [room_id, viewerHash]
      );

      if (viewerResult.rows.length > 0) {
        hasPermission = true;
      }
    }

    if (!hasPermission) {
      return res.status(403).json({ 
        error: 'Permission denied' 
      });
    }

    // Crear story (expira cuando expire la sala)
    const storyResult = await query(
      `INSERT INTO stories (room_id, media_type, media_key, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id, room_id, media_type, media_key, created_at, expires_at`,
      [room_id, media_type, media_key, room.expires_at]
    );

    const story = storyResult.rows[0];

    res.status(201).json({
      id: story.id,
      room_id: story.room_id,
      media_type: story.media_type,
      media_key: story.media_key,
      created_at: story.created_at,
      expires_at: story.expires_at
    });

  } catch (error) {
    console.error('Error creating story:', error);
    res.status(500).json({ 
      error: 'Failed to create story' 
    });
  }
});

/**
 * POST /api/stories/:storyId/view
 * Registrar que un viewer vio una story
 */
router.post('/:storyId/view', async (req, res) => {
  try {
    const { storyId } = req.params;
    const { viewer_hash } = req.body;

    if (!viewer_hash) {
      return res.status(400).json({ 
        error: 'viewer_hash is required' 
      });
    }

    if (!validateViewerHash(viewer_hash)) {
      return res.status(400).json({ 
        error: 'Invalid viewer_hash format' 
      });
    }

    // Verificar que la story existe
    const storyResult = await query(
      `SELECT s.id, s.room_id, s.expires_at
       FROM stories s
       WHERE s.id = $1`,
      [storyId]
    );

    if (storyResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Story not found' 
      });
    }

    const story = storyResult.rows[0];

    // Verificar que no haya expirado
    const now = new Date();
    const expiresAt = new Date(story.expires_at);
    if (expiresAt < now) {
      return res.status(403).json({ 
        error: 'Story has expired' 
      });
    }

    // Verificar que el viewer_hash pertenece a la sala de la story
    const viewerResult = await query(
      `SELECT id FROM viewer_sessions 
       WHERE room_id = $1 AND viewer_hash = $2`,
      [story.room_id, viewer_hash]
    );

    if (viewerResult.rows.length === 0) {
      return res.status(403).json({ 
        error: 'Invalid viewer for this room' 
      });
    }

    // Insertar view (ignorar si ya existe gracias al unique constraint)
    try {
      await query(
        `INSERT INTO views (story_id, viewer_hash)
         VALUES ($1, $2)
         ON CONFLICT (story_id, viewer_hash) DO NOTHING`,
        [storyId, viewer_hash]
      );

      res.json({
        message: 'View recorded',
        story_id: storyId
      });
    } catch (error) {
      // Si ya existe, está bien
      if (error.code === '23505') { // Unique violation
        res.json({
          message: 'View already recorded',
          story_id: storyId
        });
      } else {
        throw error;
      }
    }

  } catch (error) {
    console.error('Error recording view:', error);
    res.status(500).json({ 
      error: 'Failed to record view' 
    });
  }
});

export default router;
