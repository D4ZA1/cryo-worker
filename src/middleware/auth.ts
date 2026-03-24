import { Context } from 'hono';
import { jwt } from 'hono/jwt';
import type { Env } from '../db/schema';

/**
 * Basic auth middleware placeholder - JWT validation
 * Later: verify token, fetch user_id from D1 profiles
 */
export const authMiddleware = jwt({
  alg: 'HS256',
  secret: 'your-jwt-secret', // TODO: wrangler secret JWT_SECRET
  cookie: 'auth_token',
});

export const requireUser = async (c: Context, next: () => Promise<void>) => {
  const userId = c.get('userId');
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  // App-level RLS: WHERE user_id = ?
  c.set('userId', userId);
  await next();
};
