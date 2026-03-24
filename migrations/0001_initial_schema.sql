-- D1 Schema Migration 0001: Initial tables matching Supabase
-- profiles, wallets, blocks, contacts
-- Converted: jsonb->TEXT (JSON), timestamptz->TEXT (ISO), uuid->TEXT, no FK/triggers (app-level)

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  public_key TEXT,  -- JSON string
  encrypted_private_key TEXT,  -- JSON string
  email TEXT,
  phone TEXT,
  notifications TEXT DEFAULT '{}',  -- JSON string
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Wallets table
CREATE TABLE IF NOT EXISTS wallets (
  user_id TEXT PRIMARY KEY,
  public_key TEXT,
  encrypted_private_key TEXT,
  verified INTEGER DEFAULT 0,  -- bool as 0/1
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Blocks table
CREATE TABLE IF NOT EXISTS blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT,  -- JSON
  previous_hash TEXT,
  hash TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  user_id TEXT
);

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  contact_user_id TEXT,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  email TEXT,
  label TEXT,
  public_key TEXT,  -- JSON
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);

-- View all tables
-- SELECT name FROM sqlite_master WHERE type='table';
