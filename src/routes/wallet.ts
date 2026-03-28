import { Hono } from 'hono';
import type { Env } from '../db/schema';
import { authMiddleware, requireUser } from '../middleware/auth';
import { WalletSaveInputSchema, WalletVerifyInputSchema } from '../schemas';
import { ErrorCode, HTTP_STATUS } from '../constants';

function b64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const len = bin.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
  return arr.buffer;
}

const app = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

// GET /wallet - Get current user's wallet
app.get('/', authMiddleware, requireUser, async (c) => {
  const userId = c.get('userId');
  
  try {
    const { results } = await c.env.DATABASE.prepare(`
      SELECT user_id, public_key, encrypted_private_key, verified, created_at, updated_at
      FROM wallets WHERE user_id = ?
    `).bind(userId).all();
    
    if (results.length === 0) {
      return c.json({ error: 'Wallet not found' }, 404);
    }
    
    return c.json({ ok: true, wallet: results[0] });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

// POST /wallet - Save or update wallet
app.post('/', authMiddleware, requireUser, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  
  const parseResult = WalletSaveInputSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ ok: false, error: parseResult.error.message, code: ErrorCode.VALIDATION_ERROR }, HTTP_STATUS.BAD_REQUEST);
  }
  
  const { public_key, encrypted_private_key, verified } = parseResult.data;

  try {
    // Upsert wallet
    await c.env.DATABASE.prepare(`
      INSERT INTO wallets (user_id, public_key, encrypted_private_key, verified)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET 
        public_key = excluded.public_key,
        encrypted_private_key = excluded.encrypted_private_key,
        verified = excluded.verified,
        updated_at = datetime('now')
    `).bind(userId, public_key, encrypted_private_key, verified ? 1 : 0).run();
    
    return c.json({ ok: true, message: 'Wallet saved' });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

app.post('/verify-wallet', authMiddleware, requireUser, async (c) => {
  const body = await c.req.json();
  const userId = c.get('userId');
  
  const parseResult = WalletVerifyInputSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ ok: false, error: parseResult.error.message, code: ErrorCode.VALIDATION_ERROR }, HTTP_STATUS.BAD_REQUEST);
  }
  
  const { public_key, challenge, signature } = parseResult.data;

  try {
    const jwk = public_key as JsonWebKey;
    const pubKey = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const sigBuf = b64ToBuf(signature);
    const data = new TextEncoder().encode(challenge);
    const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pubKey, sigBuf, data);

    if (!valid) {
      return c.json({ ok: false, error: 'Invalid signature' }, 401);
    }

    // Update verified
    await c.env.DATABASE.prepare(`UPDATE wallets SET verified = 1, updated_at = datetime('now') WHERE user_id = ?`)
      .bind(userId).run();

    return c.json({ ok: true, message: 'Wallet verified' });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

export default app;


