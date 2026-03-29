import { describe, it, expect } from 'vitest';
import {
  ethereumAddressSchema,
  transactionHashSchema,
  bytes32Schema,
  hexStringSchema,
  connectMetaMaskSchema,
  verifySignatureSchema,
  recordTransactionSchema,
  getBalanceSchema,
} from '../../src/schemas/blockchain';

// ============ Test Constants ============

const VALID_ADDRESS_CHECKSUMMED = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
const VALID_ADDRESS_LOWERCASE = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed';
const VALID_TX_HASH = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
const VALID_BYTES32 = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
const VALID_SIGNATURE = '0x' + 'a'.repeat(130); // 132 chars total (0x + 130 hex chars)

// ============ ethereumAddressSchema Tests ============

describe('ethereumAddressSchema', () => {
  describe('valid addresses', () => {
    it('should validate checksummed Ethereum address', () => {
      const result = ethereumAddressSchema.safeParse(VALID_ADDRESS_CHECKSUMMED);
      expect(result.success).toBe(true);
    });

    it('should validate lowercase Ethereum address', () => {
      const result = ethereumAddressSchema.safeParse(VALID_ADDRESS_LOWERCASE);
      expect(result.success).toBe(true);
    });

    it('should validate uppercase Ethereum address', () => {
      const result = ethereumAddressSchema.safeParse('0x5AAEB6053F3E94C9B9A09F33669435E7EF1BEAED');
      expect(result.success).toBe(true);
    });

    it('should validate zero address', () => {
      const result = ethereumAddressSchema.safeParse('0x0000000000000000000000000000000000000000');
      expect(result.success).toBe(true);
    });
  });

  describe('invalid addresses', () => {
    it('should reject address without 0x prefix', () => {
      const result = ethereumAddressSchema.safeParse('5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed');
      expect(result.success).toBe(false);
    });

    it('should reject address with wrong length (too short)', () => {
      const result = ethereumAddressSchema.safeParse('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAe');
      expect(result.success).toBe(false);
    });

    it('should reject address with wrong length (too long)', () => {
      const result = ethereumAddressSchema.safeParse('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAedd');
      expect(result.success).toBe(false);
    });

    it('should reject address with invalid characters', () => {
      const result = ethereumAddressSchema.safeParse('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeG');
      expect(result.success).toBe(false);
    });

    it('should reject empty string', () => {
      const result = ethereumAddressSchema.safeParse('');
      expect(result.success).toBe(false);
    });

    it('should reject non-string values', () => {
      const result = ethereumAddressSchema.safeParse(12345);
      expect(result.success).toBe(false);
    });

    it('should reject null', () => {
      const result = ethereumAddressSchema.safeParse(null);
      expect(result.success).toBe(false);
    });
  });
});

// ============ transactionHashSchema Tests ============

