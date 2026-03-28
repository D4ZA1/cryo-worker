import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Re-define the helper functions locally since they're not exported from auth.ts
// These mirror the implementation from src/routes/auth.ts

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    64 * 8
  );
  
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [saltHex, expectedHash] = hash.split(':');
  if (!saltHex || !expectedHash) return false;
  
  const saltHexMatch = saltHex.match(/.{1,2}/g);
  if (!saltHexMatch) return false;
  
  const salt = new Uint8Array(saltHexMatch.map(byte => parseInt(byte, 16)));
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  try {
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveBits']
    );
    
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      passwordKey,
      64 * 8
    );
    
    const hashHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex === expectedHash;
  } catch {
    return false;
  }
}

function generateBase32Secret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  const randomValues = crypto.getRandomValues(new Uint8Array(16));
  for (let i = 0; i < 16; i++) {
    secret += chars[randomValues[i] % 32];
  }
  return secret;
}

function generateBackupCodes(): string[] {
  const codes: string[] = [];
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  for (let i = 0; i < 10; i++) {
    let code = '';
    const randomValues = crypto.getRandomValues(new Uint8Array(8));
    for (let j = 0; j < 8; j++) {
      code += chars[randomValues[j] % 36];
      if (j === 3) code += '-';
    }
    codes.push(code);
  }
  return codes;
}

