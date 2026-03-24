import { Hono } from 'hono';
import type { Env } from '../db/schema';
import { authMiddleware, requireUser } from '../middleware/auth';
// Use WebCrypto PBKDF2 instead of node crypto for pure Workers compat
// PBKDF2 slow but secure

const app = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

// Helper: PBKDF2 hash (salt stored in hash)
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

// Helper: Verify password against hash
function verifyPassword(password: string, hash: string): boolean {
  const [salt, expectedHash] = hash.split(':');
  const hashBuffer = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex');
  return hashBuffer === expectedHash;
}

// POST /register - email/password → profile + hash + temp JWT
app.post('/register', async (c) => {
  const body = await c.req.json();
  const { email, password, first_name, last_name } = body;
  if (!email || !password || !first_name) {
    return c.json({ error: 'Missing fields' }, 400);
  }

  try {
    const passwordHash = hashPassword(password);
    const userId = crypto.randomUUID();
    await c.env.DATABASE.prepare(`
      INSERT INTO profiles (id, email, first_name, last_name, password_hash)
      VALUES (?, ?, ?, ?, ?)
    `).bind(userId, email, first_name, last_name || null, passwordHash).run();

    // Generate JWT (simple, exp 7d)
    const token = await jwtSign({ sub: userId, email }, c.env.JWT_SECRET!, { exp: Math.floor(Date.now() / 1000) + 60*60*24*7 });

    return c.json({ ok: true, token, userId });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

// POST /login - email/password → JWT if match
app.post('/login', async (c) => {
  const body = await c.req.json();
  const { email, password } = body;

  try {
    const { results } = await c.env.DATABASE.prepare('SELECT id, password_hash FROM profiles WHERE email = ?').bind(email).all();
    if (results.length === 0) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const user = results[0] as any;
    if (!verifyPassword(password, user.password_hash)) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Generate JWT
    const token = await jwtSign({ sub: user.id, email }, c.env.JWT_SECRET!, { exp: Math.floor(Date.now() / 1000) + 60*60*24*7 });

    return c.json({ ok: true, token });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

// POST /refresh - extend JWT
app.post('/refresh', authMiddleware, requireUser, async (c) => {
  const userId = c.get('userId');
  const newToken = await jwtSign({ sub: userId }, c.env.JWT_SECRET!, { exp: Math.floor(Date.now() / 1000) + 60*60*24*7 });
  return c.json({ ok: true, token: newToken });
});

// POST /logout - stateless, client clear token

export default app;

const b64 = (str: string) => btoa(str);
const bufToB64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));

// Simple HS256 JWT sign (WebCrypto HMAC)
async function jwtSign(payload: any, secret: string, options: any) {
  const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const iat = Math.floor(Date.now() / 1000);
  const claimStr = JSON.stringify({ ...payload, iat, ...options });
  const claim = b64(claimStr);
  const headerClaim = header + '.' + claim;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(headerClaim));
  const signature = bufToB64(sig);
  return headerClaim + '.' + signature;
}
