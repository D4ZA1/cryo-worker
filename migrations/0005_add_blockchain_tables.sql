-- Migration: 0005_add_blockchain_tables.sql
-- Purpose: Add tables for Ethereum/blockchain integration
-- Date: 2026-03-30

-- Table: ethereum_users
-- Links CryoPay users to Ethereum wallet addresses
CREATE TABLE IF NOT EXISTS ethereum_users (
  id TEXT PRIMARY KEY,                    -- UUID (same as profiles.id)
  ethereum_address TEXT NOT NULL UNIQUE,  -- 0x... wallet address
  verified INTEGER DEFAULT 0,             -- Signature verification (0=false, 1=true)
  balance_wei TEXT,                       -- Last known balance (stored as string for big numbers)
  nonce INTEGER DEFAULT 0,                -- Transaction nonce tracker
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- Index for fast lookup by Ethereum address
CREATE INDEX IF NOT EXISTS idx_ethereum_users_address ON ethereum_users(ethereum_address);

-- Table: blockchain_transactions
-- Records all on-chain transactions
CREATE TABLE IF NOT EXISTS blockchain_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,                  -- User who initiated the transaction
  tx_hash TEXT NOT NULL UNIQUE,           -- On-chain transaction hash
  from_address TEXT NOT NULL,             -- Sender address
  to_address TEXT NOT NULL,               -- Recipient address
  amount_wei TEXT NOT NULL,               -- Amount in wei (string for big numbers)
  currency TEXT DEFAULT 'ETH',            -- Currency type
  status TEXT DEFAULT 'pending',          -- pending, confirmed, failed
  block_number INTEGER,                   -- Block where tx was included
  confirmations INTEGER DEFAULT 0,        -- Number of confirmations
  gas_used TEXT,                          -- Gas used (string for big numbers)
  transaction_fee TEXT,                   -- Fee in wei (string for big numbers)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  confirmed_at TEXT,                      -- Timestamp when confirmed
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- Indexes for blockchain_transactions
CREATE INDEX IF NOT EXISTS idx_blockchain_tx_user ON blockchain_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_blockchain_tx_hash ON blockchain_transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_blockchain_tx_status ON blockchain_transactions(status);

-- Table: contract_events
-- Index smart contract events for querying
CREATE TABLE IF NOT EXISTS contract_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_name TEXT NOT NULL,               -- TransactionRecorded, UserRegistered
  block_number INTEGER NOT NULL,          -- Block where event was emitted
  transaction_hash TEXT NOT NULL,         -- Transaction that emitted the event
  from_address TEXT,                      -- Event parameter: from
  to_address TEXT,                        -- Event parameter: to
  amount TEXT,                            -- Event parameter: amount
  currency TEXT,                          -- Event parameter: currency
  log_index INTEGER,                      -- Position in block logs
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(transaction_hash, log_index)
);

-- Indexes for contract_events
CREATE INDEX IF NOT EXISTS idx_contract_events_name ON contract_events(event_name);
CREATE INDEX IF NOT EXISTS idx_contract_events_block ON contract_events(block_number);
CREATE INDEX IF NOT EXISTS idx_contract_events_from ON contract_events(from_address);
