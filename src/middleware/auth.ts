import { Context } from 'hono';
import { jwt } from 'hono/jwt';
import type { Env } from '../db/schema';
import { ErrorCode, HTTP_STATUS } from '../constants';

/**
 * Decode URL-safe base64 string (used by JWTs)
 * JWT uses base64url encoding which replaces +/= with -/_
 */
function base64UrlDecode(str: string): string {
  // Replace URL-safe characters with standard base64 characters
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  return atob(padded);
}

/**
 * Basic auth middleware placeholder - JWT validation
 * Later: verify token, fetch user_id from D1 profiles
 */
export const authMiddleware = async (c: Context, next: () => Promise<void>) => {
  // Custom JWT validation using c.env.JWT_SECRET
  const authHeader = c.req.header('Authorization');
  const cookie = c.req.header('Cookie')?.match(/auth_token=([^;]+)/)?.[1];
  
  const token = authHeader?.replace('Bearer ', '') || cookie;
  if (!token) {
    return c.json({ ok: false, error: 'No token provided', code: ErrorCode.UNAUTHORIZED }, HTTP_STATUS.UNAUTHORIZED);
  }
  
  try {
    const payload = await verifyJwt(token, c.env.JWT_SECRET);
    c.set('userId', payload.sub as string);
    await next();
  } catch (error) {
    return c.json({ ok: false, error: 'Invalid token', code: ErrorCode.INVALID_TOKEN }, HTTP_STATUS.UNAUTHORIZED);
  }
};

async function verifyJwt(token: string, secret: string) {
  try {
    const [headerB64, payloadB64, sigB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !sigB64) throw new Error('Invalid token');
    const headerClaim = headerB64 + '.' + payloadB64;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sig = b64ToBuf(sigB64);
    const isValid = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(headerClaim));
    if (!isValid) throw new Error('Invalid signature');
    const payloadStr = base64UrlDecode(payloadB64);
    const payload = JSON.parse(payloadStr);
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) throw new Error('Token expired');
    return payload;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

function b64ToBuf(b64: string): ArrayBuffer {
  // Handle URL-safe base64
  const base64 = b64.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  const bin = atob(padded);
  const len = bin.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
  return arr.buffer;
}

export const requireUser = async (c: Context, next: () => Promise<void>) => {
  const userId = c.get('userId') as string;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  // App-level RLS validation: check user exists in D1 profiles
  const { results } = await c.env.DATABASE.prepare('SELECT id FROM profiles WHERE id = ? LIMIT 1')
    .bind(userId).all();
  
  if (results.length === 0) {
    return c.json({ error: 'User not found' }, 404);
  }
  
  c.set('userId', userId);
  await next();
};
