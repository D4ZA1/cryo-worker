import { Hono } from 'hono';
import type { Env } from '../db/schema';
import { authMiddleware, requireUser } from '../middleware/auth';

const app = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

app.post('/create-profile-wallet', authMiddleware, requireUser, async (c) => {
  const body = await c.req.json();
  const userId = c.get('userId');
  const { first_name, last_name, public_key, encrypted_private_key, email, phone } = body;

  try {
    // Upsert profile
    await c.env.DATABASE.prepare(`
      INSERT INTO profiles (id, first_name, last_name, public_key, encrypted_private_key, email, phone)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET 
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        public_key = excluded.public_key,
        encrypted_private_key = excluded.encrypted_private_key,
        email = excluded.email,
        phone = excluded.phone,
        updated_at = datetime('now')
    `).bind(userId, first_name, last_name, public_key, encrypted_private_key, email, phone).run();

    // Upsert wallet
    await c.env.DATABASE.prepare(`
      INSERT INTO wallets (user_id, public_key, encrypted_private_key, verified)
      VALUES (?, ?, ?, 0)
      ON CONFLICT(user_id) DO UPDATE SET 
        public_key = excluded.public_key,
        encrypted_private_key = excluded.encrypted_private_key,
        updated_at = datetime('now')
    `).bind(userId, public_key, encrypted_private_key).run();

    return c.json({ ok: true, message: 'Profile and wallet created/updated' });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

export default app;
