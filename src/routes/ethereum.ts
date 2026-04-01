/**
 * Ethereum API Routes
 * Provides gas price, balance, and contract information endpoints
 */

import { Hono } from 'hono';
import type { Env } from '../db/schema';
import {
  createClientFromEnv,
  getGasPrice,
  getBalanceFormatted,
  getBlockNumber,
  isValidAddress,
  getChainId,
} from '../lib/ethereum';
import { CRYOPAY_CONTRACT_ABI, CONTRACT_ADDRESSES } from '../lib/smartContract';

const ethereum = new Hono<{ Bindings: Env }>();

// ============ Gas Price ============

/**
 * GET /api/ethereum/gas-price
 * Returns current gas prices (legacy and EIP-1559)
 */
ethereum.get('/gas-price', async (c) => {
  try {
    const client = createClientFromEnv({
      ETHEREUM_RPC_URL: c.env.ETHEREUM_RPC_URL,
      ETHEREUM_CHAIN_ID: c.env.ETHEREUM_CHAIN_ID,
      ETHEREUM_NETWORK: c.env.ETHEREUM_NETWORK,
    });

    const gasPrice = await getGasPrice(client);

    return c.json({
      success: true,
      data: gasPrice,
    });
  } catch (error) {
    console.error('Gas price error:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch gas price',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

// ============ Balance ============

/**
 * GET /api/ethereum/balance/:address
 * Returns the ETH balance for an address
 */
ethereum.get('/balance/:address', async (c) => {
  try {
    const address = c.req.param('address');

    // Validate address
    if (!isValidAddress(address)) {
      return c.json(
        {
          success: false,
          error: 'Invalid Ethereum address format',
        },
        400
      );
    }

    const client = createClientFromEnv({
      ETHEREUM_RPC_URL: c.env.ETHEREUM_RPC_URL,
      ETHEREUM_CHAIN_ID: c.env.ETHEREUM_CHAIN_ID,
      ETHEREUM_NETWORK: c.env.ETHEREUM_NETWORK,
    });

    const balance = await getBalanceFormatted(client, address as `0x${string}`);

    return c.json({
      success: true,
      data: {
        address,
        balanceWei: balance.wei,
        balanceEth: balance.eth,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Balance error:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch balance',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

// ============ Contract ABI ============

/**
 * GET /api/ethereum/contract-abi
 * Returns the CryoPayTransactionRecorder contract ABI
 */
ethereum.get('/contract-abi', (c) => {
  return c.json({
    success: true,
    data: {
      contractName: 'CryoPayTransactionRecorder',
      abi: CRYOPAY_CONTRACT_ABI,
      addresses: CONTRACT_ADDRESSES,
    },
  });
});

/**
 * GET /api/ethereum/contract-address
 * Returns the contract address for the current network
 */
ethereum.get('/contract-address', (c) => {
  const network = c.env.ETHEREUM_NETWORK || 'localhost';
  const address = CONTRACT_ADDRESSES[network as keyof typeof CONTRACT_ADDRESSES];

  return c.json({
    success: true,
    data: {
      network,
      chainId: parseInt(c.env.ETHEREUM_CHAIN_ID || '31337', 10),
      address: address || c.env.CRYOPAY_CONTRACT_ADDRESS || null,
    },
  });
});

// ============ Network Info ============

/**
 * GET /api/ethereum/network
 * Returns current network information
 */
ethereum.get('/network', async (c) => {
  try {
    const client = createClientFromEnv({
      ETHEREUM_RPC_URL: c.env.ETHEREUM_RPC_URL,
      ETHEREUM_CHAIN_ID: c.env.ETHEREUM_CHAIN_ID,
      ETHEREUM_NETWORK: c.env.ETHEREUM_NETWORK,
    });

    const [blockNumber, chainId] = await Promise.all([
      getBlockNumber(client),
      getChainId(client),
    ]);

    return c.json({
      success: true,
      data: {
        network: c.env.ETHEREUM_NETWORK,
        chainId,
        configuredChainId: parseInt(c.env.ETHEREUM_CHAIN_ID || '31337', 10),
        rpcUrl: c.env.ETHEREUM_RPC_URL ? '[configured]' : '[not configured]',
        blockNumber: blockNumber.toString(),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Network info error:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch network info',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

// ============ Health Check ============

/**
 * GET /api/ethereum/health
 * Health check for Ethereum connectivity
 */
ethereum.get('/health', async (c) => {
  try {
    const client = createClientFromEnv({
      ETHEREUM_RPC_URL: c.env.ETHEREUM_RPC_URL,
      ETHEREUM_CHAIN_ID: c.env.ETHEREUM_CHAIN_ID,
      ETHEREUM_NETWORK: c.env.ETHEREUM_NETWORK,
    });

    const blockNumber = await getBlockNumber(client);

    return c.json({
      success: true,
      status: 'connected',
      network: c.env.ETHEREUM_NETWORK,
      blockNumber: blockNumber.toString(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        status: 'disconnected',
        error: error instanceof Error ? error.message : 'Connection failed',
      },
      503
    );
  }
});

export default ethereum;
