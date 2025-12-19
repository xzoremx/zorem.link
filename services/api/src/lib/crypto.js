import crypto from 'crypto';

/**
 * Generates a hash for viewer identification
 * Uses a combination of room_id, timestamp, and random data
 * @param {string} roomId - The room ID
 * @param {string} nickname - The viewer's nickname
 * @returns {string} A SHA-256 hash
 */
export function generateViewerHash(roomId, nickname) {
  const data = `${roomId}-${nickname}-${Date.now()}-${crypto.randomBytes(16).toString('hex')}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Validates a viewer hash format
 * @param {string} hash - The hash to validate
 * @returns {boolean} True if valid format
 */
export function validateViewerHash(hash) {
  if (!hash || typeof hash !== 'string') {
    return false;
  }
  
  // SHA-256 produces 64 character hex string
  return /^[a-f0-9]{64}$/i.test(hash);
}
