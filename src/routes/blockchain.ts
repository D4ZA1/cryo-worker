/**
 * Blockchain Transaction Routes
 * Handles transaction recording, status, and synchronization
 */

import { Hono } from 'hono';
import type { Env } from '../db/schema';
import { authMiddleware, requireUser } from '../middleware/auth';
import {
  ethereumAuthMiddleware,
  requireEthereumAuth,
  verifyRequestSignature,
} from '../middleware/ethereum-auth';
import { createContractFromEnv, CryoPayContract } from '../lib/smartContract';
import { createClientFromEnv, getTransactionReceipt, isValidTxHash } from '../lib/ethereum';
import {
  recordTransactionSchema,
  getTransactionStatusSchema,
  type RecordTransaction,
} from '../schemas/blockchain';

const blockchain = new Hono<{ Bindings: Env; Variables: { userId: string; ethereumAuth?: { ethereumAddress: string } } }>();

// Apply auth middleware to all routes
blockchain.use('*', authMiddleware);

// ============ Record Transaction ============

/**
 * POST /api/blockchain/record
 * Record a transaction on-chain (requires both JWT and Ethereum signature)
 */
blockchain.post('/record', ethereumAuthMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    
    // Validate request body
    const parseResult = recordTransactionSchema.safeParse(body);
    if (!parseResult.success) {
      return c.json(
        {
          success: false,
          error: 'Validation failed',
          details: parseResult.error.issues,
        },
        400
      );
    }

    const { to, amount, currency, offChainTxHash, signature } = parseResult.data;
    const userId = c.get('userId');
    const ethereumAuth = c.get('ethereumAuth');

    // Get user's Ethereum address from the database
    const { results: userResults } = await c.env.DATABASE.prepare(
      'SELECT ethereum_address FROM ethereum_users WHERE id = ?'
    ).bind(userId).all();

    if (!userResults || userResults.length === 0) {
      return c.json(
        {
          success: false,
          error: 'Ethereum wallet not linked',
          message: 'Please connect your MetaMask wallet first',
        },
        400
      );
    }

    const userEthAddress = (userResults[0] as any).ethereum_address;

    // Verify the signature if provided (optional additional verification)
    if (signature && ethereumAuth) {
      if (ethereumAuth.ethereumAddress.toLowerCase() !== userEthAddress.toLowerCase()) {
        return c.json(
          {
            success: false,
            error: 'Address mismatch',
            message: 'Signed address does not match your registered wallet',
          },
          403
        );
      }
    }

    // Check if transaction hash is already recorded in our database
    const { results: existingTx } = await c.env.DATABASE.prepare(
      'SELECT id FROM blockchain_transactions WHERE tx_hash = ?'
    ).bind(offChainTxHash).all();

    if (existingTx && existingTx.length > 0) {
      return c.json(
        {
          success: false,
          error: 'Transaction already recorded',
          txHash: offChainTxHash,
        },
        409
      );
    }

    // Check with smart contract if already recorded
    try {
      if (!c.env.CRYOPAY_CONTRACT_ADDRESS) {
        throw new Error('Contract address not configured');
      }
      const contract = createContractFromEnv({
        CRYOPAY_CONTRACT_ADDRESS: c.env.CRYOPAY_CONTRACT_ADDRESS,
        ETHEREUM_RPC_URL: c.env.ETHEREUM_RPC_URL,
        ETHEREUM_CHAIN_ID: c.env.ETHEREUM_CHAIN_ID,
      });

      const isRecorded = await contract.isTransactionRecorded(offChainTxHash as `0x${string}`);
      if (isRecorded) {
        return c.json(
          {
            success: false,
            error: 'Transaction already recorded on-chain',
            txHash: offChainTxHash,
          },
          409
        );
      }
    } catch (contractError) {
      console.error('Contract check error:', contractError);
      // Continue - we'll still record in DB
    }

    // Insert the transaction record (pending status)
    const now = new Date().toISOString();
    await c.env.DATABASE.prepare(
      `INSERT INTO blockchain_transactions 
       (user_id, tx_hash, from_address, to_address, amount_wei, currency, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
    ).bind(userId, offChainTxHash, userEthAddress, to, amount, currency, now).run();

    return c.json({
      success: true,
      message: 'Transaction recorded',
      data: {
        txHash: offChainTxHash,
        from: userEthAddress,
        to,
        amount,
        currency,
        status: 'pending',
        createdAt: now,
      },
    });
  } catch (error) {
    console.error('Record transaction error:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to record transaction',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

// ============ Get Transaction Status ============

/**
 * GET /api/blockchain/status/:txHash
 * Get the status of a transaction
 */
blockchain.get('/status/:txHash', async (c) => {
  try {
    const txHash = c.req.param('txHash');

    // Validate transaction hash
    if (!isValidTxHash(txHash)) {
      return c.json(
        {
          success: false,
          error: 'Invalid transaction hash format',
        },
        400
      );
    }

    // Check our database first
    const { results } = await c.env.DATABASE.prepare(
      `SELECT * FROM blockchain_transactions WHERE tx_hash = ?`
    ).bind(txHash).all();

    if (!results || results.length === 0) {
      return c.json(
        {
          success: false,
          error: 'Transaction not found',
        },
        404
      );
    }

    const dbTx = results[0] as any;

    // If status is pending, check the blockchain
    if (dbTx.status === 'pending') {
      try {
        const client = createClientFromEnv({
          ETHEREUM_RPC_URL: c.env.ETHEREUM_RPC_URL,
          ETHEREUM_CHAIN_ID: c.env.ETHEREUM_CHAIN_ID,
          ETHEREUM_NETWORK: c.env.ETHEREUM_NETWORK,
        });

        const receipt = await getTransactionReceipt(client, txHash as `0x${string}`);

        if (receipt) {
          // Update the database with confirmation
          const status = receipt.status === 'success' ? 'confirmed' : 'failed';
          const now = new Date().toISOString();

          await c.env.DATABASE.prepare(
            `UPDATE blockchain_transactions 
             SET status = ?, block_number = ?, gas_used = ?, confirmed_at = ?
             WHERE tx_hash = ?`
          ).bind(
            status,
            Number(receipt.blockNumber),
            receipt.gasUsed.toString(),
            now,
            txHash
          ).run();

          return c.json({
            success: true,
            data: {
              ...dbTx,
              status,
              blockNumber: Number(receipt.blockNumber),
              gasUsed: receipt.gasUsed.toString(),
              confirmedAt: now,
            },
          });
        }
      } catch (rpcError) {
        console.error('RPC error checking status:', rpcError);
        // Return DB status if RPC fails
      }
    }

    return c.json({
      success: true,
      data: dbTx,
    });
  } catch (error) {
    console.error('Get status error:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to get transaction status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

// ============ Get User Transactions ============

/**
 * GET /api/blockchain/transactions
 * Get all transactions for the authenticated user
 */
blockchain.get('/transactions', async (c) => {
  try {
    const userId = c.get('userId');
    const limit = parseInt(c.req.query('limit') || '20', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    const { results } = await c.env.DATABASE.prepare(
      `SELECT * FROM blockchain_transactions 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`
    ).bind(userId, limit, offset).all();

    // Get total count
    const { results: countResults } = await c.env.DATABASE.prepare(
      'SELECT COUNT(*) as total FROM blockchain_transactions WHERE user_id = ?'
    ).bind(userId).all();

    const total = (countResults?.[0] as any)?.total || 0;

    return c.json({
      success: true,
      data: {
        transactions: results || [],
        pagination: {
          limit,
          offset,
          total,
          hasMore: offset + limit < total,
        },
      },
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch transactions',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

// ============ Get Contract Transactions ============

/**
 * GET /api/blockchain/contract-transactions
 * Get transactions recorded on the smart contract for a user
 */
blockchain.get('/contract-transactions', async (c) => {
  try {
    const userId = c.get('userId');
    const offset = parseInt(c.req.query('offset') || '0', 10);
    const limit = parseInt(c.req.query('limit') || '10', 10);

    // Get user's Ethereum address
    const { results: userResults } = await c.env.DATABASE.prepare(
      'SELECT ethereum_address FROM ethereum_users WHERE id = ?'
    ).bind(userId).all();

    if (!userResults || userResults.length === 0) {
      return c.json(
        {
          success: false,
          error: 'Ethereum wallet not linked',
        },
        400
      );
    }

    const userEthAddress = (userResults[0] as any).ethereum_address;

    // Check if contract address is configured
    if (!c.env.CRYOPAY_CONTRACT_ADDRESS) {
      return c.json(
        {
          success: false,
          error: 'Smart contract not configured',
        },
        503
      );
    }

    // Query the smart contract
    const contract = createContractFromEnv({
      CRYOPAY_CONTRACT_ADDRESS: c.env.CRYOPAY_CONTRACT_ADDRESS,
      ETHEREUM_RPC_URL: c.env.ETHEREUM_RPC_URL,
      ETHEREUM_CHAIN_ID: c.env.ETHEREUM_CHAIN_ID,
    });

    const [transactions, totalCount] = await Promise.all([
      contract.getTransactions(userEthAddress as `0x${string}`, BigInt(offset), BigInt(limit)),
      contract.getTotalTransactions(userEthAddress as `0x${string}`),
    ]);

    return c.json({
      success: true,
      data: {
        transactions: transactions.map((tx) => ({
          from: tx.from,
          to: tx.to,
          amount: tx.amount.toString(),
          currency: tx.currency,
          timestamp: tx.timestamp.toString(),
          txHash: tx.txHash,
        })),
        pagination: {
          offset,
          limit,
          total: Number(totalCount),
          hasMore: offset + limit < Number(totalCount),
        },
      },
    });
  } catch (error) {
    console.error('Get contract transactions error:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch contract transactions',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

// ============ Sync from Blockchain ============

/**
 * POST /api/blockchain/sync
 * Sync transactions from the blockchain to our database
 */
blockchain.post('/sync', async (c) => {
  try {
    const userId = c.get('userId');

    // Get user's Ethereum address
    const { results: userResults } = await c.env.DATABASE.prepare(
      'SELECT ethereum_address FROM ethereum_users WHERE id = ?'
    ).bind(userId).all();

    if (!userResults || userResults.length === 0) {
      return c.json(
        {
          success: false,
          error: 'Ethereum wallet not linked',
        },
        400
      );
    }

    const userEthAddress = (userResults[0] as any).ethereum_address;

    // Get the latest synced block
    const { results: eventResults } = await c.env.DATABASE.prepare(
      `SELECT MAX(block_number) as last_block FROM contract_events 
       WHERE from_address = ? OR to_address = ?`
    ).bind(userEthAddress, userEthAddress).all();

    const lastBlock = BigInt((eventResults?.[0] as any)?.last_block || 0);
    const fromBlock = lastBlock > 0n ? lastBlock + 1n : 0n;

    // Check if contract address is configured
    if (!c.env.CRYOPAY_CONTRACT_ADDRESS) {
      return c.json(
        {
          success: false,
          error: 'Smart contract not configured',
        },
        503
      );
    }

    // Query contract events
    const contract = createContractFromEnv({
      CRYOPAY_CONTRACT_ADDRESS: c.env.CRYOPAY_CONTRACT_ADDRESS,
      ETHEREUM_RPC_URL: c.env.ETHEREUM_RPC_URL,
      ETHEREUM_CHAIN_ID: c.env.ETHEREUM_CHAIN_ID,
    });

    const events = await contract.getTransactionRecordedEvents(fromBlock, 'latest');

    // Filter events for this user
    const userEvents = events.filter(
      (e) =>
        e.from.toLowerCase() === userEthAddress.toLowerCase() ||
        e.to.toLowerCase() === userEthAddress.toLowerCase()
    );

    // Insert new events into database
    let insertedCount = 0;
    for (const event of userEvents) {
      try {
        await c.env.DATABASE.prepare(
          `INSERT OR IGNORE INTO contract_events 
           (event_name, block_number, transaction_hash, from_address, to_address, amount, currency, log_index, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          'TransactionRecorded',
          Number(event.blockNumber),
          event.transactionHash,
          event.from,
          event.to,
          event.amount.toString(),
          event.currency,
          event.logIndex,
          new Date().toISOString()
        ).run();
        insertedCount++;
      } catch (insertError) {
        // Ignore duplicate key errors
        console.error('Insert event error:', insertError);
      }
    }

    return c.json({
      success: true,
      data: {
        fromBlock: fromBlock.toString(),
        eventsFound: userEvents.length,
        eventsInserted: insertedCount,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Sync error:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to sync blockchain data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

export default blockchain;
