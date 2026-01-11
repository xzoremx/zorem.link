/**
 * Unit tests for crypto utilities
 */

import { describe, it, expect } from 'vitest';
import { generateViewerHash, validateViewerHash } from '../../../src/lib/crypto.js';

describe('generateViewerHash', () => {
  it('generates a 64-character hex string (SHA-256)', () => {
    const hash = generateViewerHash('room123', 'TestUser');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('generates different hashes for same inputs (due to timestamp and random bytes)', () => {
    const hash1 = generateViewerHash('room123', 'TestUser');
    const hash2 = generateViewerHash('room123', 'TestUser');

    // Should be different due to timestamp and random bytes
    expect(hash1).not.toBe(hash2);
  });

  it('generates different hashes for different room IDs', () => {
    const hash1 = generateViewerHash('room1', 'TestUser');
    const hash2 = generateViewerHash('room2', 'TestUser');

    expect(hash1).not.toBe(hash2);
  });

  it('generates different hashes for different nicknames', () => {
    const hash1 = generateViewerHash('room123', 'Alice');
    const hash2 = generateViewerHash('room123', 'Bob');

    expect(hash1).not.toBe(hash2);
  });

  it('handles special characters in inputs', () => {
    const hash = generateViewerHash('room-123', 'User Name 🎉');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('validateViewerHash', () => {
  it('accepts valid 64-character hex string', () => {
    const validHash = 'a'.repeat(64);
    expect(validateViewerHash(validHash)).toBe(true);
  });

  it('accepts valid hash with mixed hex characters', () => {
    const validHash = '0123456789abcdef'.repeat(4); // 64 chars
    expect(validateViewerHash(validHash)).toBe(true);
  });

  it('accepts both lowercase and uppercase hex', () => {
    const lowercase = 'a'.repeat(64);
    const uppercase = 'A'.repeat(64);

    expect(validateViewerHash(lowercase)).toBe(true);
    expect(validateViewerHash(uppercase)).toBe(true);
  });

  it('rejects hash shorter than 64 characters', () => {
    expect(validateViewerHash('a'.repeat(63))).toBe(false);
    expect(validateViewerHash('abc123')).toBe(false);
  });

  it('rejects hash longer than 64 characters', () => {
    expect(validateViewerHash('a'.repeat(65))).toBe(false);
    expect(validateViewerHash('a'.repeat(128))).toBe(false);
  });

  it('rejects non-hex characters', () => {
    const invalidHash = 'g'.repeat(64); // 'g' is not a valid hex character
    expect(validateViewerHash(invalidHash)).toBe(false);

    const withSpecialChars = 'a'.repeat(63) + '!';
    expect(validateViewerHash(withSpecialChars)).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(validateViewerHash(123456)).toBe(false);
    expect(validateViewerHash(null)).toBe(false);
    expect(validateViewerHash(undefined)).toBe(false);
    expect(validateViewerHash({})).toBe(false);
    expect(validateViewerHash([])).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateViewerHash('')).toBe(false);
  });

  it('validates actual generated hashes', () => {
    const hash = generateViewerHash('room123', 'TestUser');
    expect(validateViewerHash(hash)).toBe(true);
  });
});
