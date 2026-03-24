import { Context } from 'hono';
import { jwt } from 'hono/jwt';
import type { Env } from '../db/schema';

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
    return c.json({ error: 'No token provided' }, 401);
  }
  
  try {
    const payload = await verifyJwt(token, c.env.JWT_SECRET);
    c.set('userId', payload.sub as string);
    await next();
  } catch (error) {
    return c.json({ error: 'Invalid token' }, 401);
  }
};

async function verifyJwt(token: string, secret: string) {
  // Simple JWT verify - use google-auth-library or implement full in prod
  // For demo, placeholder - replace with proper jwt.verify
  const [headerB64, payloadB64] = token.split('.');
  const payload = JSON.parse(atob(payloadB64));
  // Add signature check
  return payload;
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
