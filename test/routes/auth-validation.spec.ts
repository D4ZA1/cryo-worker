import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import { MockD1Database, createMockEnv } from '../utils/mocks';
import type { Env } from '../../src/db/schema';

// Import schemas and constants for testing
import { RegisterInputSchema, LoginInputSchema, MfaLoginInputSchema } from '../../src/schemas';
import { ErrorCode, HTTP_STATUS } from '../../src/constants';

// Import the app for integration tests
import app from '../../src/index';

/**
 * Auth Route Validation Tests
 * Tests for email uniqueness, Zod validation, MFA login user data, and login validation
 */

// Helper: PBKDF2 hash using WebCrypto (mirrors auth.ts implementation)
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

/**
 * Helper to make requests to the test app
 */
async function makeRequest(
  env: { JWT_SECRET: string; DATABASE: D1Database },
  method: string,
  path: string,
  body?: object
): Promise<Response> {
  const request = new Request(`http://localhost${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return app.fetch(request, env);
}

describe('Auth Route Validation Tests', () => {
  describe('POST /api/auth/register - Email Uniqueness', () => {
    let mockDb: MockD1Database;
    let mockEnv: ReturnType<typeof createMockEnv>;

    beforeEach(() => {
      mockDb = new MockD1Database();
      mockEnv = createMockEnv({ DATABASE: mockDb as unknown as D1Database });
    });

    it('should return 409 CONFLICT when email already exists', async () => {
      // Simulate an existing user in the database
      const existingUserQuery = `SELECT id FROM profiles WHERE email = ?`;
      mockDb.mockQuery(existingUserQuery, [{ id: 'existing-user-id' }]);

      const response = await makeRequest(mockEnv, 'POST', '/api/auth/register', {
        email: 'existing@example.com',
        password: 'validPassword123',
        first_name: 'John',
      });
      
      expect(response.status).toBe(409);
      const json = await response.json() as { ok: boolean; error: string; code: string };
      expect(json.ok).toBe(false);
      expect(json.error).toBe('Email already registered');
      expect(json.code).toBe('EMAIL_EXISTS');
    });

    it('should return error code EMAIL_EXISTS', async () => {
      // Verify the response includes code: 'EMAIL_EXISTS'
      const existingUserQuery = `SELECT id FROM profiles WHERE email = ?`;
      mockDb.mockQuery(existingUserQuery, [{ id: 'user-123' }]);

      const response = await makeRequest(mockEnv, 'POST', '/api/auth/register', {
        email: 'test@example.com',
        password: 'validPassword123',
        first_name: 'John',
      });
      
      const json = await response.json() as { code: string };
      expect(json.code).toBe('EMAIL_EXISTS');
    });

    it('should allow registration when email does not exist', async () => {
      // Simulate no existing user
      const existingUserQuery = `SELECT id FROM profiles WHERE email = ?`;
      mockDb.mockQuery(existingUserQuery, []);

      const response = await makeRequest(mockEnv, 'POST', '/api/auth/register', {
        email: 'newuser@example.com',
        password: 'validPassword123',
        first_name: 'Jane',
        last_name: 'Doe',
      });
      
      expect(response.status).toBe(200);
      const json = await response.json() as { ok: boolean; token: string; user: { email: string; first_name: string; last_name: string } };
      expect(json.ok).toBe(true);
      expect(json.token).toBeDefined();
      expect(json.user.email).toBe('newuser@example.com');
      expect(json.user.first_name).toBe('Jane');
      expect(json.user.last_name).toBe('Doe');
    });
  });

  describe('POST /api/auth/register - Zod Validation', () => {
    let mockDb: MockD1Database;
    let mockEnv: ReturnType<typeof createMockEnv>;

    beforeEach(() => {
      mockDb = new MockD1Database();
      mockEnv = createMockEnv({ DATABASE: mockDb as unknown as D1Database });
    });

    it('should reject invalid email format', async () => {
      const response = await makeRequest(mockEnv, 'POST', '/api/auth/register', {
        email: 'notanemail',
        password: 'validPassword123',
        first_name: 'John',
      });

      expect(response.status).toBe(400);
      const json = await response.json() as { ok: boolean; error: string; code: string };
      expect(json.ok).toBe(false);
      expect(json.error).toContain('Invalid email format');
      expect(json.code).toBe('VALIDATION_ERROR');
    });

    it('should reject password shorter than 8 characters', async () => {
      const response = await makeRequest(mockEnv, 'POST', '/api/auth/register', {
        email: 'valid@example.com',
        password: '1234567', // 7 characters
        first_name: 'John',
      });

      expect(response.status).toBe(400);
      const json = await response.json() as { ok: boolean; error: string; code: string };
      expect(json.ok).toBe(false);
      expect(json.error).toContain('Password must be at least 8 characters');
      expect(json.code).toBe('VALIDATION_ERROR');
    });

    it('should reject missing first_name', async () => {
      const response = await makeRequest(mockEnv, 'POST', '/api/auth/register', {
        email: 'valid@example.com',
        password: 'validPassword123',
        // first_name is missing
      });

      expect(response.status).toBe(400);
      const json = await response.json() as { ok: boolean; code: string };
      expect(json.ok).toBe(false);
      expect(json.code).toBe('VALIDATION_ERROR');
    });

    it('should return VALIDATION_ERROR code for invalid input', async () => {
      const response = await makeRequest(mockEnv, 'POST', '/api/auth/register', {
        email: 'notanemail',
        password: 'short',
        first_name: '',
      });

      expect(response.status).toBe(400);
      const json = await response.json() as { code: string };
      expect(json.code).toBe('VALIDATION_ERROR');
    });

    it('should accept valid registration with all fields', async () => {
      // Mock no existing user
      mockDb.mockQuery(`SELECT id FROM profiles WHERE email = ?`, []);

      const response = await makeRequest(mockEnv, 'POST', '/api/auth/register', {
        email: 'valid@example.com',
        password: 'validPassword123',
        first_name: 'John',
        last_name: 'Doe',
      });

      expect(response.status).toBe(200);
      const json = await response.json() as { ok: boolean; user: { email: string; first_name: string; last_name: string } };
      expect(json.ok).toBe(true);
      expect(json.user.email).toBe('valid@example.com');
      expect(json.user.first_name).toBe('John');
      expect(json.user.last_name).toBe('Doe');
    });

    it('should accept registration without optional fields', async () => {
      // Mock no existing user
      mockDb.mockQuery(`SELECT id FROM profiles WHERE email = ?`, []);

      const response = await makeRequest(mockEnv, 'POST', '/api/auth/register', {
        email: 'valid@example.com',
        password: 'validPassword123',
        first_name: 'John',
        // last_name, public_key, encrypted_private_key are optional
      });

      expect(response.status).toBe(200);
      const json = await response.json() as { ok: boolean };
      expect(json.ok).toBe(true);
    });
  });

  describe('POST /api/auth/login - Validation', () => {
    let mockDb: MockD1Database;
    let mockEnv: ReturnType<typeof createMockEnv>;

    beforeEach(() => {
      mockDb = new MockD1Database();
      mockEnv = createMockEnv({ DATABASE: mockDb as unknown as D1Database });
    });

    it('should reject invalid email format', async () => {
      const response = await makeRequest(mockEnv, 'POST', '/api/auth/login', {
        email: 'invalid-email',
        password: 'validPassword123',
      });

      expect(response.status).toBe(400);
      const json = await response.json() as { ok: boolean; error: string; code: string };
      expect(json.ok).toBe(false);
      expect(json.error).toContain('Invalid email format');
      expect(json.code).toBe('VALIDATION_ERROR');
    });

    it('should reject missing password', async () => {
      const response = await makeRequest(mockEnv, 'POST', '/api/auth/login', {
        email: 'valid@example.com',
        // password is missing
      });

      expect(response.status).toBe(400);
      const json = await response.json() as { code: string };
      expect(json.code).toBe('VALIDATION_ERROR');
    });

    it('should return VALIDATION_ERROR code', async () => {
      const response = await makeRequest(mockEnv, 'POST', '/api/auth/login', {
        email: 'not-an-email',
        password: '',
      });

      expect(response.status).toBe(400);
      const json = await response.json() as { code: string };
      expect(json.code).toBe('VALIDATION_ERROR');
    });

    it('should reject empty password', async () => {
      const response = await makeRequest(mockEnv, 'POST', '/api/auth/login', {
        email: 'valid@example.com',
        password: '', // Empty password
      });

      expect(response.status).toBe(400);
      const json = await response.json() as { ok: boolean; error: string; code: string };
      expect(json.ok).toBe(false);
      expect(json.error).toContain('Password is required');
      expect(json.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 for non-existent user with valid input', async () => {
      // Mock no user found
      mockDb.mockQuery(
        'SELECT id, first_name, last_name, email, password_hash FROM profiles WHERE email = ?',
        []
      );

      const response = await makeRequest(mockEnv, 'POST', '/api/auth/login', {
        email: 'nonexistent@example.com',
        password: 'validPassword123',
      });

      expect(response.status).toBe(401);
      const json = await response.json() as { code: string };
      expect(json.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('POST /api/auth/mfa-login - Validation', () => {
    let mockDb: MockD1Database;
    let mockEnv: ReturnType<typeof createMockEnv>;

    beforeEach(() => {
      mockDb = new MockD1Database();
      mockEnv = createMockEnv({ DATABASE: mockDb as unknown as D1Database });
    });

    it('should reject invalid mfa_code format', async () => {
      const response = await makeRequest(mockEnv, 'POST', '/api/auth/mfa-login', {
        email: 'test@example.com',
        password: 'validPassword123',
        mfaCode: '12345', // Only 5 digits
      });

      expect(response.status).toBe(400);
      const json = await response.json() as { ok: boolean; code: string };
      expect(json.ok).toBe(false);
      expect(json.code).toBe('VALIDATION_ERROR');
    });

    it('should reject non-numeric mfa_code', async () => {
      const response = await makeRequest(mockEnv, 'POST', '/api/auth/mfa-login', {
        email: 'test@example.com',
        password: 'validPassword123',
        mfaCode: 'abcdef', // Not numeric
      });

      expect(response.status).toBe(400);
      const json = await response.json() as { ok: boolean; code: string };
      expect(json.ok).toBe(false);
      expect(json.code).toBe('VALIDATION_ERROR');
    });

    it('should reject mfa_code that is too long', async () => {
      const response = await makeRequest(mockEnv, 'POST', '/api/auth/mfa-login', {
        email: 'test@example.com',
        password: 'validPassword123',
        mfaCode: '1234567', // 7 digits
      });

      expect(response.status).toBe(400);
      const json = await response.json() as { code: string };
      expect(json.code).toBe('VALIDATION_ERROR');
    });

    it('should return first_name and last_name in response on success', async () => {
      // Create a real password hash for testing
      const passwordHash = await hashPassword('validPassword123');
      
      // Mock the user query for mfa-login
      mockDb.mockQuery(
        'SELECT id, email, first_name, last_name, password_hash, mfa_enabled, mfa_secret FROM profiles WHERE email = ?',
        [{
          id: 'user-123',
          email: 'mfauser@example.com',
          first_name: 'MFA',
          last_name: 'User',
          password_hash: passwordHash,
          mfa_enabled: 0, // MFA not enabled, so no code verification needed
          mfa_secret: null,
        }]
      );

      const response = await makeRequest(mockEnv, 'POST', '/api/auth/mfa-login', {
        email: 'mfauser@example.com',
        password: 'validPassword123',
        mfaCode: '123456',
      });

      expect(response.status).toBe(200);
      const json = await response.json() as { ok: boolean; user: { first_name: string; last_name: string } };
      expect(json.ok).toBe(true);
      expect(json.user.first_name).toBe('MFA');
      expect(json.user.last_name).toBe('User');
    });

    it('should handle user without last_name in mfa-login response', async () => {
      const passwordHash = await hashPassword('validPassword123');
      
      mockDb.mockQuery(
        'SELECT id, email, first_name, last_name, password_hash, mfa_enabled, mfa_secret FROM profiles WHERE email = ?',
        [{
          id: 'user-456',
          email: 'nolastname@example.com',
          first_name: 'Solo',
          last_name: null,
          password_hash: passwordHash,
          mfa_enabled: 0,
          mfa_secret: null,
        }]
      );

      const response = await makeRequest(mockEnv, 'POST', '/api/auth/mfa-login', {
        email: 'nolastname@example.com',
        password: 'validPassword123',
        mfaCode: '123456',
      });

      expect(response.status).toBe(200);
      const json = await response.json() as { user: { first_name: string; last_name: string | null } };
      expect(json.user.first_name).toBe('Solo');
      expect(json.user.last_name).toBeNull();
    });
  });
});

// Unit tests for Zod schemas directly
describe('Zod Schema Validation (Unit Tests)', () => {
  describe('RegisterInputSchema', () => {
    it('should reject invalid email format', () => {
      const invalidInput = {
        email: 'notanemail',
        password: 'validPassword123',
        first_name: 'John',
      };

      const result = RegisterInputSchema.safeParse(invalidInput);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid email format');
      }
    });

    it('should reject password shorter than 8 characters', () => {
      const invalidInput = {
        email: 'valid@example.com',
        password: '1234567', // 7 characters
        first_name: 'John',
      };

      const result = RegisterInputSchema.safeParse(invalidInput);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Password must be at least 8 characters');
      }
    });

    it('should reject empty first_name', () => {
      const invalidInput = {
        email: 'valid@example.com',
        password: 'validPassword123',
        first_name: '', // empty string
      };

      const result = RegisterInputSchema.safeParse(invalidInput);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        const firstNameError = result.error.issues.find(issue => 
          issue.path.includes('first_name')
        );
        expect(firstNameError).toBeDefined();
        expect(firstNameError?.message).toBe('First name is required');
      }
    });

    it('should accept valid registration input', () => {
      const validInput = {
        email: 'valid@example.com',
        password: 'validPassword123',
        first_name: 'John',
        last_name: 'Doe',
      };

      const result = RegisterInputSchema.safeParse(validInput);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('valid@example.com');
        expect(result.data.first_name).toBe('John');
        expect(result.data.last_name).toBe('Doe');
      }
    });
  });

  describe('LoginInputSchema', () => {
    it('should reject invalid email format', () => {
      const invalidInput = {
        email: 'invalid-email',
        password: 'validPassword123',
      };

      const result = LoginInputSchema.safeParse(invalidInput);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid email format');
      }
    });

    it('should reject empty password', () => {
      const invalidInput = {
        email: 'valid@example.com',
        password: '', // Empty password
      };

      const result = LoginInputSchema.safeParse(invalidInput);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        const passwordError = result.error.issues.find(issue => 
          issue.path.includes('password')
        );
        expect(passwordError).toBeDefined();
        expect(passwordError?.message).toBe('Password is required');
      }
    });

    it('should accept valid login input', () => {
      const validInput = {
        email: 'valid@example.com',
        password: 'validPassword123',
      };

      const result = LoginInputSchema.safeParse(validInput);
      
      expect(result.success).toBe(true);
    });
  });

  describe('MfaLoginInputSchema', () => {
    it('should reject invalid MFA code format (5 digits)', () => {
      const invalidInput = {
        email: 'test@example.com',
        password: 'validPassword123',
        mfa_code: '12345', // Only 5 digits
      };

      const result = MfaLoginInputSchema.safeParse(invalidInput);
      
      expect(result.success).toBe(false);
    });

    it('should reject non-numeric MFA code', () => {
      const invalidInput = {
        email: 'test@example.com',
        password: 'validPassword123',
        mfa_code: 'abcdef', // Not numeric
      };

      const result = MfaLoginInputSchema.safeParse(invalidInput);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        const mfaError = result.error.issues.find(issue => 
          issue.path.includes('mfa_code')
        );
        expect(mfaError).toBeDefined();
        expect(mfaError?.message).toContain('6 digits');
      }
    });

    it('should accept valid MFA login input', () => {
      const validInput = {
        email: 'test@example.com',
        password: 'validPassword123',
        mfa_code: '123456',
      };

      const result = MfaLoginInputSchema.safeParse(validInput);
      
      expect(result.success).toBe(true);
    });
  });
});

describe('Auth Error Codes and HTTP Status', () => {
  it('should have correct HTTP status for CONFLICT', () => {
    expect(HTTP_STATUS.CONFLICT).toBe(409);
  });

  it('should have correct HTTP status for BAD_REQUEST', () => {
    expect(HTTP_STATUS.BAD_REQUEST).toBe(400);
  });

  it('should have correct HTTP status for UNAUTHORIZED', () => {
    expect(HTTP_STATUS.UNAUTHORIZED).toBe(401);
  });

  it('should define EMAIL_EXISTS error code', () => {
    expect(ErrorCode.EMAIL_EXISTS).toBe('EMAIL_EXISTS');
  });

  it('should define VALIDATION_ERROR error code', () => {
    expect(ErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
  });

  it('should define INVALID_CREDENTIALS error code', () => {
    expect(ErrorCode.INVALID_CREDENTIALS).toBe('INVALID_CREDENTIALS');
  });

  it('should define MFA_INVALID error code', () => {
    expect(ErrorCode.MFA_INVALID).toBe('MFA_INVALID');
  });
});

describe('Login Response with User Data', () => {
  let mockDb: MockD1Database;
  let mockEnv: ReturnType<typeof createMockEnv>;

  beforeEach(() => {
    mockDb = new MockD1Database();
    mockEnv = createMockEnv({ DATABASE: mockDb as unknown as D1Database });
  });

  it('should include first_name and last_name in login response', async () => {
    const passwordHash = await hashPassword('validPassword123');
    
    mockDb.mockQuery(
      'SELECT id, first_name, last_name, email, password_hash FROM profiles WHERE email = ?',
      [{
        id: 'user-789',
        email: 'login@example.com',
        first_name: 'Alice',
        last_name: 'Smith',
        password_hash: passwordHash,
      }]
    );

    const response = await makeRequest(mockEnv, 'POST', '/api/auth/login', {
      email: 'login@example.com',
      password: 'validPassword123',
    });

    expect(response.status).toBe(200);
    const json = await response.json() as { ok: boolean; user: { first_name: string; last_name: string } };
    expect(json.ok).toBe(true);
    expect(json.user.first_name).toBe('Alice');
    expect(json.user.last_name).toBe('Smith');
  });

  it('should handle user without last_name in login response', async () => {
    const passwordHash = await hashPassword('validPassword123');
    
    mockDb.mockQuery(
      'SELECT id, first_name, last_name, email, password_hash FROM profiles WHERE email = ?',
      [{
        id: 'user-solo',
        email: 'solo@example.com',
        first_name: 'Solo',
        last_name: null,
        password_hash: passwordHash,
      }]
    );

    const response = await makeRequest(mockEnv, 'POST', '/api/auth/login', {
      email: 'solo@example.com',
      password: 'validPassword123',
    });

    expect(response.status).toBe(200);
    const json = await response.json() as { user: { first_name: string; last_name: string | null } };
    expect(json.user.first_name).toBe('Solo');
    expect(json.user.last_name).toBeNull();
  });
});