describe('transactionHashSchema', () => {
  describe('valid transaction hashes', () => {
    it('should validate correct transaction hash', () => {
      const result = transactionHashSchema.safeParse(VALID_TX_HASH);
      expect(result.success).toBe(true);
    });

    it('should validate uppercase transaction hash', () => {
      const result = transactionHashSchema.safeParse('0x' + 'ABCDEF1234567890'.repeat(4));
      expect(result.success).toBe(true);
    });

    it('should validate mixed case transaction hash', () => {
      const result = transactionHashSchema.safeParse('0xAbCdEf1234567890AbCdEf1234567890AbCdEf1234567890AbCdEf1234567890');
      expect(result.success).toBe(true);
    });
  });

  describe('invalid transaction hashes', () => {
    it('should reject hash without 0x prefix', () => {
      const result = transactionHashSchema.safeParse('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
      expect(result.success).toBe(false);
    });

    it('should reject hash with wrong length (too short)', () => {
      const result = transactionHashSchema.safeParse('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcde');
      expect(result.success).toBe(false);
    });

    it('should reject hash with wrong length (too long)', () => {
      const result = transactionHashSchema.safeParse('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdeff');
      expect(result.success).toBe(false);
    });

    it('should reject hash with invalid characters', () => {
      const result = transactionHashSchema.safeParse('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdeg');
      expect(result.success).toBe(false);
    });

    it('should reject Ethereum address (40 chars instead of 64)', () => {
      const result = transactionHashSchema.safeParse(VALID_ADDRESS_LOWERCASE);
      expect(result.success).toBe(false);
    });
  });
});

// ============ bytes32Schema Tests ============

describe('bytes32Schema', () => {
  describe('valid bytes32 values', () => {
    it('should validate correct bytes32 hash', () => {
      const result = bytes32Schema.safeParse(VALID_BYTES32);
      expect(result.success).toBe(true);
    });

    it('should validate zero bytes32', () => {
      const result = bytes32Schema.safeParse('0x' + '0'.repeat(64));
      expect(result.success).toBe(true);
    });
  });

  describe('invalid bytes32 values', () => {
    it('should reject bytes32 without 0x prefix', () => {
      const result = bytes32Schema.safeParse('abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');
      expect(result.success).toBe(false);
    });

    it('should reject bytes32 with wrong length', () => {
      const result = bytes32Schema.safeParse('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef123456789');
      expect(result.success).toBe(false);
    });

    it('should reject bytes32 with invalid hex characters', () => {
      const result = bytes32Schema.safeParse('0xghijkl1234567890abcdef1234567890abcdef1234567890abcdef1234567890');
      expect(result.success).toBe(false);
    });
  });
});

// ============ hexStringSchema Tests ============

describe('hexStringSchema', () => {
  describe('valid hex strings', () => {
    it('should validate hex string with 0x prefix only', () => {
      const result = hexStringSchema.safeParse('0x');
      expect(result.success).toBe(true);
    });

    it('should validate short hex string', () => {
      const result = hexStringSchema.safeParse('0xab');
      expect(result.success).toBe(true);
    });

    it('should validate long hex string', () => {
      const result = hexStringSchema.safeParse('0x' + 'abcdef1234567890'.repeat(10));
      expect(result.success).toBe(true);
    });

    it('should validate Ethereum address as hex string', () => {
      const result = hexStringSchema.safeParse(VALID_ADDRESS_LOWERCASE);
      expect(result.success).toBe(true);
    });

    it('should validate transaction hash as hex string', () => {
      const result = hexStringSchema.safeParse(VALID_TX_HASH);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid hex strings', () => {
    it('should reject hex string without 0x prefix', () => {
      const result = hexStringSchema.safeParse('abcdef');
      expect(result.success).toBe(false);
    });

    it('should reject hex string with invalid characters', () => {
      const result = hexStringSchema.safeParse('0xghij');
      expect(result.success).toBe(false);
    });

    it('should reject empty string', () => {
      const result = hexStringSchema.safeParse('');
      expect(result.success).toBe(false);
    });
  });
});

// ============ connectMetaMaskSchema Tests ============

describe('connectMetaMaskSchema', () => {
  describe('valid connection data', () => {
    it('should validate complete connection data with nonce', () => {
      const validData = {
        address: VALID_ADDRESS_CHECKSUMMED,
        signature: VALID_SIGNATURE,
        message: 'Sign this message to verify your wallet',
        nonce: 'abc123',
      };
      const result = connectMetaMaskSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate connection data without optional nonce', () => {
      const validData = {
        address: VALID_ADDRESS_LOWERCASE,
        signature: VALID_SIGNATURE,
        message: 'Sign this message',
      };
      const result = connectMetaMaskSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate with longer signature', () => {
      const validData = {
        address: VALID_ADDRESS_CHECKSUMMED,
        signature: '0x' + 'a'.repeat(200),
        message: 'Test message',
      };
      const result = connectMetaMaskSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid connection data', () => {
    it('should reject missing address', () => {
      const invalidData = {
        signature: VALID_SIGNATURE,
        message: 'Sign this message',
      };
      const result = connectMetaMaskSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject missing signature', () => {
      const invalidData = {
        address: VALID_ADDRESS_CHECKSUMMED,
        message: 'Sign this message',
      };
      const result = connectMetaMaskSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject missing message', () => {
      const invalidData = {
        address: VALID_ADDRESS_CHECKSUMMED,
        signature: VALID_SIGNATURE,
      };
      const result = connectMetaMaskSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject empty message', () => {
      const invalidData = {
        address: VALID_ADDRESS_CHECKSUMMED,
        signature: VALID_SIGNATURE,
        message: '',
      };
      const result = connectMetaMaskSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject signature too short (less than 132 chars)', () => {
      const invalidData = {
        address: VALID_ADDRESS_CHECKSUMMED,
        signature: '0x' + 'a'.repeat(128), // 130 chars total, less than 132
        message: 'Sign this message',
      };
      const result = connectMetaMaskSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid Ethereum address format', () => {
      const invalidData = {
        address: '0xinvalidaddress',
        signature: VALID_SIGNATURE,
        message: 'Sign this message',
      };
      const result = connectMetaMaskSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid signature format (not hex)', () => {
      const invalidData = {
        address: VALID_ADDRESS_CHECKSUMMED,
        signature: 'invalidSignatureNotHex',
        message: 'Sign this message',
      };
      const result = connectMetaMaskSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});

// ============ verifySignatureSchema Tests ============

describe('verifySignatureSchema', () => {
  describe('valid signature verification data', () => {
    it('should validate complete verification data', () => {
      const validData = {
        address: VALID_ADDRESS_CHECKSUMMED,
        signature: '0xabcdef',
        message: 'Verify this',
      };
      const result = verifySignatureSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate with empty message', () => {
      const validData = {
        address: VALID_ADDRESS_LOWERCASE,
        signature: '0x',
        message: '',
      };
      const result = verifySignatureSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid signature verification data', () => {
    it('should reject missing address', () => {
      const invalidData = {
        signature: '0xabcdef',
        message: 'Verify this',
      };
      const result = verifySignatureSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid address', () => {
      const invalidData = {
        address: 'not-an-address',
        signature: '0xabcdef',
        message: 'Verify this',
      };
      const result = verifySignatureSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject missing signature', () => {
      const invalidData = {
        address: VALID_ADDRESS_CHECKSUMMED,
        message: 'Verify this',
      };
      const result = verifySignatureSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid signature format', () => {
      const invalidData = {
        address: VALID_ADDRESS_CHECKSUMMED,
        signature: 'no-hex-prefix',
        message: 'Verify this',
      };
      const result = verifySignatureSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});

// ============ recordTransactionSchema Tests ============

describe('recordTransactionSchema', () => {
  describe('valid transaction recording data', () => {
    it('should validate complete transaction data with signature', () => {
      const validData = {
        to: VALID_ADDRESS_CHECKSUMMED,
        amount: '1000000000000000000',
        currency: 'ETH',
        offChainTxHash: VALID_BYTES32,
        signature: '0xabcdef123',
      };
      const result = recordTransactionSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate transaction data without optional signature', () => {
      const validData = {
        to: VALID_ADDRESS_LOWERCASE,
        amount: '0',
        currency: 'USDC',
        offChainTxHash: VALID_BYTES32,
      };
      const result = recordTransactionSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate with default currency', () => {
      const validData = {
        to: VALID_ADDRESS_CHECKSUMMED,
        amount: '123456789',
        offChainTxHash: VALID_BYTES32,
      };
      const result = recordTransactionSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.currency).toBe('ETH');
      }
    });

    it('should validate large wei amount', () => {
      const validData = {
        to: VALID_ADDRESS_CHECKSUMMED,
        amount: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
        currency: 'ETH',
        offChainTxHash: VALID_BYTES32,
      };
      const result = recordTransactionSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid transaction recording data', () => {
    it('should reject non-numeric amount', () => {
      const invalidData = {
        to: VALID_ADDRESS_CHECKSUMMED,
        amount: '1.5',
        currency: 'ETH',
        offChainTxHash: VALID_BYTES32,
      };
      const result = recordTransactionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject amount with letters', () => {
      const invalidData = {
        to: VALID_ADDRESS_CHECKSUMMED,
        amount: '100abc',
        currency: 'ETH',
        offChainTxHash: VALID_BYTES32,
      };
      const result = recordTransactionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject negative amount', () => {
      const invalidData = {
        to: VALID_ADDRESS_CHECKSUMMED,
        amount: '-100',
        currency: 'ETH',
        offChainTxHash: VALID_BYTES32,
      };
      const result = recordTransactionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid to address', () => {
      const invalidData = {
        to: '0xinvalid',
        amount: '1000',
        currency: 'ETH',
        offChainTxHash: VALID_BYTES32,
      };
      const result = recordTransactionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid offChainTxHash', () => {
      const invalidData = {
        to: VALID_ADDRESS_CHECKSUMMED,
        amount: '1000',
        currency: 'ETH',
        offChainTxHash: '0xinvalidhash',
      };
      const result = recordTransactionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject missing to address', () => {
      const invalidData = {
        amount: '1000',
        currency: 'ETH',
        offChainTxHash: VALID_BYTES32,
      };
      const result = recordTransactionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject missing amount', () => {
      const invalidData = {
        to: VALID_ADDRESS_CHECKSUMMED,
        currency: 'ETH',
        offChainTxHash: VALID_BYTES32,
      };
      const result = recordTransactionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject missing offChainTxHash', () => {
      const invalidData = {
        to: VALID_ADDRESS_CHECKSUMMED,
        amount: '1000',
        currency: 'ETH',
      };
      const result = recordTransactionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid signature format', () => {
      const invalidData = {
        to: VALID_ADDRESS_CHECKSUMMED,
        amount: '1000',
        currency: 'ETH',
        offChainTxHash: VALID_BYTES32,
        signature: 'not-a-hex-signature',
      };
      const result = recordTransactionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});

// ============ getBalanceSchema Tests ============

describe('getBalanceSchema', () => {
  describe('valid balance queries', () => {
    it('should validate query with checksummed address', () => {
      const validData = {
        address: VALID_ADDRESS_CHECKSUMMED,
      };
      const result = getBalanceSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate query with lowercase address', () => {
      const validData = {
        address: VALID_ADDRESS_LOWERCASE,
      };
      const result = getBalanceSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate query with zero address', () => {
      const validData = {
        address: '0x0000000000000000000000000000000000000000',
      };
      const result = getBalanceSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid balance queries', () => {
    it('should reject missing address', () => {
      const invalidData = {};
      const result = getBalanceSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid address format', () => {
      const invalidData = {
        address: 'not-an-address',
      };
      const result = getBalanceSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject address without 0x prefix', () => {
      const invalidData = {
        address: '5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
      };
      const result = getBalanceSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject address with wrong length', () => {
      const invalidData = {
        address: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1Be',
      };
      const result = getBalanceSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject null address', () => {
      const invalidData = {
        address: null,
      };
      const result = getBalanceSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});
