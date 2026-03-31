import { z } from 'zod';

// ============ Ethereum Address Validation ============

/**
 * Validates an Ethereum address (0x followed by 40 hex characters)
 */
export const ethereumAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address format');

/**
 * Validates a transaction hash (0x followed by 64 hex characters)
 */
export const transactionHashSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash format');

/**
 * Validates a bytes32 hash (0x followed by 64 hex characters)
 */
export const bytes32Schema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid bytes32 format');

/**
 * Validates a hex string
 */
export const hexStringSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]*$/, 'Invalid hex string');

// ============ MetaMask Authentication ============

/**
 * Schema for MetaMask wallet connection/registration
 */
export const connectMetaMaskSchema = z.object({
  address: ethereumAddressSchema,
  signature: hexStringSchema.min(132, 'Signature too short'), // Minimum valid signature length
  message: z.string().min(1, 'Message is required'),
  nonce: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

/**
 * Schema for signature verification
 */
export const verifySignatureSchema = z.object({
  address: ethereumAddressSchema,
  signature: hexStringSchema,
  message: z.string(),
});

// ============ Transaction Recording ============

/**
 * Schema for recording a transaction on-chain
 */
export const recordTransactionSchema = z.object({
  to: ethereumAddressSchema,
  amount: z.string().regex(/^\d+$/, 'Amount must be a numeric string (wei)'),
  currency: z.string().default('ETH'),
  offChainTxHash: bytes32Schema,
  signature: hexStringSchema.optional(), // For verification
});

/**
 * Schema for batch transaction recording
 */
export const recordBatchTransactionsSchema = z.object({
  transactions: z.array(z.object({
    to: ethereumAddressSchema,
    amount: z.string().regex(/^\d+$/, 'Amount must be a numeric string'),
    currency: z.string().default('ETH'),
    offChainTxHash: bytes32Schema,
  })).min(1, 'At least one transaction required').max(50, 'Maximum 50 transactions per batch'),
});

/**
 * Schema for getting transaction status
 */
export const getTransactionStatusSchema = z.object({
  txHash: transactionHashSchema,
});

// ============ Ethereum Queries ============

/**
 * Schema for balance query
 */
export const getBalanceSchema = z.object({
  address: ethereumAddressSchema,
});

/**
 * Schema for gas price response
 */
export const gasPriceResponseSchema = z.object({
  gasPrice: z.string(),
  maxFeePerGas: z.string().optional(),
  maxPriorityFeePerGas: z.string().optional(),
  timestamp: z.string(),
});

// ============ Database Models ============

/**
 * Schema for ethereum_users table
 */
export const ethereumUserSchema = z.object({
  id: z.string().uuid(),
  ethereum_address: ethereumAddressSchema,
  verified: z.number().int().min(0).max(1).default(0),
  balance_wei: z.string().nullable(),
  nonce: z.number().int().default(0),
  created_at: z.string(),
  updated_at: z.string(),
});

/**
 * Schema for blockchain_transactions table
 */
export const blockchainTransactionSchema = z.object({
  id: z.number().int().optional(),
  user_id: z.string().uuid(),
  tx_hash: transactionHashSchema,
  from_address: ethereumAddressSchema,
  to_address: ethereumAddressSchema,
  amount_wei: z.string(),
  currency: z.string().default('ETH'),
  status: z.enum(['pending', 'confirmed', 'failed']).default('pending'),
  block_number: z.number().int().nullable(),
  confirmations: z.number().int().default(0),
  gas_used: z.string().nullable(),
  transaction_fee: z.string().nullable(),
  created_at: z.string(),
  confirmed_at: z.string().nullable(),
});

/**
 * Schema for contract_events table
 */
export const contractEventSchema = z.object({
  id: z.number().int().optional(),
  event_name: z.enum(['TransactionRecorded', 'UserRegistered']),
  block_number: z.number().int(),
  transaction_hash: transactionHashSchema,
  from_address: ethereumAddressSchema.nullable(),
  to_address: ethereumAddressSchema.nullable(),
  amount: z.string().nullable(),
  currency: z.string().nullable(),
  log_index: z.number().int(),
  created_at: z.string(),
});

// ============ API Response Types ============

/**
 * Schema for transaction recording response
 */
export const recordTransactionResponseSchema = z.object({
  success: z.boolean(),
  txHash: transactionHashSchema.optional(),
  blockNumber: z.number().int().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

/**
 * Schema for balance response
 */
export const balanceResponseSchema = z.object({
  address: ethereumAddressSchema,
  balanceWei: z.string(),
  balanceEth: z.string(),
  timestamp: z.string(),
});

// ============ Type Exports ============

export type EthereumAddress = z.infer<typeof ethereumAddressSchema>;
export type TransactionHash = z.infer<typeof transactionHashSchema>;
export type ConnectMetaMask = z.infer<typeof connectMetaMaskSchema>;
export type VerifySignature = z.infer<typeof verifySignatureSchema>;
export type RecordTransaction = z.infer<typeof recordTransactionSchema>;
export type RecordBatchTransactions = z.infer<typeof recordBatchTransactionsSchema>;
export type GetTransactionStatus = z.infer<typeof getTransactionStatusSchema>;
export type GetBalance = z.infer<typeof getBalanceSchema>;
export type EthereumUser = z.infer<typeof ethereumUserSchema>;
export type BlockchainTransaction = z.infer<typeof blockchainTransactionSchema>;
export type ContractEvent = z.infer<typeof contractEventSchema>;
export type RecordTransactionResponse = z.infer<typeof recordTransactionResponseSchema>;
export type BalanceResponse = z.infer<typeof balanceResponseSchema>;
export type GasPriceResponse = z.infer<typeof gasPriceResponseSchema>;
