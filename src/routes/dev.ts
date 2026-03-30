/**
 * Development Routes
 * ONLY for local development - clears blockchain data on Hardhat restart
 */

import { Hono } from 'hono';
import type { Env } from '../db/schema';

const dev = new Hono<{ Bindings: Env }>();

/**
 * POST /api/dev/reset-blockchain
 * Clears all blockchain-related data from the database
 * Use this when you restart Hardhat node
 *
 * WARNING: This is for development only!
 */
dev.post('/reset-blockchain', async (c) => {
  // Only allow in development (check for localhost RPC URL)
  const rpcUrl = c.env.ETHEREUM_RPC_URL || '';
  if (!rpcUrl.includes('127.0.0.1') && !rpcUrl.includes('localhost')) {
    return c.json(
      {
        success: false,
        error: 'Reset endpoint only available in development mode',
      },
      403
    );
  }

  try {
    // Clear blockchain_transactions table
    await c.env.DATABASE.prepare('DELETE FROM blockchain_transactions').run();

    // Clear contract_events table
    await c.env.DATABASE.prepare('DELETE FROM contract_events').run();

    // Reset ethereum_users nonces and balances (but keep the records)
    await c.env.DATABASE.prepare(
      'UPDATE ethereum_users SET nonce = 0, balance_wei = NULL'
    ).run();

    // Optionally clear blocks table (transaction history)
    // Uncomment if you want to clear off-chain transaction history too
    // await c.env.DATABASE.prepare('DELETE FROM blocks').run();

    return c.json({
      success: true,
      message: 'Blockchain data reset successfully',
      cleared: [
        'blockchain_transactions',
        'contract_events',
        'ethereum_users (nonces/balances reset)',
      ],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Reset error:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to reset blockchain data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/dev/status
 * Check development environment status
 */
dev.get('/status', async (c) => {
  try {
    // Count records in blockchain tables
    const [txCount, eventCount, userCount] = await Promise.all([
      c.env.DATABASE.prepare(
        'SELECT COUNT(*) as count FROM blockchain_transactions'
      ).first(),
      c.env.DATABASE.prepare(
        'SELECT COUNT(*) as count FROM contract_events'
      ).first(),
      c.env.DATABASE.prepare(
        'SELECT COUNT(*) as count FROM ethereum_users'
      ).first(),
    ]);

    return c.json({
      success: true,
      environment: 'development',
      rpcUrl: c.env.ETHEREUM_RPC_URL,
      chainId: c.env.ETHEREUM_CHAIN_ID,
      contractAddress: c.env.CRYOPAY_CONTRACT_ADDRESS,
      database: {
        blockchain_transactions: (txCount as any)?.count || 0,
        contract_events: (eventCount as any)?.count || 0,
        ethereum_users: (userCount as any)?.count || 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

export default dev;
