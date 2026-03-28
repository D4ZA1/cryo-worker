import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import type { Env } from './db/schema';

import authRoutes from './routes/auth';
import profileRoutes from './routes/profile';
import walletRoutes from './routes/wallet';
import blocksRoutes from './routes/blocks';
import contactsRoutes from './routes/contacts';
import { authMiddleware } from './middleware/auth';

const app = new Hono<{ Bindings: Env }>();

app.use('*', logger());
app.use('*', cors());

app.get('/', async (c) => {
  const { results } = await c.env.DATABASE.prepare('SELECT name FROM sqlite_master WHERE type=\'table\';').all();
  const tables = results.map((r: any) => r.name);
  return c.json({ status: 'Worker ready', tables });
});

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// List tables
app.get('/tables', async (c) => {
  const { results } = await c.env.DATABASE.prepare("SELECT name FROM sqlite_master WHERE type='table';").all();
  return c.json({ tables: results.map((r: any) => r.name) });
});

// API routes
app.route('/api/auth', authRoutes);
app.route('/api/profile', profileRoutes);
app.route('/api/wallet', walletRoutes);
app.route('/api/blocks', blocksRoutes);
app.route('/api/contacts', contactsRoutes);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message }, 500);
});

export default app;
