import crypto from 'crypto';

/**
 * Generates a hash for viewer identification
 */
export function generateViewerHash(roomId: string, nickname: string): string {
  const data = `${roomId}-${nickname}-${Date.now()}-${crypto.randomBytes(16).toString('hex')}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Validates a viewer hash format
 */
export function validateViewerHash(hash: unknown): hash is string {
  if (!hash || typeof hash !== 'string') {
    return false;
  }

  // SHA-256 produces 64 character hex string
  return /^[a-f0-9]{64}$/i.test(hash);
}
