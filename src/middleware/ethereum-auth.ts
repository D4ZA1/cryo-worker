/**
 * Ethereum Authentication Middleware
 * Verifies Ethereum signatures for MetaMask login/registration
 */

import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { verifyMessage, recoverMessageAddress, type Address } from 'viem';
import type { Env } from '../db/schema';

// ============ Types ============

export interface EthereumAuthContext {
  ethereumAddress: Address;
  verified: boolean;
}

declare module 'hono' {
  interface ContextVariableMap {
    ethereumAuth: EthereumAuthContext;
  }
}

// ============ Message Templates ============

/**
 * Generate a sign-in message for MetaMask
 * This message is displayed to the user in MetaMask
 */
export function generateSignInMessage(
  address: string,
  nonce: string,
  domain: string = 'CryoPay'
): string {
  const timestamp = new Date().toISOString();
  return `Welcome to ${domain}!

Sign this message to verify your wallet ownership.

Wallet: ${address}
Nonce: ${nonce}
Timestamp: ${timestamp}

This request will not trigger a blockchain transaction or cost any gas fees.`;
}

/**
 * Generate a transaction signing message
 */
export function generateTransactionMessage(
  from: string,
  to: string,
  amount: string,
  currency: string,
  txId: string
): string {
  return `CryoPay Transaction Authorization

From: ${from}
To: ${to}
Amount: ${amount} ${currency}
Transaction ID: ${txId}

Sign this message to authorize the transaction.`;
}

// ============ Signature Verification ============

/**
 * Verify an Ethereum signature
 * Returns the recovered address if valid
 */
export async function verifyEthereumSignature(
  message: string,
  signature: `0x${string}`,
  expectedAddress: Address
): Promise<boolean> {
  try {
    const isValid = await verifyMessage({
      address: expectedAddress,
      message,
      signature,
    });
    return isValid;
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

/**
 * Recover the address from a signed message
 */
export async function recoverSignerAddress(
  message: string,
  signature: `0x${string}`
): Promise<Address> {
  return recoverMessageAddress({
    message,
    signature,
  });
}

// ============ Nonce Management ============

/**
 * Generate a random nonce for signature requests
 */
export function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate nonce format
 */
export function isValidNonce(nonce: string): boolean {
  return /^[a-f0-9]{32}$/.test(nonce);
}

// ============ Middleware ============

/**
 * Middleware to verify Ethereum signature from request headers
 * 
 * Expected headers:
 * - X-Ethereum-Address: The user's Ethereum address
 * - X-Ethereum-Signature: The signature
 * - X-Ethereum-Message: The signed message
 */
export const ethereumAuthMiddleware = createMiddleware<{ Bindings: Env }>(
  async (c, next) => {
    const address = c.req.header('X-Ethereum-Address');
    const signature = c.req.header('X-Ethereum-Signature');
    const message = c.req.header('X-Ethereum-Message');

    // If no Ethereum headers, continue without setting context
    if (!address || !signature || !message) {
      await next();
      return;
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return c.json({ error: 'Invalid Ethereum address format' }, 400);
    }

    // Validate signature format
    if (!/^0x[a-fA-F0-9]+$/.test(signature)) {
      return c.json({ error: 'Invalid signature format' }, 400);
    }

    try {
      // Verify the signature
      const isValid = await verifyEthereumSignature(
        message,
        signature as `0x${string}`,
        address as Address
      );

      if (!isValid) {
        return c.json({ error: 'Invalid signature' }, 401);
      }

      // Set the context
      c.set('ethereumAuth', {
        ethereumAddress: address as Address,
        verified: true,
      });

      await next();
    } catch (error) {
      console.error('Ethereum auth error:', error);
      return c.json({ error: 'Signature verification failed' }, 401);
    }
  }
);

/**
 * Require Ethereum authentication
 * Use after ethereumAuthMiddleware to enforce authentication
 */
export const requireEthereumAuth = createMiddleware<{ Bindings: Env }>(
  async (c, next) => {
    const auth = c.get('ethereumAuth');

    if (!auth || !auth.verified) {
      return c.json(
        {
          error: 'Ethereum authentication required',
          message: 'Please sign a message with your wallet to authenticate',
        },
        401
      );
    }

    await next();
  }
);

// ============ Request Body Verification ============

/**
 * Verify signature from request body
 * Used for endpoints that receive signature in body instead of headers
 */
export async function verifyRequestSignature(body: {
  address: string;
  signature: string;
  message: string;
}): Promise<{ valid: boolean; recoveredAddress?: Address; error?: string }> {
  const { address, signature, message } = body;

  // Validate address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return { valid: false, error: 'Invalid Ethereum address format' };
  }

  // Validate signature format
  if (!/^0x[a-fA-F0-9]+$/.test(signature)) {
    return { valid: false, error: 'Invalid signature format' };
  }

  try {
    // Recover the signer address
    const recoveredAddress = await recoverSignerAddress(
      message,
      signature as `0x${string}`
    );

    // Check if recovered address matches expected address
    const isValid = recoveredAddress.toLowerCase() === address.toLowerCase();

    if (!isValid) {
      return {
        valid: false,
        recoveredAddress,
        error: 'Signature does not match the provided address',
      };
    }

    return { valid: true, recoveredAddress };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Signature verification failed',
    };
  }
}

// ============ Helper Functions ============

/**
 * Extract Ethereum address from various formats
 */
export function normalizeAddress(address: string): Address {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error('Invalid Ethereum address');
  }
  return address.toLowerCase() as Address;
}

/**
 * Check if two addresses are the same (case-insensitive)
 */
export function addressesMatch(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Validate and format a signature
 */
export function normalizeSignature(signature: string): `0x${string}` {
  if (!signature.startsWith('0x')) {
    signature = '0x' + signature;
  }
  return signature as `0x${string}`;
}
