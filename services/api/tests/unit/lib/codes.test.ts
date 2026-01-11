/**
 * Unit tests for code generation and validation
 */

import { describe, it, expect } from 'vitest';
import { generateUniqueCode, validateCodeFormat } from '../../../src/lib/codes.js';

describe('generateUniqueCode', () => {
  it('generates a code of exactly 6 characters', async () => {
    const code = await generateUniqueCode();
    expect(code).toHaveLength(6);
  });

  it('only contains uppercase letters and numbers', async () => {
    const code = await generateUniqueCode();
    expect(code).toMatch(/^[A-Z0-9]+$/);
  });

  it('does not contain ambiguous characters (0, 1, I, O)', async () => {
    const code = await generateUniqueCode();
    // The alphabet excludes: 0, 1, I, O
    expect(code).not.toMatch(/[01IO]/);
  });

  it('generates unique codes', async () => {
    const codes = await Promise.all(
      Array.from({ length: 20 }, () => generateUniqueCode())
    );
    const uniqueCodes = new Set(codes);

    // All codes should be unique (very high probability with 6-char codes)
    expect(uniqueCodes.size).toBe(codes.length);
  });
});

describe('validateCodeFormat', () => {
  it('accepts valid 6-character uppercase code', () => {
    expect(validateCodeFormat('ABC123')).toBe(true);
    expect(validateCodeFormat('ZOREM9')).toBe(true);
    expect(validateCodeFormat('999999')).toBe(true);
  });

  it('accepts valid lowercase code (converts to uppercase)', () => {
    expect(validateCodeFormat('abc123')).toBe(true);
    expect(validateCodeFormat('ZoReM9')).toBe(true);
  });

  it('rejects codes shorter than 6 characters', () => {
    expect(validateCodeFormat('ABC12')).toBe(false);
    expect(validateCodeFormat('A')).toBe(false);
    expect(validateCodeFormat('')).toBe(false);
  });

  it('rejects codes longer than 6 characters', () => {
    expect(validateCodeFormat('ABC1234')).toBe(false);
    expect(validateCodeFormat('ABCDEFG')).toBe(false);
  });

  it('rejects codes with special characters', () => {
    expect(validateCodeFormat('ABC-12')).toBe(false);
    expect(validateCodeFormat('ABC 12')).toBe(false);
    expect(validateCodeFormat('ABC!12')).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(validateCodeFormat(123456)).toBe(false);
    expect(validateCodeFormat(null)).toBe(false);
    expect(validateCodeFormat(undefined)).toBe(false);
    expect(validateCodeFormat({})).toBe(false);
    expect(validateCodeFormat([])).toBe(false);
  });

  it('rejects empty or whitespace strings', () => {
    expect(validateCodeFormat('')).toBe(false);
    expect(validateCodeFormat('      ')).toBe(false);
  });
});
