import { customAlphabet } from 'nanoid';
import { query } from '../db/pool.js';

// Custom alphabet: uppercase letters and numbers, excluding ambiguous characters
const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const generateCode = customAlphabet(alphabet, 6);

/**
 * Generates a unique room code
 */
export async function generateUniqueCode(): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const code = generateCode();

    const result = await query<{ id: string }>(
      'SELECT id FROM rooms WHERE code = $1',
      [code]
    );

    if (result.rows.length === 0) {
      return code;
    }

    attempts++;
  }

  throw new Error('Failed to generate unique code after multiple attempts');
}

/**
 * Validates a room code format
 */
export function validateCodeFormat(code: unknown): code is string {
  if (!code || typeof code !== 'string') {
    return false;
  }

  const codeRegex = /^[A-Z0-9]{6}$/;
  return codeRegex.test(code.toUpperCase());
}
