import { z } from 'zod';

// ============================================================================
// AUTH SCHEMAS
// ============================================================================

/**
 * Schema for user registration input
 * @description Validates email format, password length (min 8 chars), and required name fields
 */
export const RegisterInputSchema = z.object({
  /** Valid email address */
  email: z.string().email('Invalid email format'),
  /** Password with minimum 8 characters */
  password: z.string().min(8, 'Password must be at least 8 characters'),
  /** User's first name (required) */
  first_name: z.string().min(1, 'First name is required'),
  /** User's last name (optional) */
  last_name: z.string().optional(),
  /** Optional public key (JSON string) for initial wallet setup */
  public_key: z.string().optional(),
  /** Optional encrypted private key (JSON string) for initial wallet setup */
  encrypted_private_key: z.string().optional(),
});

/**
 * Schema for user data returned after registration/login
 */
export const UserSchema = z.object({
  /** Unique user identifier (UUID) */
  id: z.string().uuid(),
  /** User's email address */
  email: z.string().email(),
  /** User's first name */
  first_name: z.string().nullable(),
  /** User's last name */
  last_name: z.string().nullable().optional(),
});

/**
 * Schema for registration response
 */
export const RegisterOutputSchema = z.object({
  /** Whether the operation succeeded */
  ok: z.boolean(),
  /** JWT authentication token */
  token: z.string(),
  /** User data */
  user: UserSchema,
});

/**
 * Schema for login input
 */
export const LoginInputSchema = z.object({
  /** User's email address */
  email: z.string().email('Invalid email format'),
  /** User's password */
  password: z.string().min(1, 'Password is required'),
});

/**
 * Schema for login response
 */
export const LoginOutputSchema = z.object({
  /** Whether the operation succeeded */
  ok: z.boolean(),
  /** JWT authentication token */
  token: z.string(),
  /** User data */
  user: UserSchema,
  /** Whether MFA verification is required to complete login */
  mfa_required: z.boolean().optional(),
});

/**
 * Schema for MFA login input (when MFA is enabled)
 */
export const MfaLoginInputSchema = z.object({
  /** User's email address */
  email: z.string().email('Invalid email format'),
  /** User's password */
  password: z.string().min(1, 'Password is required'),
  /** 6-digit TOTP code from authenticator app */
  mfa_code: z.string().length(6, 'MFA code must be 6 digits').regex(/^\d{6}$/, 'MFA code must be 6 digits'),
});

/**
 * Schema for sending OTP/magic link
 */
export const SendOtpInputSchema = z.object({
  /** Email address to send OTP to */
  email: z.string().email('Invalid email format'),
});

/**
 * Schema for verifying OTP/magic link
 */
export const VerifyOtpInputSchema = z.object({
  /** User's email address */
  email: z.string().email('Invalid email format'),
  /** OTP token received via email */
  token: z.string().min(1, 'Token is required'),
});

/**
 * Schema for changing password
 */
