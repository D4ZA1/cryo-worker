/**
 * Ethereum RPC Client for Cloudflare Workers
 * Uses viem for edge runtime compatibility
 */

import { createPublicClient, http, formatEther, parseEther, type PublicClient, type Chain } from 'viem';
import { mainnet, sepolia, hardhat } from 'viem/chains';

// ============ Types ============

export interface EthereumConfig {
  rpcUrl: string;
  chainId: number;
  networkName: string;
}

export interface GasPrice {
  gasPrice: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  timestamp: string;
}

export interface TransactionReceipt {
  transactionHash: string;
  blockNumber: bigint;
  blockHash: string;
  status: 'success' | 'reverted';
  gasUsed: bigint;
  effectiveGasPrice: bigint;
  from: string;
  to: string | null;
  logs: any[];
}

// ============ Chain Configuration ============

const SUPPORTED_CHAINS: Record<number, Chain> = {
  1: mainnet,
  11155111: sepolia,
  31337: hardhat,
};

/**
 * Get chain configuration by chain ID
 */
export function getChain(chainId: number): Chain {
  const chain = SUPPORTED_CHAINS[chainId];
  if (!chain) {
    // Create custom chain for unknown chain IDs
    return {
      id: chainId,
      name: `Chain ${chainId}`,
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: {
        default: { http: [] },
      },
    } as Chain;
  }
  return chain;
}

// ============ Client Factory ============

/**
 * Create a viem public client for Ethereum RPC calls
 */
export function createEthereumClient(config: EthereumConfig): PublicClient {
  const chain = getChain(config.chainId);
  
  return createPublicClient({
    chain: {
      ...chain,
      rpcUrls: {
        ...chain.rpcUrls,
        default: { http: [config.rpcUrl] },
      },
    },
    transport: http(config.rpcUrl, {
      timeout: 30000, // 30 second timeout
      retryCount: 3,
      retryDelay: 1000,
    }),
  });
}

/**
 * Create client from environment variables
 */
export function createClientFromEnv(env: {
  ETHEREUM_RPC_URL: string;
  ETHEREUM_CHAIN_ID: string;
  ETHEREUM_NETWORK: string;
}): PublicClient {
  return createEthereumClient({
    rpcUrl: env.ETHEREUM_RPC_URL,
    chainId: parseInt(env.ETHEREUM_CHAIN_ID, 10),
    networkName: env.ETHEREUM_NETWORK,
  });
}

// ============ RPC Methods ============

/**
 * Get the current block number
 */
export async function getBlockNumber(client: PublicClient): Promise<bigint> {
  return client.getBlockNumber();
}

/**
 * Get the balance of an address in wei
 */
export async function getBalance(client: PublicClient, address: `0x${string}`): Promise<bigint> {
  return client.getBalance({ address });
}

/**
 * Get the balance formatted as ETH string
 */
export async function getBalanceFormatted(
  client: PublicClient,
  address: `0x${string}`
): Promise<{ wei: string; eth: string }> {
  const balance = await getBalance(client, address);
  return {
    wei: balance.toString(),
    eth: formatEther(balance),
  };
}

/**
 * Get current gas prices
 */
export async function getGasPrice(client: PublicClient): Promise<GasPrice> {
  const gasPrice = await client.getGasPrice();
  
  // Try to get EIP-1559 gas prices
  let maxFeePerGas: bigint | undefined;
  let maxPriorityFeePerGas: bigint | undefined;
  
  try {
    const feeData = await client.estimateFeesPerGas();
    maxFeePerGas = feeData.maxFeePerGas;
    maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
  } catch {
    // Network doesn't support EIP-1559
  }
  
  return {
    gasPrice: gasPrice.toString(),
    maxFeePerGas: maxFeePerGas?.toString(),
    maxPriorityFeePerGas: maxPriorityFeePerGas?.toString(),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get transaction receipt
 */
export async function getTransactionReceipt(
  client: PublicClient,
  txHash: `0x${string}`
): Promise<TransactionReceipt | null> {
  const receipt = await client.getTransactionReceipt({ hash: txHash });
  
  if (!receipt) return null;
  
  return {
    transactionHash: receipt.transactionHash,
    blockNumber: receipt.blockNumber,
    blockHash: receipt.blockHash,
    status: receipt.status,
    gasUsed: receipt.gasUsed,
    effectiveGasPrice: receipt.effectiveGasPrice,
    from: receipt.from,
    to: receipt.to,
    logs: receipt.logs,
  };
}

/**
 * Wait for transaction confirmation
 */
export async function waitForTransaction(
  client: PublicClient,
  txHash: `0x${string}`,
  confirmations: number = 1,
  timeout: number = 60000
): Promise<TransactionReceipt> {
  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    confirmations,
    timeout,
  });
  
  return {
    transactionHash: receipt.transactionHash,
    blockNumber: receipt.blockNumber,
    blockHash: receipt.blockHash,
    status: receipt.status,
    gasUsed: receipt.gasUsed,
    effectiveGasPrice: receipt.effectiveGasPrice,
    from: receipt.from,
    to: receipt.to,
    logs: receipt.logs,
  };
}

/**
 * Get transaction count (nonce) for an address
 */
export async function getTransactionCount(
  client: PublicClient,
  address: `0x${string}`
): Promise<number> {
  return client.getTransactionCount({ address });
}

/**
 * Check if an address is a contract
 */
export async function isContract(
  client: PublicClient,
  address: `0x${string}`
): Promise<boolean> {
  const code = await client.getCode({ address });
  return code !== undefined && code !== '0x';
}

/**
 * Get chain ID
 */
export async function getChainId(client: PublicClient): Promise<number> {
  return client.getChainId();
}

// ============ Utility Functions ============

/**
 * Convert wei to ETH
 */
export function weiToEth(wei: bigint | string): string {
  const weiValue = typeof wei === 'string' ? BigInt(wei) : wei;
  return formatEther(weiValue);
}

/**
 * Convert ETH to wei
 */
export function ethToWei(eth: string): bigint {
  return parseEther(eth);
}

/**
 * Validate Ethereum address format
 */
export function isValidAddress(address: string): address is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate transaction hash format
 */
export function isValidTxHash(hash: string): hash is `0x${string}` {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

/**
 * Checksummed address (mixed case)
 */
export function toChecksumAddress(address: string): `0x${string}` {
  // viem handles checksumming internally
  if (!isValidAddress(address)) {
    throw new Error('Invalid Ethereum address');
  }
  return address.toLowerCase() as `0x${string}`;
}
