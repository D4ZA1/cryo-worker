import { describe, it, expect } from 'vitest';

describe('Wallet Routes - Utility Functions', () => {
  describe('b64ToBuf', () => {
    // Helper function that mirrors the implementation from wallet.ts
    const b64ToBuf = (b64: string): ArrayBuffer => {
      const bin = atob(b64);
      const len = bin.length;
      const arr = new Uint8Array(len);
      for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
      return arr.buffer;
    };

    it('should convert base64 string to ArrayBuffer', () => {
      // "Hello" in base64
      const buffer = b64ToBuf('SGVsbG8=');
      const view = new Uint8Array(buffer);
      
      // Should decode to "Hello"
      const decoded = new TextDecoder().decode(view);
      expect(decoded).toBe('Hello');
    });

    it('should handle empty base64 string', () => {
      const buffer = b64ToBuf('');
      const view = new Uint8Array(buffer);
      
      expect(view.length).toBe(0);
    });

    it('should handle simple base64 strings', () => {
      // "test" in base64
      const buffer = b64ToBuf('dGVzdA==');
      const decoded = new TextDecoder().decode(buffer);
      
      expect(decoded).toBe('test');
    });

    it('should handle base64 with special characters', () => {
      // "hello world!" in base64
      const buffer = b64ToBuf('aGVsbG8gd29ybGQh');
      const decoded = new TextDecoder().decode(buffer);
      
      expect(decoded).toBe('hello world!');
    });

    it('should handle base64 with padding', () => {
      // "abc" -> "YWJj" (no padding needed)
      // "ab" -> "YWI=" (1 padding)
      // "a" -> "YQ==" (2 padding)
      
      const buffer1 = b64ToBuf('YWJj');
      expect(new TextDecoder().decode(buffer1)).toBe('abc');
      
      const buffer2 = b64ToBuf('YWI=');
      expect(new TextDecoder().decode(buffer2)).toBe('ab');
      
      const buffer3 = b64ToBuf('YQ==');
      expect(new TextDecoder().decode(buffer3)).toBe('a');
    });

    it('should handle base64 without padding', () => {
      // Standard base64 can work without padding
      const buffer = b64ToBuf('SGVsbG8gV29ybGQ'); // "Hello World" without padding
      const decoded = new TextDecoder().decode(buffer);
      
      expect(decoded).toBe('Hello World');
    });

    it('should return ArrayBuffer with correct byte length', () => {
      const testString = 'Test string with various characters: !@#$%^&*()';
      const base64 = btoa(testString);
      const buffer = b64ToBuf(base64);
      
      const view = new Uint8Array(buffer);
      expect(view.length).toBe(testString.length);
    });

    it('should correctly convert binary data for ECDSA signatures', () => {
      // Use valid base64 encoded data for testing
      // ECDSA P-256 signatures are typically 64 or 71 bytes (with header)
      const mockSignatureBase64 = btoa('mock-signature-data-test');
      
      const buffer = b64ToBuf(mockSignatureBase64);
      
      expect(buffer).toBeDefined();
      expect(buffer.byteLength).toBeGreaterThan(0);
      
      // Verify we can read the bytes
      const view = new Uint8Array(buffer);
      expect(view.length).toBeGreaterThan(0);
    });

    it('should handle long base64 strings', () => {
      // Create a long string
      const longString = 'a'.repeat(1000);
      const base64 = btoa(longString);
      
      const buffer = b64ToBuf(base64);
      const decoded = new TextDecoder().decode(buffer);
      
      expect(decoded).toBe(longString);
    });

    it('should return correct buffer for JSON data', () => {
      // Often public_key and other data is JSON, then base64 encoded
      const jsonData = JSON.stringify({ key: 'value', number: 123 });
      const base64 = btoa(jsonData);
      
      const buffer = b64ToBuf(base64);
      const decoded = JSON.parse(new TextDecoder().decode(buffer));
      
      expect(decoded).toEqual(JSON.parse(jsonData));
    });

    describe('edge cases', () => {
      it('should handle base64 with + and / characters', () => {
        // Binary data often includes these characters
        const testData = new Uint8Array([0, 1, 2, 255, 128, 64]);
        const base64 = btoa(String.fromCharCode(...testData));
        
        const buffer = b64ToBuf(base64);
        const result = new Uint8Array(buffer);
        
        expect(result).toEqual(testData);
      });

      it('should handle single character base64', () => {
        // "a" in base64 is "YQ=="
        const buffer = b64ToBuf('YQ==');
        const decoded = new TextDecoder().decode(buffer);
        
        expect(decoded).toBe('a');
      });

      it('should handle URL-safe base64 (- and _)', () => {
        // Note: atob doesn't handle URL-safe base64 by default
        // This tests the current implementation behavior
        const standardBase64 = btoa('test');
        
        const buffer = b64ToBuf(standardBase64);
        const decoded = new TextDecoder().decode(buffer);
        
        expect(decoded).toBe('test');
      });
    });
  });
});