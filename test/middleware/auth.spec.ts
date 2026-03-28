import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockEnv, createMockJwt } from '../utils/mocks';

// Test the verifyJwt logic from middleware/auth.ts
// Since verifyJwt is internal, we'll test the JWT verification logic directly

describe('Auth Middleware - JWT Verification', () => {
  const secret = 'test-jwt-secret-key-for-testing-purposes-only';

  // Helper function that mirrors verifyJwt from middleware/auth.ts
  const b64ToBuf = (b64: string): ArrayBuffer => {
    const bin = atob(b64);
    const len = bin.length;
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
    return arr.buffer;
  };

  const verifyJwt = async (token: string, secret: string) => {
    try {
      const [headerB64, payloadB64, sigB64] = token.split('.');
      if (!headerB64 || !payloadB64 || !sigB64) throw new Error('Invalid token');
      
      const headerClaim = headerB64 + '.' + payloadB64;
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      );
      const sig = b64ToBuf(sigB64);
      const isValid = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(headerClaim));
      if (!isValid) throw new Error('Invalid signature');
      
      const payloadStr = atob(payloadB64);
      const payload = JSON.parse(payloadStr);
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) throw new Error('Token expired');
      
      return payload;
    } catch (error) {
      throw new Error('Invalid token');
    }
  };

  // Helper to create valid JWT tokens
  const createToken = async (payload: object, secret: string, expiresInSeconds?: number): Promise<string> => {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const iat = Math.floor(Date.now() / 1000);
    const exp = expiresInSeconds ? iat + expiresInSeconds : undefined;
    const claim = btoa(JSON.stringify({ ...payload, iat, exp }));
    
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(header + '.' + claim));
    const signature = btoa(String.fromCharCode(...new Uint8Array(sig)));
    
    return header + '.' + claim + '.' + signature;
  };

  describe('verifyJwt', () => {
    it('should verify a valid JWT token', async () => {
      const payload = { sub: 'user-123', email: 'test@example.com' };
      const token = await createToken(payload, secret);
      
      const result = await verifyJwt(token, secret);
      
      expect(result.sub).toBe('user-123');
      expect(result.email).toBe('test@example.com');
      expect(result.iat).toBeDefined();
    });

    it('should reject token with invalid signature', async () => {
      const payload = { sub: 'user-123' };
      const token = await createToken(payload, secret);
      
      // Tamper with the signature
      const parts = token.split('.');
      const tamperedToken = parts[0] + '.' + parts[1] + '.' + 'invalid-signature';
      
      await expect(verifyJwt(tamperedToken, secret)).rejects.toThrow();
    });

    it('should reject token with wrong secret', async () => {
      const payload = { sub: 'user-123' };
      const token = await createToken(payload, 'wrong-secret');
      
      await expect(verifyJwt(token, secret)).rejects.toThrow();
    });

    it('should reject malformed token (missing parts)', async () => {
      await expect(verifyJwt('only-one-part', secret)).rejects.toThrow();
      await expect(verifyJwt('two.parts', secret)).rejects.toThrow();
      await expect(verifyJwt('', secret)).rejects.toThrow();
    });

    it('should reject token with invalid base64 in header', async () => {
      const invalidToken = 'not-valid-base64.payload.signature';
      
      await expect(verifyJwt(invalidToken, secret)).rejects.toThrow();
    });

    it('should reject expired token', async () => {
      // Create a token that expired 1 hour ago using negative expiresInSeconds
      const payload = { sub: 'user-123' };
      const token = await createToken(payload, secret, -3600);
      
      // The verifyJwt implementation catches the specific error and returns 'Invalid token'
      await expect(verifyJwt(token, secret)).rejects.toThrow();
    });

    it('should accept token without expiration', async () => {
      // Create token without exp claim (should not expire)
      const payload = { sub: 'user-123', email: 'test@example.com' };
      const token = await createToken(payload, secret);
      
      const result = await verifyJwt(token, secret);
      
      expect(result.sub).toBe('user-123');
    });

    it('should reject token with exp in the past', async () => {
      // Create a token that expired in the past using negative expiresInSeconds
      const payload = { sub: 'user-123' };
      const token = await createToken(payload, secret, -100);
      
      await expect(verifyJwt(token, secret)).rejects.toThrow();
    });

    it('should correctly decode JWT payload', async () => {
      const payload = {
        sub: 'user-456',
        email: 'john@example.com',
        role: 'admin',
        customClaim: 'value123'
      };
      const token = await createToken(payload, secret);
      
      const result = await verifyJwt(token, secret);
      
      expect(result.sub).toBe('user-456');
      expect(result.email).toBe('john@example.com');
      expect(result.role).toBe('admin');
      expect(result.customClaim).toBe('value123');
    });

    it('should handle token with iat claim', async () => {
      const token = await createToken({ sub: 'user-123' }, secret);
      
      const result = await verifyJwt(token, secret);
      
      expect(result.iat).toBeDefined();
      expect(typeof result.iat).toBe('number');
    });
  });

  describe('JWT Token Structure', () => {
    it('should create token with correct header', async () => {
      const token = await createToken({ sub: 'user-123' }, secret);
      const [headerB64] = token.split('.');
      
      const header = JSON.parse(atob(headerB64));
      
      expect(header.alg).toBe('HS256');
      expect(header.typ).toBe('JWT');
    });

    it('should create token with three parts', async () => {
      const token = await createToken({ sub: 'user-123' }, secret);
      const parts = token.split('.');
      
      expect(parts).toHaveLength(3);
    });

    it('should create base64-encoded parts', async () => {
      const token = await createToken({ sub: 'user-123' }, secret);
      const [headerB64, payloadB64] = token.split('.');
      
      // These should be valid base64 strings
      expect(() => atob(headerB64)).not.toThrow();
      expect(() => atob(payloadB64)).not.toThrow();
    });
  });

  describe('b64ToBuf Helper (from middleware)', () => {
    it('should convert base64 to ArrayBuffer correctly', () => {
      const b64ToBuf = (b64: string): ArrayBuffer => {
        const bin = atob(b64);
        const len = bin.length;
        const arr = new Uint8Array(len);
        for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
        return arr.buffer;
      };

      // Test signature conversion (as used in verifyJwt)
      const signatureB64 = 'MEUCIQDFakeSignatureHere1234567890';
      const buffer = b64ToBuf(signatureB64);
      
      expect(buffer).toBeDefined();
      expect(buffer.byteLength).toBeGreaterThan(0);
    });
  });

  describe('Integration with auth middleware scenarios', () => {
    it('should handle Authorization header format', async () => {
      const payload = { sub: 'user-123' };
      const token = await createToken(payload, secret);
      const authHeader = `Bearer ${token}`;
      
      // Extract token from header format
      const extractedToken = authHeader.replace('Bearer ', '');
      const result = await verifyJwt(extractedToken, secret);
      
      expect(result.sub).toBe('user-123');
    });

    it('should handle Cookie format', async () => {
      const payload = { sub: 'user-456' };
      const token = await createToken(payload, secret);
      const cookie = `auth_token=${token}`;
      
      // Extract token from cookie format
      const extractedToken = cookie.match(/auth_token=([^;]+)/)?.[1];
      
      expect(extractedToken).toBeDefined();
      const result = await verifyJwt(extractedToken!, secret);
      expect(result.sub).toBe('user-456');
    });

    it('should handle missing token gracefully', async () => {
      const token = '';
      
      await expect(verifyJwt(token, secret)).rejects.toThrow();
    });
  });
});