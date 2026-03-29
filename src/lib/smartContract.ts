/**
 * Smart Contract Interaction Helpers
 * For CryoPayTransactionRecorder contract
 */

import {
  createPublicClient,
  http,
  type PublicClient,
  type Address,
  decodeEventLog,
  type Log,
  getContract,
  type GetContractReturnType,
} from 'viem';
import { hardhat, sepolia } from 'viem/chains';

// ============ Contract ABI ============

// Minimal ABI for the functions we need
// Full ABI can be imported from contracts/abi if needed
export const CRYOPAY_CONTRACT_ABI = [
  // Events
  {
    type: 'event',
    name: 'UserRegistered',
    inputs: [{ name: 'user', type: 'address', indexed: true }],
  },
  {
    type: 'event',
    name: 'TransactionRecorded',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'currency', type: 'string', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
      { name: 'txHash', type: 'bytes32', indexed: false },
    ],
  },
  // Read functions
  {
    type: 'function',
    name: 'getTransactionCount',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTotalTransactions',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isTransactionRecorded',
    inputs: [{ name: 'txHash', type: 'bytes32' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTransactions',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' },
    ],
    outputs: [
      {
        type: 'tuple[]',
        components: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'currency', type: 'string' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'txHash', type: 'bytes32' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'transactionCounts',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'recordedTxHashes',
    inputs: [{ name: '', type: 'bytes32' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
] as const;

// ============ Types ============

export interface ContractConfig {
  address: Address;
  rpcUrl: string;
  chainId: number;
}

export interface ContractTransaction {
  from: Address;
  to: Address;
  amount: bigint;
  currency: string;
  timestamp: bigint;
  txHash: `0x${string}`;
}

export interface TransactionRecordedEvent {
  from: Address;
  to: Address;
  amount: bigint;
  currency: string;
  timestamp: bigint;
  txHash: `0x${string}`;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  logIndex: number;
}

export interface UserRegisteredEvent {
  user: Address;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  logIndex: number;
}

// ============ Contract Client ============

export class CryoPayContract {
  private client: PublicClient;
  private contract: GetContractReturnType<typeof CRYOPAY_CONTRACT_ABI, PublicClient>;
  public readonly address: Address;

  constructor(config: ContractConfig) {
    const chain = config.chainId === 31337 ? hardhat : sepolia;
    
    this.client = createPublicClient({
      chain: {
        ...chain,
        rpcUrls: {
          ...chain.rpcUrls,
          default: { http: [config.rpcUrl] },
        },
      },
      transport: http(config.rpcUrl),
    });
    
    this.address = config.address;
    this.contract = getContract({
      address: config.address,
      abi: CRYOPAY_CONTRACT_ABI,
      client: this.client,
    });
  }

  /**
   * Get transaction count for a user
   */
  async getTransactionCount(userAddress: Address): Promise<bigint> {
    return this.contract.read.getTransactionCount([userAddress]);
  }

  /**
   * Get total transactions for a user
   */
  async getTotalTransactions(userAddress: Address): Promise<bigint> {
    return this.contract.read.getTotalTransactions([userAddress]);
  }

  /**
   * Check if a transaction hash is already recorded
   */
  async isTransactionRecorded(txHash: `0x${string}`): Promise<boolean> {
    return this.contract.read.isTransactionRecorded([txHash]);
  }

  /**
   * Get transactions for a user with pagination
   */
  async getTransactions(
    userAddress: Address,
    offset: bigint = 0n,
    limit: bigint = 10n
  ): Promise<ContractTransaction[]> {
    const transactions = await this.contract.read.getTransactions([
      userAddress,
      offset,
      limit,
    ]);
    
    return transactions.map((tx) => ({
      from: tx.from,
      to: tx.to,
      amount: tx.amount,
      currency: tx.currency,
      timestamp: tx.timestamp,
      txHash: tx.txHash,
    }));
  }

  /**
   * Get TransactionRecorded events
   */
  async getTransactionRecordedEvents(
    fromBlock: bigint,
    toBlock: bigint | 'latest' = 'latest'
  ): Promise<TransactionRecordedEvent[]> {
    const logs = await this.client.getLogs({
      address: this.address,
      event: {
        type: 'event',
        name: 'TransactionRecorded',
        inputs: [
          { name: 'from', type: 'address', indexed: true },
          { name: 'to', type: 'address', indexed: true },
          { name: 'amount', type: 'uint256', indexed: false },
          { name: 'currency', type: 'string', indexed: false },
          { name: 'timestamp', type: 'uint256', indexed: false },
          { name: 'txHash', type: 'bytes32', indexed: false },
        ],
      },
      fromBlock,
      toBlock,
    });

    return logs.map((log) => ({
      from: log.args.from!,
      to: log.args.to!,
      amount: log.args.amount!,
      currency: log.args.currency!,
      timestamp: log.args.timestamp!,
      txHash: log.args.txHash!,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      logIndex: log.logIndex,
    }));
  }

  /**
   * Get UserRegistered events
   */
  async getUserRegisteredEvents(
    fromBlock: bigint,
    toBlock: bigint | 'latest' = 'latest'
  ): Promise<UserRegisteredEvent[]> {
    const logs = await this.client.getLogs({
      address: this.address,
      event: {
        type: 'event',
        name: 'UserRegistered',
        inputs: [{ name: 'user', type: 'address', indexed: true }],
      },
      fromBlock,
      toBlock,
    });

    return logs.map((log) => ({
      user: log.args.user!,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      logIndex: log.logIndex,
    }));
  }

  /**
   * Get the current block number
   */
  async getBlockNumber(): Promise<bigint> {
    return this.client.getBlockNumber();
  }
}

// ============ Factory Function ============

/**
 * Create CryoPayContract instance from environment variables
 */
export function createContractFromEnv(env: {
  CRYOPAY_CONTRACT_ADDRESS: string;
  ETHEREUM_RPC_URL: string;
  ETHEREUM_CHAIN_ID: string;
}): CryoPayContract {
  return new CryoPayContract({
    address: env.CRYOPAY_CONTRACT_ADDRESS as Address,
    rpcUrl: env.ETHEREUM_RPC_URL,
    chainId: parseInt(env.ETHEREUM_CHAIN_ID, 10),
  });
}

// ============ Event Decoding Helpers ============

/**
 * Decode a TransactionRecorded event from a log
 */
export function decodeTransactionRecordedEvent(log: Log): TransactionRecordedEvent | null {
  try {
    const decoded = decodeEventLog({
      abi: CRYOPAY_CONTRACT_ABI,
      data: log.data,
      topics: log.topics,
    });

    if (decoded.eventName !== 'TransactionRecorded') return null;

    const args = decoded.args as {
      from: Address;
      to: Address;
      amount: bigint;
      currency: string;
      timestamp: bigint;
      txHash: `0x${string}`;
    };

    // Ensure we have required log metadata
    if (log.blockNumber === null || log.transactionHash === null || log.logIndex === null) {
      return null;
    }

    return {
      ...args,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      logIndex: log.logIndex,
    };
  } catch {
    return null;
  }
}

/**
 * Decode a UserRegistered event from a log
 */
export function decodeUserRegisteredEvent(log: Log): UserRegisteredEvent | null {
  try {
    const decoded = decodeEventLog({
      abi: CRYOPAY_CONTRACT_ABI,
      data: log.data,
      topics: log.topics,
    });

    if (decoded.eventName !== 'UserRegistered') return null;

    const args = decoded.args as { user: Address };

    // Ensure we have required log metadata
    if (log.blockNumber === null || log.transactionHash === null || log.logIndex === null) {
      return null;
    }

    return {
      user: args.user,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      logIndex: log.logIndex,
    };
  } catch {
    return null;
  }
}

// ============ Contract Address Constants ============

export const CONTRACT_ADDRESSES = {
  localhost: '0x5FbDB2315678afecb367f032d93F642f64180aa3' as Address,
  hardhat: '0x5FbDB2315678afecb367f032d93F642f64180aa3' as Address,
  sepolia: '' as Address, // To be filled after Sepolia deployment
  mainnet: '' as Address, // To be filled for production
} as const;

export type NetworkName = keyof typeof CONTRACT_ADDRESSES;

/**
 * Get contract address for a specific network
 */
export function getContractAddress(network: NetworkName): Address {
  const address = CONTRACT_ADDRESSES[network];
  if (!address) {
    throw new Error(`Contract not deployed on ${network}`);
  }
  return address;
}