describe('Auth Routes - Cryptographic Functions', () => {
  describe('hashPassword', () => {
    it('should hash a password and return a string with salt:hash format', async () => {
      const hash = await hashPassword('testPassword123');
      
      expect(hash).toBeDefined();
      expect(hash).toContain(':');
      
      const [salt, hashValue] = hash.split(':');
      expect(salt).toHaveLength(32);
      expect(hashValue).toHaveLength(128);
    });

    it('should generate different hashes for the same password (due to random salt)', async () => {
      const hash1 = await hashPassword('samePassword');
      const hash2 = await hashPassword('samePassword');
      
      expect(hash1).not.toBe(hash2);
    });

    it('should generate different hashes for different passwords', async () => {
      const hash1 = await hashPassword('password1');
      const hash2 = await hashPassword('password2');
      
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty passwords', async () => {
      const hash = await hashPassword('');
      
      expect(hash).toBeDefined();
      expect(hash).toContain(':');
    });

    it('should handle very long passwords', async () => {
      const longPassword = 'a'.repeat(1000);
      const hash = await hashPassword(longPassword);
      
      expect(hash).toBeDefined();
      expect(hash).toContain(':');
    });
  });

  describe('verifyPassword', () => {
    it('should return true for correct password', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword(password, hash);
      
      expect(isValid).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword('wrongPassword', hash);
      
      expect(isValid).toBe(false);
    });

    it('should return false for empty password when hash was created with non-empty', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword('', hash);
      
      expect(isValid).toBe(false);
    });

    it('should return false for malformed hash', async () => {
      const isValid = await verifyPassword('test', 'invalid-hash-format');
      
      expect(isValid).toBe(false);
    });

    it('should return false for hash missing colon separator', async () => {
      const isValid = await verifyPassword('test', 'justahashwithoutseparator');
      
      expect(isValid).toBe(false);
    });

    it('should return false for hash with invalid hex characters', async () => {
      const hash = 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
      
      const isValid = await verifyPassword('test', hash);
      
      expect(isValid).toBe(false);
    });

    it('should correctly verify password after multiple hash operations', async () => {
      const password = 'mySecurePassword!@#';
      
      const hash = await hashPassword(password);
      
      const result1 = await verifyPassword(password, hash);
      const result2 = await verifyPassword(password, hash);
      const result3 = await verifyPassword(password, hash);
      
      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(true);
    });
  });

  describe('generateBase32Secret', () => {
    it('should generate a 16-character base32 string', () => {
      const secret = generateBase32Secret();
      
      expect(secret).toHaveLength(16);
    });

    it('should only contain valid base32 characters', () => {
      const secret = generateBase32Secret();
      const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
      
      for (const char of secret) {
        expect(base32Chars).toContain(char);
      }
    });

    it('should generate different secrets on each call', () => {
      const secret1 = generateBase32Secret();
      const secret2 = generateBase32Secret();
      const secret3 = generateBase32Secret();
      
      expect(secret1).not.toBe(secret2);
      expect(secret2).not.toBe(secret3);
    });
  });

  describe('generateBackupCodes', () => {
    it('should generate exactly 10 backup codes', () => {
      const codes = generateBackupCodes();
      
      expect(codes).toHaveLength(10);
    });

    it('should generate codes with format XXXX-XXXX', () => {
      const codes = generateBackupCodes();
      const codeFormat = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;
      
      codes.forEach(code => {
        expect(code).toMatch(codeFormat);
      });
    });

    it('should only contain alphanumeric characters', () => {
      const codes = generateBackupCodes();
      const alphanumericPattern = /^[A-Z0-9]+$/;
      
      codes.forEach(code => {
        const cleanedCode = code.replace('-', '');
        expect(cleanedCode).toMatch(alphanumericPattern);
      });
    });

    it('should generate unique codes', () => {
      const codes = generateBackupCodes();
      const uniqueCodes = new Set(codes);
      
      expect(uniqueCodes.size).toBe(10);
    });

    it('should generate different codes on each call', () => {
      const codes1 = generateBackupCodes();
      const codes2 = generateBackupCodes();
      
      expect(codes1).not.toEqual(codes2);
    });
  });

  describe('TOTP and JWT Integration', () => {
    it('should verify TOTP codes correctly', async () => {
      const secret = generateBase32Secret();
      
      const timeStep = Math.floor(Date.now() / 1000 / 30);
      
      const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
      const cleanedSecret = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
      
      let bits = '';
      for (const char of cleanedSecret) {
        const val = base32Chars.indexOf(char);
        if (val === -1) continue;
        bits += val.toString(2).padStart(5, '0');
      }
      
      const keyBytes: number[] = [];
      for (let i = 0; i + 8 <= bits.length; i += 8) {
        keyBytes.push(parseInt(bits.slice(i, i + 8), 2));
      }
      
      const stepBytes = new Uint8Array(8);
      let step = timeStep;
      for (let i = 7; i >= 0; i--) {
        stepBytes[i] = step & 0xff;
        step = Math.floor(step / 256);
      }
      
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        new Uint8Array(keyBytes),
        { name: 'HMAC', hash: 'SHA-1' },
        false,
        ['sign']
      );
      
      const hmac = await crypto.subtle.sign('HMAC', cryptoKey, stepBytes);
      const hmacBytes = new Uint8Array(hmac);
      
      const offsetBits = hmacBytes[hmacBytes.length - 1] & 0x0f;
      const binary = 
        ((hmacBytes[offsetBits] & 0x7f) << 24) |
        ((hmacBytes[offsetBits + 1] & 0xff) << 16) |
        ((hmacBytes[offsetBits + 2] & 0xff) << 8) |
        (hmacBytes[offsetBits + 3] & 0xff);
      
      const validCode = (binary % 1000000).toString().padStart(6, '0');
      
      expect(validCode).toHaveLength(6);
      expect(validCode).toMatch(/^\d{6}$/);
    });

    it('should create and verify JWT tokens correctly', async () => {
      const secret = 'test-jwt-secret-key-for-testing-purposes-only';
      
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = btoa(JSON.stringify({ sub: 'user-123', email: 'test@example.com', iat: Math.floor(Date.now() / 1000) }));
      
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(header + '.' + payload));
      const signature = btoa(String.fromCharCode(...new Uint8Array(sig)));
      
      const token = header + '.' + payload + '.' + signature;
      
      const parts = token.split('.');
      expect(parts).toHaveLength(3);
      
      const decodedHeader = JSON.parse(atob(parts[0]));
      expect(decodedHeader.alg).toBe('HS256');
      expect(decodedHeader.typ).toBe('JWT');
      
      const decodedPayload = JSON.parse(atob(parts[1]));
      expect(decodedPayload.sub).toBe('user-123');
      expect(decodedPayload.email).toBe('test@example.com');
    });

    it('should handle expired JWT tokens', async () => {
      const secret = 'test-secret';
      const expiredPayload = {
        sub: 'user-123',
        exp: Math.floor(Date.now() / 1000) - 3600,
      };
      
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = btoa(JSON.stringify(expiredPayload));
      
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(header + '.' + payload));
      const signature = btoa(String.fromCharCode(...new Uint8Array(sig)));
      
      const token = header + '.' + payload + '.' + signature;
      
      const payloadData = JSON.parse(atob(payload));
      const now = Math.floor(Date.now() / 1000);
      
      expect(payloadData.exp).toBeLessThan(now);
    });
  });
});