export const ChangePasswordInputSchema = z.object({
  /** New password with minimum 8 characters */
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

/**
 * Schema for MFA enable response
 */
export const MfaEnableOutputSchema = z.object({
  /** Whether the operation succeeded */
  ok: z.boolean(),
  /** Base32 encoded secret for TOTP */
  secret: z.string(),
  /** OTPAuth URL for QR code generation */
  otpauthUrl: z.string(),
  /** Informational message */
  message: z.string().optional(),
});

/**
 * Schema for MFA verify input
 */
export const MfaVerifyInputSchema = z.object({
  /** 6-digit TOTP code from authenticator app */
  code: z.string().length(6, 'Code must be 6 digits').regex(/^\d{6}$/, 'Code must be 6 digits'),
});

/**
 * Schema for MFA verify response (includes backup codes)
 */
export const MfaVerifyOutputSchema = z.object({
  /** Whether the operation succeeded */
  ok: z.boolean(),
  /** Informational message */
  message: z.string().optional(),
  /** One-time backup codes for account recovery */
  backupCodes: z.array(z.string()).optional(),
});

/**
 * Schema for MFA disable input
 */
export const MfaDisableInputSchema = z.object({
  /** Current password to confirm identity */
  password: z.string().min(1, 'Password is required'),
});

// ============================================================================
// PROFILE SCHEMAS
// ============================================================================

/**
 * Schema for profile output (GET /profile response)
 */
export const ProfileOutputSchema = z.object({
  /** Unique user identifier (UUID) */
  id: z.string().uuid(),
  /** User's first name */
  first_name: z.string().nullable(),
  /** User's last name */
  last_name: z.string().nullable(),
  /** User's email address */
  email: z.string().email().nullable(),
  /** User's phone number */
  phone: z.string().nullable(),
  /** User's public key (JSON string) */
  public_key: z.string().nullable(),
  /** Encrypted private key (JSON string) */
  encrypted_private_key: z.string().nullable().optional(),
  /** Notification preferences (JSON string) */
  notifications: z.string(),
  /** Whether MFA is enabled */
  mfa_enabled: z.union([z.number(), z.boolean()]).transform(val => Boolean(val)).optional(),
  /** Created timestamp */
  created_at: z.string().optional(),
  /** Last updated timestamp */
  updated_at: z.string().optional(),
});

/**
 * Schema for profile update input
 */
export const ProfileUpdateInputSchema = z.object({
  /** User's first name */
  first_name: z.string().optional(),
  /** User's last name */
  last_name: z.string().optional(),
  /** User's phone number */
  phone: z.string().optional(),
  /** Notification preferences (JSON string) */
  notifications: z.string().optional(),
  /** User's public key (must be valid JSON string) */
  public_key: z.string().refine(
    (val) => {
      if (!val) return true;
      try { JSON.parse(val); return true; } catch { return false; }
    },
    { message: 'public_key must be a valid JSON string' }
  ).optional(),
  /** Encrypted private key (must be valid JSON string) */
  encrypted_private_key: z.string().min(1, 'encrypted_private_key cannot be empty').refine(
    (val) => {
      if (!val) return true;
      try { JSON.parse(val); return true; } catch { return false; }
    },
    { message: 'encrypted_private_key must be a valid JSON string' }
  ).optional(),
});

/**
 * Schema for profile search input (query parameters)
 */
export const ProfileSearchInputSchema = z.object({
  /** Search by email address */
  email: z.string().email().optional(),
  /** Search by user ID (UUID) */
  id: z.string().uuid().optional(),
  /** Search by public key thumbprint */
  thumbprint: z.string().optional(),
}).refine(
  (data) => data.email || data.id || data.thumbprint,
  { message: 'At least one search parameter (email, id, or thumbprint) is required' }
);

/**
 * Schema for profile search response
 */
export const ProfileSearchOutputSchema = z.object({
  /** Whether the operation succeeded */
  ok: z.boolean(),
  /** Found profile data */
  profile: z.object({
    id: z.string().uuid(),
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
    email: z.string().email().nullable(),
    public_key: z.string().nullable(),
  }),
});

// ============================================================================
// WALLET SCHEMAS
// ============================================================================

/**
 * Schema for wallet output (GET /wallet response)
 */
export const WalletOutputSchema = z.object({
  /** User ID who owns the wallet */
  user_id: z.string().uuid(),
  /** Public key (JSON string with JWK format) */
  public_key: z.string().nullable(),
  /** Encrypted private key (JSON string with salt, iv, ciphertext) */
  encrypted_private_key: z.string().nullable(),
  /** Whether the wallet ownership has been verified */
  verified: z.union([z.number(), z.boolean()]).transform(val => Boolean(val)),
  /** Created timestamp */
  created_at: z.string().optional(),
  /** Last updated timestamp */
  updated_at: z.string().optional(),
});

/**
 * Schema for saving/updating wallet
 */
export const WalletSaveInputSchema = z.object({
  /** Public key (must be valid JSON string with JWK format) */
  public_key: z.string().refine(
    (val) => {
      if (!val) return true;
      try { JSON.parse(val); return true; } catch { return false; }
    },
    { message: 'public_key must be a valid JSON string' }
  ),
  /** Encrypted private key (must be valid JSON string) */
  encrypted_private_key: z.string().refine(
    (val) => {
      if (!val) return true;
      try { JSON.parse(val); return true; } catch { return false; }
    },
    { message: 'encrypted_private_key must be a valid JSON string' }
  ),
  /** Whether the wallet is verified */
  verified: z.boolean().optional().default(false),
});

/**
 * Schema for wallet verification (challenge-response)
 */
export const WalletVerifyInputSchema = z.object({
  /** Public key (JWK object) */
  public_key: z.object({
    kty: z.string(),
    crv: z.string().optional(),
    x: z.string().optional(),
    y: z.string().optional(),
  }).passthrough(),
  /** Challenge string that was signed */
  challenge: z.string().min(1, 'Challenge is required'),
  /** Base64-encoded signature */
  signature: z.string().min(1, 'Signature is required'),
});

// ============================================================================
// BLOCK/TRANSACTION SCHEMAS
// ============================================================================

/**
 * Transaction kind enumeration
 */
export const TransactionKindEnum = z.enum(['tx', 'buy', 'sell']);

/**
 * Schema for public transaction summary (unencrypted portion of block data)
 */
export const PublicSummarySchema = z.object({
  /** Type of transaction */
  kind: TransactionKindEnum,
  /** Recipient's address/identifier */
  to: z.string(),
  /** Recipient's user ID (if known) */
  to_user_id: z.string().uuid().optional().nullable(),
  /** Recipient's public key thumbprint */
  to_thumbprint: z.string().optional().nullable(),
  /** Sender's address/identifier */
  from: z.string(),
  /** Sender's user ID (if known) */
  from_user_id: z.string().uuid().optional().nullable(),
  /** Sender's public key thumbprint */
  from_thumbprint: z.string().optional().nullable(),
  /** Amount in fiat currency */
  amountFiat: z.number(),
  /** Amount in cryptocurrency */
  amountCrypto: z.number(),
  /** Cryptocurrency symbol (e.g., BTC, ETH) */
  crypto: z.string(),
  /** Fiat currency code (e.g., USD, EUR) */
  fiatCurrency: z.string(),
  /** Transaction timestamp (ISO 8601 or epoch) */
  timestamp: z.union([z.string(), z.number()]),
});

/**
 * Schema for encrypted data blob (AES-GCM encrypted)
 */
export const EncryptedBlobSchema = z.object({
  /** Salt used for key derivation (hex string) */
  salt: z.string(),
  /** Initialization vector (hex string) */
  iv: z.string(),
  /** Encrypted ciphertext (base64 string) */
  ciphertext: z.string(),
});

/**
 * Schema for block data payload
 */
export const BlockDataSchema = z.object({
  /** Public (unencrypted) transaction summary */
  public_summary: PublicSummarySchema,
  /** Optional encrypted blob for sensitive data */
  encrypted_blob: EncryptedBlobSchema.optional().nullable(),
  /** User ID who created this block */
  user_id: z.string().uuid().optional(),
});

/**
 * Schema for creating a new block
 */
export const BlockInputSchema = z.object({
  /** Block data (stringified JSON of BlockDataSchema) */
  data: z.string().refine(
    (val) => {
      if (!val) return true;
      try { JSON.parse(val); return true; } catch { return false; }
    },
    { message: 'data must be a valid JSON string' }
  ),
  /** Hash of the previous block in chain (null for genesis) */
  previous_hash: z.string().nullable().optional(),
});

/**
 * Schema for block output (from database)
 */
export const BlockOutputSchema = z.object({
  /** Block ID (auto-increment) */
  id: z.number(),
  /** Block data (parsed object or null) */
  data: BlockDataSchema.nullable(),
  /** Hash of the previous block */
  previous_hash: z.string().nullable(),
  /** SHA-256 hash of this block */
  hash: z.string().nullable(),
  /** Block creation timestamp */
  created_at: z.string(),
  /** User ID who owns this block */
  user_id: z.string().uuid().nullable(),
});

/**
 * Schema for raw block from database (data as string)
 */
export const BlockRawOutputSchema = z.object({
  id: z.number(),
  data: z.string().nullable(),
  previous_hash: z.string().nullable(),
  hash: z.string().nullable(),
  created_at: z.string(),
  user_id: z.string().uuid().nullable(),
});

// ============================================================================
// CONTACT SCHEMAS
// ============================================================================

/**
 * Schema for creating a new contact
 */
export const ContactInputSchema = z.object({
  /** Contact's display name (required) */
  name: z.string().min(1, 'Name is required'),
  /** Contact's wallet address (required) */
  address: z.string().min(1, 'Address is required'),
  /** Contact's email address */
  email: z.string().email().optional().nullable(),
  /** Custom label for this contact (e.g., "Work", "Family") */
  label: z.string().optional().nullable(),
  /** Contact's public key (JSON string) */
  public_key: z.string().optional().nullable(),
  /** Contact's user ID if they're a CryoPay user */
  contact_user_id: z.string().uuid().optional().nullable(),
});

/**
 * Schema for updating an existing contact
 */
export const ContactUpdateInputSchema = z.object({
  /** Contact's display name */
  name: z.string().min(1).optional(),
  /** Contact's wallet address */
  address: z.string().min(1).optional(),
  /** Contact's email address */
  email: z.string().email().optional().nullable(),
  /** Custom label for this contact */
  label: z.string().optional().nullable(),
  /** Contact's public key (JSON string) */
  public_key: z.string().optional().nullable(),
});

/**
 * Schema for contact output (from database)
 */
export const ContactOutputSchema = z.object({
  /** Contact ID (auto-increment) */
  id: z.number(),
  /** User ID who owns this contact */
  user_id: z.string().uuid(),
  /** Contact's user ID if they're a CryoPay user */
  contact_user_id: z.string().uuid().nullable(),
  /** Contact's display name */
  name: z.string(),
  /** Contact's wallet address */
  address: z.string(),
  /** Contact's email address */
  email: z.string().nullable(),
  /** Custom label */
  label: z.string().nullable(),
  /** Contact's public key (JSON string) */
  public_key: z.string().nullable(),
  /** Created timestamp */
  created_at: z.string(),
  /** Last updated timestamp */
  updated_at: z.string(),
});

// ============================================================================
// GENERIC API SCHEMAS
// ============================================================================

/**
 * Schema for standard API success response
 */
export const ApiSuccessSchema = z.object({
  /** Whether the operation succeeded */
  ok: z.literal(true),
  /** Optional informational message */
  message: z.string().optional(),
});

/**
 * Schema for standard API error response
 */
export const ApiErrorSchema = z.object({
  /** Error message */
  error: z.string(),
});

/**
 * Factory function to create a typed API response schema
 * @param dataSchema - Schema for the response data
 */
export function createApiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    /** Whether the operation succeeded */
    ok: z.boolean(),
    /** Response data (present on success) */
    data: dataSchema.optional(),
    /** Error message (present on failure) */
    error: z.string().optional(),
  });
}

