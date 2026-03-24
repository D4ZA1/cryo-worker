import { Hono } from 'hono';
import type { Env } from '../db/schema';
import { authMiddleware, requireUser } from '../middleware/auth';

function b64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const len = bin.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
  return arr.buffer;
}

const app = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

app.post('/verify-wallet', authMiddleware, requireUser, async (c) => {
  const body = await c.req.json();
  const { public_key, challenge, signature } = body;
  const userId = c.get('userId');

  try {
    const jwk = public_key as JsonWebKey;
    const pubKey = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const sigBuf = b64ToBuf(signature as string);
    const data = new TextEncoder().encode(challenge as string);
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
