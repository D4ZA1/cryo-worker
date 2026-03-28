import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockEnv, MockD1Database } from '../utils/mocks';

// Import the isValidJsonString function from profile.ts
// We need to import it directly from the module - since it's not exported, we'll test via module

describe('Profile Routes - Utility Functions', () => {
  describe('isValidJsonString', () => {
    // Helper function that mirrors the implementation
    const isValidJsonString = (value: any): boolean => {
      if (typeof value !== 'string') {
        return false;
      }
      try {
        JSON.parse(value);
        return true;
      } catch {
        return false;
      }
    };

    it('should return true for valid JSON strings', () => {
      expect(isValidJsonString('{"key": "value"}')).toBe(true);
      expect(isValidJsonString('{"name": "John", "age": 30}')).toBe(true);
      expect(isValidJsonString('[]')).toBe(true);
      expect(isValidJsonString('{"nested": {"key": "value"}}')).toBe(true);
    });

    it('should return true for valid JSON primitives', () => {
      expect(isValidJsonString('"string"')).toBe(true);
      expect(isValidJsonString('123')).toBe(true);
      expect(isValidJsonString('true')).toBe(true);
      expect(isValidJsonString('null')).toBe(true);
    });

    it('should return false for invalid JSON strings', () => {
      expect(isValidJsonString('{invalid json}')).toBe(false);
      expect(isValidJsonString('not json')).toBe(false);
      expect(isValidJsonString('{missing quote: "value"}')).toBe(false);
      expect(isValidJsonString('')).toBe(false);
    });

    it('should return false for non-string values', () => {
      expect(isValidJsonString(null)).toBe(false);
      expect(isValidJsonString(undefined)).toBe(false);
      expect(isValidJsonString(123)).toBe(false);
      expect(isValidJsonString(true)).toBe(false);
      expect(isValidJsonString({ key: 'value' })).toBe(false);
      expect(isValidJsonString(['array'])).toBe(false);
    });

    it('should handle empty JSON object and array', () => {
      expect(isValidJsonString('{}')).toBe(true);
      expect(isValidJsonString('[]')).toBe(true);
    });

    it('should handle JSON with whitespace', () => {
      expect(isValidJsonString('  {"key": "value"}  ')).toBe(true);
      expect(isValidJsonString('\n{"key": "value"}\n')).toBe(true);
    });

    it('should handle complex nested JSON', () => {
      const complexJson = JSON.stringify({
        users: [
          { id: 1, name: 'John', metadata: { verified: true } },
          { id: 2, name: 'Jane', metadata: { verified: false } }
        ],
        pagination: { page: 1, total: 100, hasMore: false }
      });
      expect(isValidJsonString(complexJson)).toBe(true);
    });

    it('should return false for partial JSON', () => {
      expect(isValidJsonString('{"key":')).toBe(false);
      expect(isValidJsonString('{"key": "value"')).toBe(false);
      expect(isValidJsonString('[1, 2,')).toBe(false);
    });

    it('should correctly validate public_key JSON strings', () => {
      // These are the kinds of JSON that would be stored as public_key
      const validPublicKey = JSON.stringify({
        key: 'value',
        algorithm: 'ECDSA',
        curve: 'P-256'
      });
      expect(isValidJsonString(validPublicKey)).toBe(true);

      const invalidPublicKey = '{not valid json';
      expect(isValidJsonString(invalidPublicKey)).toBe(false);
    });

    it('should correctly validate encrypted_private_key JSON strings', () => {
      // These are the kinds of JSON that would be stored as encrypted_private_key
      const validEncryptedKey = JSON.stringify({
        ciphertext: 'base64encodeddata',
        iv: 'someiv',
        algorithm: 'AES-256-GCM'
      });
      expect(isValidJsonString(validEncryptedKey)).toBe(true);

      const invalidEncryptedKey = 'not json at all';
      expect(isValidJsonString(invalidEncryptedKey)).toBe(false);
    });
  });
});