/**
 * Schema for pagination parameters
 */
export const PaginationSchema = z.object({
  /** Maximum number of results to return */
  limit: z.number().int().positive().max(100).default(100),
  /** Number of results to skip */
  offset: z.number().int().nonnegative().default(0),
});

// ============================================================================
// TYPE EXPORTS (inferred from schemas)
// ============================================================================

// Auth types
export type RegisterInput = z.infer<typeof RegisterInputSchema>;
export type RegisterOutput = z.infer<typeof RegisterOutputSchema>;
export type LoginInput = z.infer<typeof LoginInputSchema>;
export type LoginOutput = z.infer<typeof LoginOutputSchema>;
export type MfaLoginInput = z.infer<typeof MfaLoginInputSchema>;
export type SendOtpInput = z.infer<typeof SendOtpInputSchema>;
export type VerifyOtpInput = z.infer<typeof VerifyOtpInputSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordInputSchema>;
export type MfaEnableOutput = z.infer<typeof MfaEnableOutputSchema>;
export type MfaVerifyInput = z.infer<typeof MfaVerifyInputSchema>;
export type MfaVerifyOutput = z.infer<typeof MfaVerifyOutputSchema>;
export type MfaDisableInput = z.infer<typeof MfaDisableInputSchema>;
export type User = z.infer<typeof UserSchema>;

