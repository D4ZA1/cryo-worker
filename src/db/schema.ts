/// <reference types="@cloudflare/workers-types" />

/**
 * D1 Schema Types for cryo-db
 * Generated from migrations/0001_initial_schema.sql
 * Run `wrangler types` after binding changes.
 */

export interface Wallet {
  user_id: string;
  public_key?: string | null;
  encrypted_private_key?: string | null;
  verified: number;  // 0/1
  created_at: string;
  updated_at: string;
}

export interface Block {
  id: number;
  data?: string | null;
  previous_hash?: string | null;
  hash?: string | null;
  created_at: string;
  user_id?: string | null;
}

export interface Contact {
  id: number;
  user_id: string;
  contact_user_id?: string | null;
  name: string;
  address: string;
  email?: string | null;
  label?: string | null;
  public_key?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OtpToken {
  id: number;
  email: string;
  token: string;
  expires_at: string;
  used: number; // 0/1
  created_at: string;
}

export interface Profile {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  public_key?: string | null;
  encrypted_private_key?: string | null;
  email?: string | null;
  phone?: string | null;
  password_hash?: string | null;
  notifications: string;  // JSON
  mfa_enabled?: number; // 0/1
  mfa_secret?: string | null;
  mfa_backup_codes?: string | null; // JSON array
  created_at: string;
  updated_at: string;
}

// Env binding
export interface Env {
  DATABASE: D1Database;
  JWT_SECRET: string;
  // Ethereum configuration
  ETHEREUM_RPC_URL: string;
  ETHEREUM_CHAIN_ID: string;
  ETHEREUM_NETWORK: string;
  CRYOPAY_CONTRACT_ADDRESS?: string;
  ETHERSCAN_API_KEY: string;
}
