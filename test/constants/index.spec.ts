import { describe, it, expect } from 'vitest';
import {
  TransactionKind,
  TransactionDirection,
  TransactionStatus,
  CryptoCurrency,
  FiatCurrency,
  ErrorCode,
  HTTP_STATUS,
  JWT_CONFIG,
  VALIDATION,
  STORAGE_KEYS
} from '../../src/constants';

describe('Constants', () => {
  describe('TransactionKind', () => {
    it('should have correct values for tx, buy, sell', () => {
      expect(TransactionKind.TX).toBe('tx');
      expect(TransactionKind.BUY).toBe('buy');
      expect(TransactionKind.SELL).toBe('sell');
    });
  });

  describe('TransactionDirection', () => {
    it('should have correct values', () => {
      expect(TransactionDirection.SENT).toBe('Sent');
      expect(TransactionDirection.RECEIVED).toBe('Received');
      expect(TransactionDirection.BUY).toBe('Buy');
      expect(TransactionDirection.SELL).toBe('Sell');
    });
  });

  describe('TransactionStatus', () => {
    it('should have correct values', () => {
      expect(TransactionStatus.COMPLETED).toBe('Completed');
      expect(TransactionStatus.PENDING).toBe('Pending');
      expect(TransactionStatus.FAILED).toBe('Failed');
    });
  });

  describe('CryptoCurrency', () => {
    it('should have common cryptocurrencies', () => {
      expect(CryptoCurrency.ETH).toBe('ETH');
      expect(CryptoCurrency.BTC).toBe('BTC');
      expect(CryptoCurrency.USDC).toBe('USDC');
      expect(CryptoCurrency.USDT).toBe('USDT');
    });
  });

  describe('FiatCurrency', () => {
    it('should have common fiat currencies', () => {
      expect(FiatCurrency.USD).toBe('USD');
      expect(FiatCurrency.EUR).toBe('EUR');
      expect(FiatCurrency.GBP).toBe('GBP');
    });
  });

  describe('ErrorCode', () => {
    it('should have auth error codes', () => {
      expect(ErrorCode.INVALID_CREDENTIALS).toBe('INVALID_CREDENTIALS');
      expect(ErrorCode.EMAIL_EXISTS).toBe('EMAIL_EXISTS');
      expect(ErrorCode.USER_NOT_FOUND).toBe('USER_NOT_FOUND');
      expect(ErrorCode.MFA_REQUIRED).toBe('MFA_REQUIRED');
      expect(ErrorCode.MFA_INVALID).toBe('MFA_INVALID');
    });

    it('should have validation error codes', () => {
      expect(ErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ErrorCode.INVALID_EMAIL).toBe('INVALID_EMAIL');
      expect(ErrorCode.WEAK_PASSWORD).toBe('WEAK_PASSWORD');
    });

    it('should have resource error codes', () => {
      expect(ErrorCode.NOT_FOUND).toBe('NOT_FOUND');
      expect(ErrorCode.ALREADY_EXISTS).toBe('ALREADY_EXISTS');
    });
  });

  describe('HTTP_STATUS', () => {
    it('should have correct HTTP status codes', () => {
      expect(HTTP_STATUS.OK).toBe(200);
      expect(HTTP_STATUS.CREATED).toBe(201);
      expect(HTTP_STATUS.BAD_REQUEST).toBe(400);
      expect(HTTP_STATUS.UNAUTHORIZED).toBe(401);
      expect(HTTP_STATUS.FORBIDDEN).toBe(403);
      expect(HTTP_STATUS.NOT_FOUND).toBe(404);
      expect(HTTP_STATUS.CONFLICT).toBe(409);
      expect(HTTP_STATUS.INTERNAL_ERROR).toBe(500);
    });
  });

  describe('JWT_CONFIG', () => {
    it('should have expiration set to 7 days', () => {
      expect(JWT_CONFIG.EXPIRATION_SECONDS).toBe(60 * 60 * 24 * 7);
    });

    it('should use HS256 algorithm', () => {
      expect(JWT_CONFIG.ALGORITHM).toBe('HS256');
    });
  });

  describe('VALIDATION', () => {
    it('should have minimum password length of 8', () => {
      expect(VALIDATION.PASSWORD_MIN_LENGTH).toBe(8);
    });

    it('should have OTP length of 6', () => {
      expect(VALIDATION.OTP_LENGTH).toBe(6);
    });

    it('should have MFA code length of 6', () => {
      expect(VALIDATION.MFA_CODE_LENGTH).toBe(6);
    });

    it('should have default limits for blocks and contacts', () => {
      expect(VALIDATION.BLOCKS_DEFAULT_LIMIT).toBe(100);
      expect(VALIDATION.CONTACTS_DEFAULT_LIMIT).toBe(100);
    });
  });

  describe('STORAGE_KEYS', () => {
    it('should have correct storage key names', () => {
      expect(STORAGE_KEYS.AUTH_TOKEN).toBe('cryo_auth_token');
      expect(STORAGE_KEYS.USER_DATA).toBe('cryo_user');
      expect(STORAGE_KEYS.THEME).toBe('cryo_theme');
    });
  });
});
