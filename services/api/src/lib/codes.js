import { customAlphabet } from 'nanoid';
import { query } from '../db/pool.js';

// Custom alphabet: uppercase letters and numbers, excluding ambiguous characters
// Excludes: 0, O, I, 1 to avoid confusion
const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const generateCode = customAlphabet(alphabet, 6);

/**
 * Generates a unique room code
 * @returns {Promise<string>} A unique 6-character code
 */
export async function generateUniqueCode() {
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    const code = generateCode();
    
    // Check if code already exists
    const result = await query(
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
 * @param {string} code - The code to validate
 * @returns {boolean} True if valid format
 */
export function validateCodeFormat(code) {
  if (!code || typeof code !== 'string') {
    return false;
  }
  
  // Must be exactly 6 characters, alphanumeric
  const codeRegex = /^[A-Z0-9]{6}$/;
  return codeRegex.test(code.toUpperCase());
}
