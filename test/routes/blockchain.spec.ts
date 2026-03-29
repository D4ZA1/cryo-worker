import { describe, it, expect } from 'vitest';
import {
  recordTransactionSchema,
  getTransactionStatusSchema,
  ethereumAddressSchema,
  transactionHashSchema,
  bytes32Schema,
  recordBatchTransactionsSchema,
  getBalanceSchema,
} from '../../src/schemas/blockchain';
import { isValidTxHash, isValidAddress } from '../../src/lib/ethereum';

describe('Blockchain Routes', () => {
  // ============ Record Transaction Validation ============

  describe('Record Transaction Validation', () => {
    it('should validate correct transaction data', () => {
      const result = recordTransactionSchema.safeParse({
        to: '0x1234567890123456789012345678901234567890',
        amount: '1000000000000000000',
        currency: 'ETH',
        offChainTxHash: '0x' + 'a'.repeat(64),
      });
      expect(result.success).toBe(true);
    });

    it('should validate transaction data with optional signature', () => {
      const result = recordTransactionSchema.safeParse({
        to: '0x1234567890123456789012345678901234567890',
        amount: '1000000000000000000',
        currency: 'ETH',
        offChainTxHash: '0x' + 'b'.repeat(64),
        signature: '0x' + 'c'.repeat(130),
      });
      expect(result.success).toBe(true);
    });

    it('should default currency to ETH when not provided', () => {
      const result = recordTransactionSchema.safeParse({
        to: '0x1234567890123456789012345678901234567890',
        amount: '1000000000000000000',
        offChainTxHash: '0x' + 'a'.repeat(64),
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.currency).toBe('ETH');
      }
    });

    it('should reject missing to address', () => {
      const result = recordTransactionSchema.safeParse({
        amount: '1000000000000000000',
        currency: 'ETH',
        offChainTxHash: '0x' + 'a'.repeat(64),
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing amount', () => {
      const result = recordTransactionSchema.safeParse({
        to: '0x1234567890123456789012345678901234567890',
        currency: 'ETH',
        offChainTxHash: '0x' + 'a'.repeat(64),
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing offChainTxHash', () => {
      const result = recordTransactionSchema.safeParse({
        to: '0x1234567890123456789012345678901234567890',
        amount: '1000000000000000000',
        currency: 'ETH',
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-numeric amount string', () => {
      const result = recordTransactionSchema.safeParse({
        to: '0x1234567890123456789012345678901234567890',
        amount: '100.5',
        currency: 'ETH',
        offChainTxHash: '0x' + 'a'.repeat(64),
      });
      expect(result.success).toBe(false);
    });

    it('should reject amount with letters', () => {
      const result = recordTransactionSchema.safeParse({
        to: '0x1234567890123456789012345678901234567890',
        amount: '100abc',
        currency: 'ETH',
        offChainTxHash: '0x' + 'a'.repeat(64),
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative amount', () => {
      const result = recordTransactionSchema.safeParse({
        to: '0x1234567890123456789012345678901234567890',
        amount: '-1000000000000000000',
        currency: 'ETH',
        offChainTxHash: '0x' + 'a'.repeat(64),
      });
      expect(result.success).toBe(false);
    });

    it('should accept zero amount', () => {
      const result = recordTransactionSchema.safeParse({
        to: '0x1234567890123456789012345678901234567890',
        amount: '0',
        currency: 'ETH',
        offChainTxHash: '0x' + 'a'.repeat(64),
      });
      expect(result.success).toBe(true);
    });

    it('should accept very large amount (wei value)', () => {
      const result = recordTransactionSchema.safeParse({
        to: '0x1234567890123456789012345678901234567890',
        amount: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
        currency: 'ETH',
        offChainTxHash: '0x' + 'a'.repeat(64),
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid Ethereum address format', () => {
      const result = recordTransactionSchema.safeParse({
        to: '0x123', // Too short
        amount: '1000000000000000000',
        currency: 'ETH',
        offChainTxHash: '0x' + 'a'.repeat(64),
      });
      expect(result.success).toBe(false);
    });

    it('should reject address without 0x prefix', () => {
      const result = recordTransactionSchema.safeParse({
        to: '1234567890123456789012345678901234567890',
        amount: '1000000000000000000',
        currency: 'ETH',
        offChainTxHash: '0x' + 'a'.repeat(64),
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid offChainTxHash format', () => {
      const result = recordTransactionSchema.safeParse({
        to: '0x1234567890123456789012345678901234567890',
        amount: '1000000000000000000',
        currency: 'ETH',
        offChainTxHash: '0x' + 'a'.repeat(32), // Too short
      });
      expect(result.success).toBe(false);
    });

    it('should accept different currencies', () => {
      const result = recordTransactionSchema.safeParse({
        to: '0x1234567890123456789012345678901234567890',
        amount: '1000000000000000000',
        currency: 'USDC',
        offChainTxHash: '0x' + 'a'.repeat(64),
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.currency).toBe('USDC');
      }
    });
  });

  // ============ Get Transaction Status Validation ============

  describe('Get Transaction Status Validation', () => {
    it('should validate correct transaction hash', () => {
      const result = getTransactionStatusSchema.safeParse({
        txHash: '0x' + 'a'.repeat(64),
      });
      expect(result.success).toBe(true);
    });

    it('should validate transaction hash with mixed case hex', () => {
      const result = getTransactionStatusSchema.safeParse({
        txHash: '0xaAbBcCdDeEfF' + '1'.repeat(52),
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing txHash', () => {
      const result = getTransactionStatusSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject invalid txHash format (too short)', () => {
      const result = getTransactionStatusSchema.safeParse({
        txHash: '0x' + 'a'.repeat(32),
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid txHash format (too long)', () => {
      const result = getTransactionStatusSchema.safeParse({
        txHash: '0x' + 'a'.repeat(65),
      });
      expect(result.success).toBe(false);
    });

    it('should reject txHash without 0x prefix', () => {
      const result = getTransactionStatusSchema.safeParse({
        txHash: 'a'.repeat(64),
      });
      expect(result.success).toBe(false);
    });

    it('should reject txHash with invalid characters', () => {
      const result = getTransactionStatusSchema.safeParse({
        txHash: '0x' + 'g'.repeat(64), // 'g' is not a valid hex character
      });
      expect(result.success).toBe(false);
    });
  });

  // ============ Transaction Hash Validation (isValidTxHash) ============

  describe('Transaction Hash Validation (isValidTxHash)', () => {
    it('should validate correct 64-character hex hash with 0x prefix', () => {
      expect(isValidTxHash('0x' + 'a'.repeat(64))).toBe(true);
    });

    it('should validate hash with uppercase hex characters', () => {
      expect(isValidTxHash('0x' + 'A'.repeat(64))).toBe(true);
    });

    it('should validate hash with mixed case hex characters', () => {
      expect(isValidTxHash('0xaAbBcCdDeEfF1122334455667788990011223344556677889900112233445566')).toBe(true);
    });

    it('should validate hash with all numeric characters', () => {
      expect(isValidTxHash('0x' + '1'.repeat(64))).toBe(true);
    });

    it('should validate real-world transaction hash format', () => {
      expect(isValidTxHash('0x5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060')).toBe(true);
    });

    it('should reject hash without 0x prefix', () => {
      expect(isValidTxHash('a'.repeat(64))).toBe(false);
    });

    it('should reject hash with too few characters', () => {
      expect(isValidTxHash('0x' + 'a'.repeat(63))).toBe(false);
    });

    it('should reject hash with too many characters', () => {
      expect(isValidTxHash('0x' + 'a'.repeat(65))).toBe(false);
    });

    it('should reject hash with invalid hex characters', () => {
      expect(isValidTxHash('0x' + 'g'.repeat(64))).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidTxHash('')).toBe(false);
    });

    it('should reject only 0x prefix', () => {
      expect(isValidTxHash('0x')).toBe(false);
    });

    it('should reject null-like values', () => {
      // @ts-expect-error Testing invalid input
      expect(isValidTxHash(null)).toBe(false);
      // @ts-expect-error Testing invalid input
      expect(isValidTxHash(undefined)).toBe(false);
    });

    it('should reject hash with spaces', () => {
      expect(isValidTxHash('0x ' + 'a'.repeat(64))).toBe(false);
    });

    it('should reject hash with special characters', () => {
      expect(isValidTxHash('0x!' + 'a'.repeat(63))).toBe(false);
    });
  });

  // ============ Ethereum Address Validation (isValidAddress) ============

  describe('Ethereum Address Validation (isValidAddress)', () => {
    it('should validate correct 40-character hex address with 0x prefix', () => {
      expect(isValidAddress('0x' + 'a'.repeat(40))).toBe(true);
    });

    it('should validate address with uppercase hex characters', () => {
      expect(isValidAddress('0x' + 'A'.repeat(40))).toBe(true);
    });

    it('should validate address with mixed case (checksummed)', () => {
      expect(isValidAddress('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed')).toBe(true);
    });

    it('should reject address without 0x prefix', () => {
      expect(isValidAddress('a'.repeat(40))).toBe(false);
    });

    it('should reject address with too few characters', () => {
      expect(isValidAddress('0x' + 'a'.repeat(39))).toBe(false);
    });

    it('should reject address with too many characters', () => {
      expect(isValidAddress('0x' + 'a'.repeat(41))).toBe(false);
    });

    it('should reject address with invalid hex characters', () => {
      expect(isValidAddress('0x' + 'g'.repeat(40))).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidAddress('')).toBe(false);
    });
  });

  // ============ Ethereum Address Schema Validation ============

  describe('Ethereum Address Schema Validation', () => {
    it('should validate correct address', () => {
      const result = ethereumAddressSchema.safeParse('0x1234567890123456789012345678901234567890');
      expect(result.success).toBe(true);
    });

    it('should reject invalid address', () => {
      const result = ethereumAddressSchema.safeParse('0x123');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid Ethereum address format');
      }
    });
  });

  // ============ Transaction Hash Schema Validation ============

  describe('Transaction Hash Schema Validation', () => {
    it('should validate correct transaction hash', () => {
      const result = transactionHashSchema.safeParse('0x' + 'f'.repeat(64));
      expect(result.success).toBe(true);
    });

    it('should reject invalid transaction hash', () => {
      const result = transactionHashSchema.safeParse('0x' + 'f'.repeat(32));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid transaction hash format');
      }
    });
  });

  // ============ Bytes32 Schema Validation ============

  describe('Bytes32 Schema Validation', () => {
    it('should validate correct bytes32 hash', () => {
      const result = bytes32Schema.safeParse('0x' + 'd'.repeat(64));
      expect(result.success).toBe(true);
    });

    it('should reject invalid bytes32 hash', () => {
      const result = bytes32Schema.safeParse('0x' + 'd'.repeat(10));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid bytes32 format');
      }
    });
  });

  // ============ Batch Transactions Schema Validation ============

  describe('Batch Transactions Schema Validation', () => {
    it('should validate batch with single transaction', () => {
      const result = recordBatchTransactionsSchema.safeParse({
        transactions: [
          {
            to: '0x1234567890123456789012345678901234567890',
            amount: '1000000000000000000',
            currency: 'ETH',
            offChainTxHash: '0x' + 'a'.repeat(64),
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should validate batch with multiple transactions', () => {
      const result = recordBatchTransactionsSchema.safeParse({
        transactions: [
          {
            to: '0x1234567890123456789012345678901234567890',
            amount: '1000000000000000000',
            offChainTxHash: '0x' + 'a'.repeat(64),
          },
          {
            to: '0x0987654321098765432109876543210987654321',
            amount: '2000000000000000000',
            currency: 'USDC',
            offChainTxHash: '0x' + 'b'.repeat(64),
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty transactions array', () => {
      const result = recordBatchTransactionsSchema.safeParse({
        transactions: [],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('At least one transaction required');
      }
    });

    it('should reject more than 50 transactions', () => {
      const transactions = Array(51)
        .fill(null)
        .map((_, i) => ({
          to: '0x1234567890123456789012345678901234567890',
          amount: '1000000000000000000',
          currency: 'ETH',
          offChainTxHash: '0x' + i.toString(16).padStart(64, '0'),
        }));

      const result = recordBatchTransactionsSchema.safeParse({ transactions });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Maximum 50 transactions per batch');
      }
    });

    it('should default currency to ETH in batch transactions', () => {
      const result = recordBatchTransactionsSchema.safeParse({
        transactions: [
          {
            to: '0x1234567890123456789012345678901234567890',
            amount: '1000000000000000000',
            offChainTxHash: '0x' + 'a'.repeat(64),
          },
        ],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.transactions[0].currency).toBe('ETH');
      }
    });
  });

  // ============ Get Balance Schema Validation ============

  describe('Get Balance Schema Validation', () => {
    it('should validate correct balance request', () => {
      const result = getBalanceSchema.safeParse({
        address: '0x1234567890123456789012345678901234567890',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing address', () => {
      const result = getBalanceSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject invalid address format', () => {
      const result = getBalanceSchema.safeParse({
        address: 'invalid-address',
      });
      expect(result.success).toBe(false);
    });
  });

  // ============ Edge Cases ============

  describe('Edge Cases', () => {
    it('should handle case sensitivity in hex addresses', () => {
      const lowerCase = '0xabcdef0123456789abcdef0123456789abcdef01';
      const upperCase = '0xABCDEF0123456789ABCDEF0123456789ABCDEF01';
      const mixedCase = '0xAbCdEf0123456789aBcDeF0123456789AbCdEf01';

      expect(isValidAddress(lowerCase)).toBe(true);
      expect(isValidAddress(upperCase)).toBe(true);
      expect(isValidAddress(mixedCase)).toBe(true);
    });

    it('should handle case sensitivity in transaction hashes', () => {
      const lowerCase = '0x' + 'abcdef'.repeat(10) + 'abcd';
      const upperCase = '0x' + 'ABCDEF'.repeat(10) + 'ABCD';
      const mixedCase = '0x' + 'AbCdEf'.repeat(10) + 'AbCd';

      expect(isValidTxHash(lowerCase)).toBe(true);
      expect(isValidTxHash(upperCase)).toBe(true);
      expect(isValidTxHash(mixedCase)).toBe(true);
    });

    it('should reject hash with 0X prefix (uppercase X)', () => {
      expect(isValidTxHash('0X' + 'a'.repeat(64))).toBe(false);
    });

    it('should reject address with 0X prefix (uppercase X)', () => {
      expect(isValidAddress('0X' + 'a'.repeat(40))).toBe(false);
    });

    it('should handle numeric-only hex strings', () => {
      expect(isValidTxHash('0x' + '1234567890'.repeat(6) + '1234')).toBe(true);
      expect(isValidAddress('0x' + '1234567890'.repeat(4))).toBe(true);
    });
  });
});
