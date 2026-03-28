import { describe, it, expect } from 'vitest';
import {
  // Auth schemas
  RegisterInputSchema,
  LoginInputSchema,
  MfaLoginInputSchema,
  SendOtpInputSchema,
  VerifyOtpInputSchema,
  ChangePasswordInputSchema,
  MfaVerifyInputSchema,
  MfaDisableInputSchema,
  UserSchema,
  RegisterOutputSchema,
  LoginOutputSchema,
  MfaEnableOutputSchema,
  MfaVerifyOutputSchema,
  // Profile schemas
  ProfileOutputSchema,
  ProfileUpdateInputSchema,
  ProfileSearchInputSchema,
  ProfileSearchOutputSchema,
  // Wallet schemas
  WalletOutputSchema,
  WalletSaveInputSchema,
  WalletVerifyInputSchema,
  // Block/Transaction schemas
  TransactionKindEnum,
  PublicSummarySchema,
  EncryptedBlobSchema,
  BlockDataSchema,
  BlockInputSchema,
  BlockOutputSchema,
  BlockRawOutputSchema,
  // Contact schemas
  ContactInputSchema,
  ContactUpdateInputSchema,
  ContactOutputSchema,
  // Generic schemas
  ApiSuccessSchema,
  ApiErrorSchema,
  PaginationSchema,
  createApiResponseSchema,
} from '../../src/schemas';
import { z } from 'zod';

// ============================================================================
// AUTH SCHEMAS
// ============================================================================

