import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import type { Env } from './db/schema';

import authRoutes from './routes/auth';
import profileRoutes from './routes/profile';
import walletRoutes from './routes/wallet';
import blocksRoutes from './routes/blocks';
import contactsRoutes from './routes/contacts';
import ethereumRoutes from './routes/ethereum';
import blockchainRoutes from './routes/blockchain';
import devRoutes from './routes/dev';
const app = new Hono<{ Bindings: Env }>();

app.use('*', logger());
app.use('*', cors());

app.get('/', (c) => {
  return c.json({ status: 'ok', message: 'CryoPay API is running' });
});

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// API routes
app.route('/api/auth', authRoutes);
app.route('/api/profile', profileRoutes);
app.route('/api/wallet', walletRoutes);
app.route('/api/blocks', blocksRoutes);
app.route('/api/contacts', contactsRoutes);
app.route('/api/ethereum', ethereumRoutes);
app.route('/api/blockchain', blockchainRoutes);
app.route('/api/dev', devRoutes);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message }, 500);
});

export default app;
