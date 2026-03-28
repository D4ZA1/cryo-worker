/**
 * CryoPay Backend Constants
 * Centralized enums, keys, and reusable values
 */

// Transaction types/kinds
export enum TransactionKind {
  TX = 'tx',        // peer-to-peer transfer
  BUY = 'buy',      // buying crypto with fiat
  SELL = 'sell'     // selling crypto for fiat
}

// Transaction direction (for display purposes)
export enum TransactionDirection {
  SENT = 'Sent',
  RECEIVED = 'Received',
  BUY = 'Buy',
  SELL = 'Sell'
}

// Transaction status
export enum TransactionStatus {
  COMPLETED = 'Completed',
  PENDING = 'Pending',
  FAILED = 'Failed'
}

// Supported cryptocurrencies
export enum CryptoCurrency {
  ETH = 'ETH',
  BTC = 'BTC',
  USDC = 'USDC',
  USDT = 'USDT'
}

// Fiat currencies
export enum FiatCurrency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP'
}

// API Error codes
export enum ErrorCode {
  // Auth errors
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  EMAIL_EXISTS = 'EMAIL_EXISTS',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  MFA_REQUIRED = 'MFA_REQUIRED',
  MFA_INVALID = 'MFA_INVALID',
  
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_EMAIL = 'INVALID_EMAIL',
  WEAK_PASSWORD = 'WEAK_PASSWORD',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  
  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  
  // Auth/permission errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  
  // Server errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR'
}

// HTTP Status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500
} as const;

export type HttpStatusCode = typeof HTTP_STATUS[keyof typeof HTTP_STATUS];

// JWT configuration
export const JWT_CONFIG = {
  EXPIRATION_SECONDS: 60 * 60 * 24 * 7, // 7 days
  ALGORITHM: 'HS256'
} as const;

// Validation constants
export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 8,
  OTP_LENGTH: 6,
  MFA_CODE_LENGTH: 6,
  BLOCKS_DEFAULT_LIMIT: 100,
  CONTACTS_DEFAULT_LIMIT: 100
} as const;

// Local storage keys (for reference, used in frontend)
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'cryo_auth_token',
  USER_DATA: 'cryo_user',
  THEME: 'cryo_theme'
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];
