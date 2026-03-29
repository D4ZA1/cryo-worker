import { describe, it, expect } from 'vitest';
import { isValidAddress, isValidTxHash, weiToEth, ethToWei } from '../../src/lib/ethereum';
import {
  CRYOPAY_CONTRACT_ABI,
  CONTRACT_ADDRESSES,
  type NetworkName,
} from '../../src/lib/smartContract';

/**
 * Ethereum Routes Tests
 * Tests for utility functions and validation logic used by Ethereum API routes
 */

describe('Ethereum Routes', () => {
  describe('Address validation', () => {
    describe('isValidAddress', () => {
      it('should return true for valid lowercase address', () => {
        const address = '0x742d35cc6634c0532925a3b844bc9e7595f68980';
        expect(isValidAddress(address)).toBe(true);
      });

      it('should return true for valid uppercase address', () => {
        const address = '0x742D35CC6634C0532925A3B844BC9E7595F68980';
        expect(isValidAddress(address)).toBe(true);
      });

      it('should return true for valid mixed case address', () => {
        const address = '0x742d35Cc6634C0532925a3b844Bc9e7595F68980';
        expect(isValidAddress(address)).toBe(true);
      });

      it('should return false for address without 0x prefix', () => {
        const address = '742d35cc6634c0532925a3b844bc9e7595f68980';
        expect(isValidAddress(address)).toBe(false);
      });

      it('should return false for address that is too short', () => {
        const address = '0x742d35cc6634c0532925a3b844bc9e7595f6898';
        expect(isValidAddress(address)).toBe(false);
      });

      it('should return false for address that is too long', () => {
        const address = '0x742d35cc6634c0532925a3b844bc9e7595f689800';
        expect(isValidAddress(address)).toBe(false);
      });

      it('should return false for address with invalid characters', () => {
        const address = '0x742d35cc6634c0532925a3b844bc9e7595f6898g';
        expect(isValidAddress(address)).toBe(false);
      });

      it('should return false for empty string', () => {
        expect(isValidAddress('')).toBe(false);
      });

      it('should return false for null-like values', () => {
        expect(isValidAddress('null')).toBe(false);
        expect(isValidAddress('undefined')).toBe(false);
      });

      it('should return false for just 0x prefix', () => {
        expect(isValidAddress('0x')).toBe(false);
      });

      it('should return true for zero address', () => {
        const zeroAddress = '0x0000000000000000000000000000000000000000';
        expect(isValidAddress(zeroAddress)).toBe(true);
      });
    });

    describe('isValidTxHash', () => {
      it('should return true for valid transaction hash', () => {
        const txHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
        expect(isValidTxHash(txHash)).toBe(true);
      });

      it('should return true for valid uppercase transaction hash', () => {
        const txHash = '0x1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF';
        expect(isValidTxHash(txHash)).toBe(true);
      });

      it('should return false for transaction hash that is too short', () => {
        const txHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcde';
        expect(isValidTxHash(txHash)).toBe(false);
      });

      it('should return false for transaction hash that is too long', () => {
        const txHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdeff';
        expect(isValidTxHash(txHash)).toBe(false);
      });

      it('should return false for transaction hash without 0x prefix', () => {
        const txHash = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
        expect(isValidTxHash(txHash)).toBe(false);
      });

      it('should return false for empty string', () => {
        expect(isValidTxHash('')).toBe(false);
      });
    });
  });

  describe('ETH/Wei conversion utilities', () => {
    describe('weiToEth', () => {
      it('should convert 1 ETH in wei to "1" ETH string', () => {
        const oneEthInWei = BigInt('1000000000000000000');
        expect(weiToEth(oneEthInWei)).toBe('1');
      });

      it('should convert string wei value', () => {
        const weiString = '1000000000000000000';
        expect(weiToEth(weiString)).toBe('1');
      });

      it('should handle decimal ETH values', () => {
        const halfEthInWei = BigInt('500000000000000000');
        expect(weiToEth(halfEthInWei)).toBe('0.5');
      });

      it('should handle zero', () => {
        expect(weiToEth(0n)).toBe('0');
      });
    });

    describe('ethToWei', () => {
      it('should convert "1" ETH to 1e18 wei', () => {
        const result = ethToWei('1');
        expect(result).toBe(BigInt('1000000000000000000'));
      });

      it('should convert decimal ETH to wei', () => {
        const result = ethToWei('0.5');
        expect(result).toBe(BigInt('500000000000000000'));
      });

      it('should convert small ETH amounts', () => {
        const result = ethToWei('0.001');
        expect(result).toBe(BigInt('1000000000000000'));
      });
    });
  });

  describe('Contract ABI', () => {
    describe('CRYOPAY_CONTRACT_ABI structure', () => {
      it('should be an array', () => {
        expect(Array.isArray(CRYOPAY_CONTRACT_ABI)).toBe(true);
      });

      it('should contain expected events', () => {
        const eventNames = CRYOPAY_CONTRACT_ABI
          .filter((item) => item.type === 'event')
          .map((item) => item.name);

        expect(eventNames).toContain('UserRegistered');
        expect(eventNames).toContain('TransactionRecorded');
      });

      it('should contain expected view functions', () => {
        const functionNames = CRYOPAY_CONTRACT_ABI
          .filter((item) => item.type === 'function')
          .map((item) => item.name);

        expect(functionNames).toContain('getTransactionCount');
        expect(functionNames).toContain('getTotalTransactions');
        expect(functionNames).toContain('isTransactionRecorded');
        expect(functionNames).toContain('getTransactions');
        expect(functionNames).toContain('transactionCounts');
        expect(functionNames).toContain('recordedTxHashes');
      });

      it('should have correct structure for UserRegistered event', () => {
        const userRegisteredEvent = CRYOPAY_CONTRACT_ABI.find(
          (item) => item.type === 'event' && item.name === 'UserRegistered'
        );

        expect(userRegisteredEvent).toBeDefined();
        expect(userRegisteredEvent?.inputs).toHaveLength(1);
        expect(userRegisteredEvent?.inputs[0]).toEqual({
          name: 'user',
          type: 'address',
          indexed: true,
        });
      });

      it('should have correct structure for TransactionRecorded event', () => {
        const transactionRecordedEvent = CRYOPAY_CONTRACT_ABI.find(
          (item) => item.type === 'event' && item.name === 'TransactionRecorded'
        );

        expect(transactionRecordedEvent).toBeDefined();
        expect(transactionRecordedEvent?.inputs).toHaveLength(6);

        const inputNames = transactionRecordedEvent?.inputs.map((input) => input.name);
        expect(inputNames).toEqual(['from', 'to', 'amount', 'currency', 'timestamp', 'txHash']);
      });

      it('should have getTransactions function with pagination parameters', () => {
        const getTransactionsFunc = CRYOPAY_CONTRACT_ABI.find(
          (item) => item.type === 'function' && item.name === 'getTransactions'
        );

        expect(getTransactionsFunc).toBeDefined();
        expect(getTransactionsFunc?.inputs).toHaveLength(3);

        const inputNames = getTransactionsFunc?.inputs.map((input) => input.name);
        expect(inputNames).toEqual(['user', 'offset', 'limit']);
      });
    });
  });

  describe('Contract Addresses', () => {
    describe('CONTRACT_ADDRESSES', () => {
      it('should have localhost network key', () => {
        expect(CONTRACT_ADDRESSES).toHaveProperty('localhost');
      });

      it('should have hardhat network key', () => {
        expect(CONTRACT_ADDRESSES).toHaveProperty('hardhat');
      });

      it('should have sepolia network key', () => {
        expect(CONTRACT_ADDRESSES).toHaveProperty('sepolia');
      });

      it('should have mainnet network key', () => {
        expect(CONTRACT_ADDRESSES).toHaveProperty('mainnet');
      });

      it('should have valid address format for localhost', () => {
        const address = CONTRACT_ADDRESSES.localhost;
        expect(isValidAddress(address)).toBe(true);
      });

      it('should have valid address format for hardhat', () => {
        const address = CONTRACT_ADDRESSES.hardhat;
        expect(isValidAddress(address)).toBe(true);
      });

      it('should have same address for localhost and hardhat (default local deployment)', () => {
        expect(CONTRACT_ADDRESSES.localhost).toBe(CONTRACT_ADDRESSES.hardhat);
      });

      it('should have expected network names as keys', () => {
        const networkNames = Object.keys(CONTRACT_ADDRESSES) as NetworkName[];
        expect(networkNames).toContain('localhost');
        expect(networkNames).toContain('hardhat');
        expect(networkNames).toContain('sepolia');
        expect(networkNames).toContain('mainnet');
        expect(networkNames).toHaveLength(4);
      });
    });
  });
});