describe('Auth Schemas', () => {
  describe('RegisterInputSchema', () => {
    it('should accept valid registration data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'password123',
        first_name: 'John',
        last_name: 'Doe',
      };
      const result = RegisterInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    it('should require email', () => {
      const invalidData = {
        password: 'password123',
        first_name: 'John',
      };
      const result = RegisterInputSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.path.includes('email'))).toBe(true);
      }
    });

    it('should require valid email format', () => {
      const invalidData = {
        email: 'not-an-email',
        password: 'password123',
        first_name: 'John',
      };
      const result = RegisterInputSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.message === 'Invalid email format')).toBe(true);
      }
    });

    it('should require password with minimum 8 characters', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'short',
        first_name: 'John',
      };
      const result = RegisterInputSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.path.includes('password'))).toBe(true);
      }
    });

    it('should require first_name', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'password123',
      };
      const result = RegisterInputSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.path.includes('first_name'))).toBe(true);
      }
    });

    it('should require first_name to be non-empty', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'password123',
        first_name: '',
      };
      const result = RegisterInputSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.path.includes('first_name'))).toBe(true);
      }
    });

    it('should make last_name optional', () => {
      const validData = {
        email: 'test@example.com',
        password: 'password123',
        first_name: 'John',
      };
      const result = RegisterInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.last_name).toBeUndefined();
      }
    });

    it('should accept optional public_key and encrypted_private_key', () => {
      const validData = {
        email: 'test@example.com',
        password: 'password123',
        first_name: 'John',
        public_key: '{"kty":"EC","crv":"P-256"}',
        encrypted_private_key: '{"salt":"abc","iv":"def","ciphertext":"ghi"}',
      };
      const result = RegisterInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.public_key).toBe('{"kty":"EC","crv":"P-256"}');
        expect(result.data.encrypted_private_key).toBe('{"salt":"abc","iv":"def","ciphertext":"ghi"}');
      }
    });
  });

  describe('LoginInputSchema', () => {
    it('should accept valid login data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'password123',
      };
      const result = LoginInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    it('should require email and password', () => {
      const missingEmail = { password: 'password123' };
      const missingPassword = { email: 'test@example.com' };
      const missingBoth = {};

      expect(LoginInputSchema.safeParse(missingEmail).success).toBe(false);
      expect(LoginInputSchema.safeParse(missingPassword).success).toBe(false);
      expect(LoginInputSchema.safeParse(missingBoth).success).toBe(false);
    });

    it('should require valid email format', () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'password123',
      };
      const result = LoginInputSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should require non-empty password', () => {
      const invalidData = {
        email: 'test@example.com',
        password: '',
      };
      const result = LoginInputSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('MfaLoginInputSchema', () => {
    it('should accept valid MFA login data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'password123',
        mfa_code: '123456',
      };
      const result = MfaLoginInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    it('should require 6-digit mfa_code', () => {
      const validData = {
        email: 'test@example.com',
        password: 'password123',
        mfa_code: '123456',
      };
      const result = MfaLoginInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid mfa_code format - too short', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'password123',
        mfa_code: '12345',
      };
      const result = MfaLoginInputSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid mfa_code format - too long', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'password123',
        mfa_code: '1234567',
      };
      const result = MfaLoginInputSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid mfa_code format - non-numeric', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'password123',
        mfa_code: 'abcdef',
      };
      const result = MfaLoginInputSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject mfa_code with letters mixed in', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'password123',
        mfa_code: '12a456',
      };
      const result = MfaLoginInputSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('SendOtpInputSchema', () => {
    it('should accept valid email', () => {
      const validData = { email: 'test@example.com' };
      const result = SendOtpInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalidData = { email: 'not-an-email' };
      const result = SendOtpInputSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('VerifyOtpInputSchema', () => {
    it('should accept valid OTP verification data', () => {
      const validData = {
        email: 'test@example.com',
        token: 'abc123',
      };
      const result = VerifyOtpInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should require non-empty token', () => {
      const invalidData = {
        email: 'test@example.com',
        token: '',
      };
      const result = VerifyOtpInputSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('ChangePasswordInputSchema', () => {
    it('should accept valid password', () => {
      const validData = { password: 'newpassword123' };
      const result = ChangePasswordInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should require minimum 8 characters', () => {
      const invalidData = { password: 'short' };
      const result = ChangePasswordInputSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('MfaVerifyInputSchema', () => {
    it('should accept valid 6-digit code', () => {
      const validData = { code: '123456' };
      const result = MfaVerifyInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid code format', () => {
      const invalidCodes = ['12345', '1234567', 'abcdef', '12345a'];
      for (const code of invalidCodes) {
        const result = MfaVerifyInputSchema.safeParse({ code });
        expect(result.success).toBe(false);
      }
    });
  });

  describe('MfaDisableInputSchema', () => {
    it('should accept valid password', () => {
      const validData = { password: 'password123' };
      const result = MfaDisableInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should require non-empty password', () => {
      const invalidData = { password: '' };
      const result = MfaDisableInputSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('UserSchema', () => {
    it('should accept valid user data', () => {
      const validData = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
      };
      const result = UserSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept null first_name', () => {
      const validData = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'test@example.com',
        first_name: null,
      };
      const result = UserSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should require valid UUID for id', () => {
      const invalidData = {
        id: 'not-a-uuid',
        email: 'test@example.com',
        first_name: 'John',
      };
      const result = UserSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('RegisterOutputSchema', () => {
    it('should accept valid registration response', () => {
      const validData = {
        ok: true,
        token: 'jwt-token-here',
        user: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe',
        },
      };
      const result = RegisterOutputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('LoginOutputSchema', () => {
    it('should accept valid login response', () => {
      const validData = {
        ok: true,
        token: 'jwt-token-here',
        user: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          email: 'test@example.com',
          first_name: 'John',
          last_name: null,
        },
      };
      const result = LoginOutputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept optional mfa_required field', () => {
      const validData = {
        ok: true,
        token: 'jwt-token-here',
        user: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          email: 'test@example.com',
          first_name: 'John',
          last_name: null,
        },
        mfa_required: true,
      };
      const result = LoginOutputSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mfa_required).toBe(true);
      }
    });
  });

  describe('MfaEnableOutputSchema', () => {
    it('should accept valid MFA enable response', () => {
      const validData = {
        ok: true,
        secret: 'JBSWY3DPEHPK3PXP',
        otpauthUrl: 'otpauth://totp/CryoPay:test@example.com?secret=JBSWY3DPEHPK3PXP',
      };
      const result = MfaEnableOutputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept optional message', () => {
      const validData = {
        ok: true,
        secret: 'JBSWY3DPEHPK3PXP',
        otpauthUrl: 'otpauth://totp/CryoPay:test@example.com?secret=JBSWY3DPEHPK3PXP',
        message: 'Scan the QR code',
      };
      const result = MfaEnableOutputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('MfaVerifyOutputSchema', () => {
    it('should accept valid MFA verify response', () => {
      const validData = {
        ok: true,
        message: 'MFA enabled successfully',
        backupCodes: ['code1', 'code2', 'code3'],
      };
      const result = MfaVerifyOutputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should make backupCodes optional', () => {
      const validData = {
        ok: true,
      };
      const result = MfaVerifyOutputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });
});

// ============================================================================
// PROFILE SCHEMAS
// ============================================================================

describe('Profile Schemas', () => {
  describe('ProfileUpdateInputSchema', () => {
    it('should accept partial updates', () => {
      const validData = { first_name: 'Jane' };
      const result = ProfileUpdateInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.first_name).toBe('Jane');
      }
    });

    it('should accept empty object', () => {
      const validData = {};
      const result = ProfileUpdateInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate JSON string for public_key if provided', () => {
      const validData = { public_key: '{"kty":"EC","crv":"P-256"}' };
      const result = ProfileUpdateInputSchema.safeParse(validData);
      expect(result.success).toBe(true);

      const invalidData = { public_key: 'not-json' };
      const invalidResult = ProfileUpdateInputSchema.safeParse(invalidData);
      expect(invalidResult.success).toBe(false);
    });

    it('should validate JSON string for encrypted_private_key if provided', () => {
      const validData = { encrypted_private_key: '{"salt":"abc","iv":"def","ciphertext":"ghi"}' };
      const result = ProfileUpdateInputSchema.safeParse(validData);
      expect(result.success).toBe(true);

      const invalidData = { encrypted_private_key: 'not-json' };
      const invalidResult = ProfileUpdateInputSchema.safeParse(invalidData);
      expect(invalidResult.success).toBe(false);
    });

    it('should reject empty encrypted_private_key', () => {
      const invalidData = { encrypted_private_key: '' };
      const result = ProfileUpdateInputSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept all profile fields', () => {
      const validData = {
        first_name: 'Jane',
        last_name: 'Doe',
        phone: '+1234567890',
        notifications: '{"email":true}',
        public_key: '{"kty":"EC"}',
        encrypted_private_key: '{"salt":"a","iv":"b","ciphertext":"c"}',
      };
      const result = ProfileUpdateInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('ProfileSearchInputSchema', () => {
    it('should accept email search', () => {
      const validData = { email: 'test@example.com' };
      const result = ProfileSearchInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept id search', () => {
      const validData = { id: '550e8400-e29b-41d4-a716-446655440000' };
      const result = ProfileSearchInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept thumbprint search', () => {
      const validData = { thumbprint: 'abc123thumbprint' };
      const result = ProfileSearchInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject when no search parameter provided', () => {
      const invalidData = {};
      const result = ProfileSearchInputSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.message.includes('At least one search parameter'))).toBe(true);
      }
    });

    it('should accept multiple search parameters', () => {
      const validData = {
        email: 'test@example.com',
        id: '550e8400-e29b-41d4-a716-446655440000',
      };
      const result = ProfileSearchInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should require valid email format if email provided', () => {
      const invalidData = { email: 'not-an-email' };
      const result = ProfileSearchInputSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should require valid UUID if id provided', () => {
      const invalidData = { id: 'not-a-uuid' };
      const result = ProfileSearchInputSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('ProfileOutputSchema', () => {
    it('should accept valid profile output', () => {
      const validData = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        first_name: 'John',
        last_name: 'Doe',
        email: 'test@example.com',
        phone: '+1234567890',
        public_key: '{"kty":"EC"}',
        encrypted_private_key: '{"salt":"a","iv":"b","ciphertext":"c"}',
        notifications: '{"email":true}',
        mfa_enabled: true,
      };
      const result = ProfileOutputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should transform mfa_enabled from number to boolean', () => {
      const validData = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        first_name: 'John',
        last_name: null,
        email: 'test@example.com',
        phone: null,
        public_key: null,
        notifications: '{}',
        mfa_enabled: 1,
      };
      const result = ProfileOutputSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mfa_enabled).toBe(true);
      }
    });

    it('should accept null values for optional fields', () => {
      const validData = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        first_name: null,
        last_name: null,
        email: null,
        phone: null,
        public_key: null,
        notifications: '{}',
      };
      const result = ProfileOutputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('ProfileSearchOutputSchema', () => {
    it('should accept valid search output', () => {
      const validData = {
        ok: true,
        profile: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          first_name: 'John',
          last_name: 'Doe',
          email: 'test@example.com',
          public_key: '{"kty":"EC"}',
        },
      };
      const result = ProfileSearchOutputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });
});

// ============================================================================
// WALLET SCHEMAS
// ============================================================================

describe('Wallet Schemas', () => {
  describe('WalletSaveInputSchema', () => {
    it('should accept valid wallet save data', () => {
      const validData = {
        public_key: '{"kty":"EC","crv":"P-256","x":"abc","y":"def"}',
        encrypted_private_key: '{"salt":"abc","iv":"def","ciphertext":"ghi"}',
      };
      const result = WalletSaveInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate public_key is valid JSON', () => {
      const invalidData = {
        public_key: 'not-valid-json',
        encrypted_private_key: '{"salt":"abc","iv":"def","ciphertext":"ghi"}',
      };
      const result = WalletSaveInputSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should validate encrypted_private_key is valid JSON', () => {
      const invalidData = {
        public_key: '{"kty":"EC"}',
        encrypted_private_key: 'not-valid-json',
      };
      const result = WalletSaveInputSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should default verified to false', () => {
      const validData = {
        public_key: '{"kty":"EC"}',
        encrypted_private_key: '{"salt":"a","iv":"b","ciphertext":"c"}',
      };
      const result = WalletSaveInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.verified).toBe(false);
      }
    });

    it('should accept optional verified field', () => {
      const validData = {
        public_key: '{"kty":"EC"}',
        encrypted_private_key: '{"salt":"a","iv":"b","ciphertext":"c"}',
        verified: true,
      };
      const result = WalletSaveInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.verified).toBe(true);
      }
    });
  });

  describe('WalletVerifyInputSchema', () => {
    it('should accept valid verification data', () => {
      const validData = {
        public_key: {
          kty: 'EC',
          crv: 'P-256',
          x: 'abc123',
          y: 'def456',
        },
        challenge: 'random-challenge-string',
        signature: 'base64-encoded-signature',
      };
      const result = WalletVerifyInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should require public_key object', () => {
      const invalidData = {
        public_key: 'not-an-object',
        challenge: 'random-challenge',
        signature: 'signature',
      };
      const result = WalletVerifyInputSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should require public_key.kty', () => {
      const invalidData = {
        public_key: {
          crv: 'P-256',
          x: 'abc',
          y: 'def',
        },
        challenge: 'random-challenge',
        signature: 'signature',
      };
      const result = WalletVerifyInputSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should require challenge string', () => {
      const invalidData = {
        public_key: { kty: 'EC' },
        challenge: '',
        signature: 'signature',
      };
      const result = WalletVerifyInputSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should require signature string', () => {
      const invalidData = {
        public_key: { kty: 'EC' },
        challenge: 'challenge',
        signature: '',
      };
      const result = WalletVerifyInputSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should allow additional properties on public_key (passthrough)', () => {
      const validData = {
        public_key: {
          kty: 'EC',
          crv: 'P-256',
          x: 'abc',
          y: 'def',
          extra_field: 'allowed',
        },
        challenge: 'challenge',
        signature: 'signature',
      };
      const result = WalletVerifyInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data.public_key as Record<string, unknown>).extra_field).toBe('allowed');
      }
    });
  });

  describe('WalletOutputSchema', () => {
    it('should accept valid wallet output', () => {
      const validData = {
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        public_key: '{"kty":"EC"}',
        encrypted_private_key: '{"salt":"a","iv":"b","ciphertext":"c"}',
        verified: true,
      };
      const result = WalletOutputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should transform verified from number to boolean', () => {
      const validData = {
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        public_key: null,
        encrypted_private_key: null,
        verified: 1,
      };
      const result = WalletOutputSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.verified).toBe(true);
      }
    });

    it('should transform verified 0 to false', () => {
      const validData = {
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        public_key: null,
        encrypted_private_key: null,
        verified: 0,
      };
      const result = WalletOutputSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.verified).toBe(false);
      }
    });
  });
});

// ============================================================================
// BLOCK/TRANSACTION SCHEMAS
// ============================================================================

describe('Block Schemas', () => {
  describe('TransactionKindEnum', () => {
    it('should accept valid tx kind', () => {
      const result = TransactionKindEnum.safeParse('tx');
      expect(result.success).toBe(true);
    });

    it('should accept valid buy kind', () => {
      const result = TransactionKindEnum.safeParse('buy');
      expect(result.success).toBe(true);
    });

    it('should accept valid sell kind', () => {
      const result = TransactionKindEnum.safeParse('sell');
      expect(result.success).toBe(true);
    });

    it('should reject invalid kind', () => {
      const result = TransactionKindEnum.safeParse('transfer');
      expect(result.success).toBe(false);
    });
  });

  describe('PublicSummarySchema', () => {
    const validPublicSummary = {
      kind: 'tx' as const,
      to: 'recipient-address',
      to_user_id: '550e8400-e29b-41d4-a716-446655440000',
      to_thumbprint: 'abc123',
      from: 'sender-address',
      from_user_id: '550e8400-e29b-41d4-a716-446655440001',
      from_thumbprint: 'def456',
      amountFiat: 100.5,
      amountCrypto: 0.005,
      crypto: 'BTC',
      fiatCurrency: 'USD',
      timestamp: '2024-01-01T00:00:00Z',
    };

    it('should accept valid tx kind', () => {
      const result = PublicSummarySchema.safeParse({ ...validPublicSummary, kind: 'tx' });
      expect(result.success).toBe(true);
    });

    it('should accept valid buy kind', () => {
      const result = PublicSummarySchema.safeParse({ ...validPublicSummary, kind: 'buy' });
      expect(result.success).toBe(true);
    });

    it('should accept valid sell kind', () => {
      const result = PublicSummarySchema.safeParse({ ...validPublicSummary, kind: 'sell' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid kind', () => {
      const result = PublicSummarySchema.safeParse({ ...validPublicSummary, kind: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should validate optional fields', () => {
      const minimalData = {
        kind: 'tx' as const,
        to: 'recipient',
        from: 'sender',
        amountFiat: 100,
        amountCrypto: 0.01,
        crypto: 'ETH',
        fiatCurrency: 'EUR',
        timestamp: Date.now(),
      };
      const result = PublicSummarySchema.safeParse(minimalData);
      expect(result.success).toBe(true);
    });

    it('should accept null for optional nullable fields', () => {
      const dataWithNulls = {
        ...validPublicSummary,
        to_user_id: null,
        to_thumbprint: null,
        from_user_id: null,
        from_thumbprint: null,
      };
      const result = PublicSummarySchema.safeParse(dataWithNulls);
      expect(result.success).toBe(true);
    });

    it('should accept timestamp as string', () => {
      const result = PublicSummarySchema.safeParse({
        ...validPublicSummary,
        timestamp: '2024-01-01T00:00:00Z',
      });
      expect(result.success).toBe(true);
    });

    it('should accept timestamp as number', () => {
      const result = PublicSummarySchema.safeParse({
        ...validPublicSummary,
        timestamp: 1704067200000,
      });
      expect(result.success).toBe(true);
    });

    it('should require amountFiat as number', () => {
      const result = PublicSummarySchema.safeParse({
        ...validPublicSummary,
        amountFiat: 'not-a-number',
      });
      expect(result.success).toBe(false);
    });

    it('should require amountCrypto as number', () => {
      const result = PublicSummarySchema.safeParse({
        ...validPublicSummary,
        amountCrypto: 'not-a-number',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('EncryptedBlobSchema', () => {
    it('should accept valid encrypted blob', () => {
      const validData = {
        salt: 'hexsaltstring',
        iv: 'hexivstring',
        ciphertext: 'base64ciphertext',
      };
      const result = EncryptedBlobSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should require all fields', () => {
      const missingFields = [
        { iv: 'iv', ciphertext: 'ct' },
        { salt: 'salt', ciphertext: 'ct' },
        { salt: 'salt', iv: 'iv' },
      ];
      for (const data of missingFields) {
        const result = EncryptedBlobSchema.safeParse(data);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('BlockDataSchema', () => {
    it('should accept valid block data', () => {
      const validData = {
        public_summary: {
          kind: 'tx' as const,
          to: 'recipient',
          from: 'sender',
          amountFiat: 100,
          amountCrypto: 0.01,
          crypto: 'BTC',
          fiatCurrency: 'USD',
          timestamp: Date.now(),
        },
        encrypted_blob: {
          salt: 'salt',
          iv: 'iv',
          ciphertext: 'ciphertext',
        },
        user_id: '550e8400-e29b-41d4-a716-446655440000',
      };
      const result = BlockDataSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept null encrypted_blob', () => {
      const validData = {
        public_summary: {
          kind: 'tx' as const,
          to: 'recipient',
          from: 'sender',
          amountFiat: 100,
          amountCrypto: 0.01,
          crypto: 'BTC',
          fiatCurrency: 'USD',
          timestamp: Date.now(),
        },
        encrypted_blob: null,
      };
      const result = BlockDataSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should make user_id optional', () => {
      const validData = {
        public_summary: {
          kind: 'tx' as const,
          to: 'recipient',
          from: 'sender',
          amountFiat: 100,
          amountCrypto: 0.01,
          crypto: 'BTC',
          fiatCurrency: 'USD',
          timestamp: Date.now(),
        },
      };
      const result = BlockDataSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('BlockInputSchema', () => {
    it('should accept valid block input with JSON string data', () => {
      const blockData = {
        public_summary: {
          kind: 'tx',
          to: 'recipient',
          from: 'sender',
          amountFiat: 100,
          amountCrypto: 0.01,
          crypto: 'BTC',
          fiatCurrency: 'USD',
          timestamp: Date.now(),
        },
      };
      const validData = {
        data: JSON.stringify(blockData),
        previous_hash: 'abc123previoushash',
      };
      const result = BlockInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept null previousHash', () => {
      const blockData = {
        public_summary: {
          kind: 'tx',
          to: 'recipient',
          from: 'sender',
          amountFiat: 100,
          amountCrypto: 0.01,
          crypto: 'BTC',
          fiatCurrency: 'USD',
          timestamp: Date.now(),
        },
      };
      const validData = {
        data: JSON.stringify(blockData),
        previous_hash: null,
      };
      const result = BlockInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate data contains public_summary', () => {
      // Note: BlockInputSchema only validates that data is valid JSON string
      // The actual public_summary validation happens when parsing the JSON
      const validData = {
        data: JSON.stringify({ public_summary: { kind: 'tx' } }),
      };
      const result = BlockInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid JSON in data', () => {
      const invalidData = {
        data: 'not-valid-json',
        previous_hash: null,
      };
      const result = BlockInputSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should make previous_hash optional', () => {
      const validData = {
        data: JSON.stringify({ public_summary: {} }),
      };
      const result = BlockInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('BlockOutputSchema', () => {
    it('should accept valid block output', () => {
      const validData = {
        id: 1,
        data: {
          public_summary: {
            kind: 'tx' as const,
            to: 'recipient',
            from: 'sender',
            amountFiat: 100,
            amountCrypto: 0.01,
            crypto: 'BTC',
            fiatCurrency: 'USD',
            timestamp: '2024-01-01T00:00:00Z',
          },
        },
        previous_hash: 'abc123',
        hash: 'def456',
        created_at: '2024-01-01T00:00:00Z',
        user_id: '550e8400-e29b-41d4-a716-446655440000',
      };
      const result = BlockOutputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept null data', () => {
      const validData = {
        id: 1,
        data: null,
        previous_hash: null,
        hash: null,
        created_at: '2024-01-01T00:00:00Z',
        user_id: null,
      };
      const result = BlockOutputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('BlockRawOutputSchema', () => {
    it('should accept raw block with data as string', () => {
      const validData = {
        id: 1,
        data: '{"public_summary":{}}',
        previous_hash: 'abc123',
        hash: 'def456',
        created_at: '2024-01-01T00:00:00Z',
        user_id: '550e8400-e29b-41d4-a716-446655440000',
      };
      const result = BlockRawOutputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept null data string', () => {
      const validData = {
        id: 1,
        data: null,
        previous_hash: null,
        hash: null,
        created_at: '2024-01-01T00:00:00Z',
        user_id: null,
      };
      const result = BlockRawOutputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });
});

// ============================================================================
// CONTACT SCHEMAS
// ============================================================================

describe('Contact Schemas', () => {
  describe('ContactInputSchema', () => {
    it('should require name', () => {
      const invalidData = {
        address: 'wallet-address',
      };
      const result = ContactInputSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should require non-empty name', () => {
      const invalidData = {
        name: '',
        address: 'wallet-address',
      };
      const result = ContactInputSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should require address', () => {
      const invalidData = {
        name: 'John Doe',
      };
      const result = ContactInputSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should require non-empty address', () => {
      const invalidData = {
        name: 'John Doe',
        address: '',
      };
      const result = ContactInputSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should make email optional', () => {
      const validData = {
        name: 'John Doe',
        address: 'wallet-address',
      };
      const result = ContactInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBeUndefined();
      }
    });

    it('should make label optional', () => {
      const validData = {
        name: 'John Doe',
        address: 'wallet-address',
      };
      const result = ContactInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.label).toBeUndefined();
      }
    });

    it('should accept valid email if provided', () => {
      const validData = {
        name: 'John Doe',
        address: 'wallet-address',
        email: 'john@example.com',
      };
      const result = ContactInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email if provided', () => {
      const invalidData = {
        name: 'John Doe',
        address: 'wallet-address',
        email: 'not-an-email',
      };
      const result = ContactInputSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept null for email and label', () => {
      const validData = {
        name: 'John Doe',
        address: 'wallet-address',
        email: null,
        label: null,
      };
      const result = ContactInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept all optional fields', () => {
      const validData = {
        name: 'John Doe',
        address: 'wallet-address',
        email: 'john@example.com',
        label: 'Work',
        public_key: '{"kty":"EC"}',
        contact_user_id: '550e8400-e29b-41d4-a716-446655440000',
      };
      const result = ContactInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('ContactUpdateInputSchema', () => {
    it('should accept partial updates', () => {
      const validData = { name: 'Jane Doe' };
      const result = ContactUpdateInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should allow updating just name', () => {
      const validData = { name: 'Jane Doe' };
      const result = ContactUpdateInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Jane Doe');
        expect(result.data.address).toBeUndefined();
      }
    });

    it('should allow updating just address', () => {
      const validData = { address: 'new-wallet-address' };
      const result = ContactUpdateInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.address).toBe('new-wallet-address');
        expect(result.data.name).toBeUndefined();
      }
    });

    it('should accept empty object', () => {
      const validData = {};
      const result = ContactUpdateInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should require name to be non-empty if provided', () => {
      const invalidData = { name: '' };
      const result = ContactUpdateInputSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should require address to be non-empty if provided', () => {
      const invalidData = { address: '' };
      const result = ContactUpdateInputSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should validate email if provided', () => {
      const validData = { email: 'test@example.com' };
      const result = ContactUpdateInputSchema.safeParse(validData);
      expect(result.success).toBe(true);

      const invalidData = { email: 'not-an-email' };
      const invalidResult = ContactUpdateInputSchema.safeParse(invalidData);
      expect(invalidResult.success).toBe(false);
    });

    it('should accept null for email and label', () => {
      const validData = {
        email: null,
        label: null,
        public_key: null,
      };
      const result = ContactUpdateInputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('ContactOutputSchema', () => {
    it('should accept valid contact output', () => {
      const validData = {
        id: 1,
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        contact_user_id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'John Doe',
        address: 'wallet-address',
        email: 'john@example.com',
        label: 'Work',
        public_key: '{"kty":"EC"}',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      const result = ContactOutputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept null values for nullable fields', () => {
      const validData = {
        id: 1,
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        contact_user_id: null,
        name: 'John Doe',
        address: 'wallet-address',
        email: null,
        label: null,
        public_key: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      const result = ContactOutputSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });
});

// ============================================================================
// GENERIC API SCHEMAS
// ============================================================================

describe('Generic API Schemas', () => {
  describe('ApiSuccessSchema', () => {
    it('should accept valid success response', () => {
      const validData = { ok: true };
      const result = ApiSuccessSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept optional message', () => {
      const validData = { ok: true, message: 'Operation successful' };
      const result = ApiSuccessSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should require ok to be true (literal)', () => {
      const invalidData = { ok: false };
      const result = ApiSuccessSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('ApiErrorSchema', () => {
    it('should accept valid error response', () => {
      const validData = { error: 'Something went wrong' };
      const result = ApiErrorSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should require error string', () => {
      const invalidData = {};
      const result = ApiErrorSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('PaginationSchema', () => {
    it('should accept valid pagination', () => {
      const validData = { limit: 50, offset: 10 };
      const result = PaginationSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should default limit to 100', () => {
      const validData = { offset: 0 };
      const result = PaginationSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(100);
      }
    });

    it('should default offset to 0', () => {
      const validData = { limit: 50 };
      const result = PaginationSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.offset).toBe(0);
      }
    });

    it('should reject limit greater than 100', () => {
      const invalidData = { limit: 150 };
      const result = PaginationSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject negative limit', () => {
      const invalidData = { limit: -1 };
      const result = PaginationSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject negative offset', () => {
      const invalidData = { offset: -1 };
      const result = PaginationSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should require integers', () => {
      const invalidData = { limit: 10.5, offset: 5.5 };
      const result = PaginationSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('createApiResponseSchema', () => {
    it('should create a response schema with custom data type', () => {
      const UserResponseSchema = createApiResponseSchema(
        z.object({
          id: z.string(),
          name: z.string(),
        })
      );

      const validData = {
        ok: true,
        data: { id: '123', name: 'John' },
      };
      const result = UserResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept error response', () => {
      const ResponseSchema = createApiResponseSchema(z.string());
      const validData = {
        ok: false,
        error: 'Something went wrong',
      };
      const result = ResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should make data optional', () => {
      const ResponseSchema = createApiResponseSchema(z.string());
      const validData = { ok: true };
      const result = ResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });
});
