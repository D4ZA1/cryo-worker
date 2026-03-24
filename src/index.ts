import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import type { Env } from './db/schema';

import authRoutes from './routes/profile';
import walletRoutes from './routes/wallet';
import { authMiddleware } from './middleware/auth';

const app = new Hono<{ Bindings: Env }>();

app.use('*', logger());
app.use('*', cors());

app.get('/', async (c) => {
  const { results } = await c.env.DATABASE.prepare('SELECT name FROM sqlite_master WHERE type=\'table\';').all();
  const tables = results.map((r: any) => r.name);
  return c.json({ status: 'Worker ready', tables });
});

// API routes
app.route('/api/profile', authRoutes);
app.route('/api/wallet', walletRoutes);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message }, 500);
});

export default app;