// Profile types
export type ProfileOutput = z.infer<typeof ProfileOutputSchema>;
export type ProfileUpdateInput = z.infer<typeof ProfileUpdateInputSchema>;
export type ProfileSearchInput = z.infer<typeof ProfileSearchInputSchema>;
export type ProfileSearchOutput = z.infer<typeof ProfileSearchOutputSchema>;

// Wallet types
export type WalletOutput = z.infer<typeof WalletOutputSchema>;
export type WalletSaveInput = z.infer<typeof WalletSaveInputSchema>;
export type WalletVerifyInput = z.infer<typeof WalletVerifyInputSchema>;

// Block/Transaction types
export type TransactionKind = z.infer<typeof TransactionKindEnum>;
export type PublicSummary = z.infer<typeof PublicSummarySchema>;
export type EncryptedBlob = z.infer<typeof EncryptedBlobSchema>;
export type BlockData = z.infer<typeof BlockDataSchema>;
export type BlockInput = z.infer<typeof BlockInputSchema>;
export type BlockOutput = z.infer<typeof BlockOutputSchema>;
export type BlockRawOutput = z.infer<typeof BlockRawOutputSchema>;

// Contact types
export type ContactInput = z.infer<typeof ContactInputSchema>;
export type ContactUpdateInput = z.infer<typeof ContactUpdateInputSchema>;
export type ContactOutput = z.infer<typeof ContactOutputSchema>;

// Generic types
export type ApiSuccess = z.infer<typeof ApiSuccessSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
export type Pagination = z.infer<typeof PaginationSchema>;
