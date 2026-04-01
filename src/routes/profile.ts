import { Hono } from 'hono';
import type { Env } from '../db/schema';
import { authMiddleware, requireUser } from '../middleware/auth';
import { ProfileUpdateInputSchema, ProfileSearchInputSchema } from '../schemas';
import { ErrorCode, HTTP_STATUS } from '../constants';

// Helper function to validate JSON string
function isValidJsonString(value: any): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

const app = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

// GET /profile - Get current user's profile
app.get('/', authMiddleware, requireUser, async (c) => {
  const userId = c.get('userId');
  
  try {
    const { results } = await c.env.DATABASE.prepare(`
      SELECT id, first_name, last_name, email, phone, public_key, encrypted_private_key, notifications, created_at, updated_at
      FROM profiles WHERE id = ?
    `).bind(userId).all();
    
    if (results.length === 0) {
      return c.json({ error: 'Profile not found' }, 404);
    }
    
    return c.json({ ok: true, profile: results[0] });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

app.put('/', authMiddleware, requireUser, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  
  const parseResult = ProfileUpdateInputSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ ok: false, error: parseResult.error.message, code: ErrorCode.VALIDATION_ERROR }, HTTP_STATUS.BAD_REQUEST);
  }
  
  const { first_name, last_name, phone, notifications, public_key, encrypted_private_key } = parseResult.data;

  console.log('[PUT /profile] raw body:', JSON.stringify(body, null, 2));
  console.log('[PUT /profile] received body:', JSON.stringify(body));
  console.log('[PUT /profile] public_key:', public_key);
  console.log('[PUT /profile] encrypted_private_key:', encrypted_private_key);
  console.log('[PUT /profile] encrypted_private_key type:', typeof encrypted_private_key);
  console.log('[PUT /profile] encrypted_private_key === "":', encrypted_private_key === '');
  console.log('[PUT /profile] encrypted_private_key is truthy:', !!encrypted_private_key);
  
  try {
    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    
    if (first_name !== undefined) { updates.push('first_name = ?'); values.push(first_name); }
    if (last_name !== undefined) { updates.push('last_name = ?'); values.push(last_name); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone); }
    if (notifications !== undefined) { updates.push('notifications = ?'); values.push(notifications); }
    if (public_key !== undefined) { updates.push('public_key = ?'); values.push(public_key); }
    if (encrypted_private_key !== undefined && encrypted_private_key !== null) { updates.push('encrypted_private_key = ?'); values.push(encrypted_private_key); }
    
    console.log('[PUT /profile] updates:', JSON.stringify(updates));
    console.log('[PUT /profile] values:', JSON.stringify(values));
    
    if (updates.length === 0) {
      return c.json({ error: 'No fields to update' }, 400);
    }
    
    updates.push("updated_at = datetime('now')");
    values.push(userId);
    
    await c.env.DATABASE.prepare(`UPDATE profiles SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
    
    return c.json({ ok: true });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

// GET /profile/search - Search profiles by email, id, or thumbprint
// Protected: requires authentication to prevent email enumeration attacks
app.get('/search', authMiddleware, requireUser, async (c) => {
  const email = c.req.query('email');
  const id = c.req.query('id');
  const thumbprint = c.req.query('thumbprint');

  const parseResult = ProfileSearchInputSchema.safeParse({ email, id, thumbprint });
  if (!parseResult.success) {
    return c.json({ ok: false, error: parseResult.error.message, code: ErrorCode.VALIDATION_ERROR }, HTTP_STATUS.BAD_REQUEST);
  }

  try {
    let query = '';
    let params: any[] = [];

    if (email) {
      query = `
        SELECT p.id, p.first_name, p.last_name, p.email, p.public_key, e.ethereum_address
        FROM profiles p
        LEFT JOIN ethereum_users e ON e.id = p.id
        WHERE p.email = ?
      `;
      params = [email];
    } else if (id) {
      query = `
        SELECT p.id, p.first_name, p.last_name, p.email, p.public_key, e.ethereum_address
        FROM profiles p
        LEFT JOIN ethereum_users e ON e.id = p.id
        WHERE p.id = ?
      `;
      params = [id];
    } else if (thumbprint) {
      // Search by public_key thumbprint (stored as JSON string)
      query = `
        SELECT p.id, p.first_name, p.last_name, p.email, p.public_key, e.ethereum_address
        FROM profiles p
        LEFT JOIN ethereum_users e ON e.id = p.id
        WHERE p.public_key LIKE ?
      `;
      params = [`%"thumbprint": "${thumbprint}"%`];
    }

    const { results } = await c.env.DATABASE.prepare(query).bind(...params).all();

    if (results.length === 0) {
      return c.json({ error: 'Profile not found' }, 404);
    }

    return c.json({ ok: true, profile: results[0] });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

// POST /profile - Update the authenticated user's profile
app.post('/', authMiddleware, requireUser, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  
  const parseResult = ProfileUpdateInputSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ ok: false, error: parseResult.error.message, code: ErrorCode.VALIDATION_ERROR }, HTTP_STATUS.BAD_REQUEST);
  }
  
  const { first_name, last_name, public_key, encrypted_private_key } = parseResult.data;

  try {
    // Build update query dynamically for the authenticated user
    const updates: string[] = [];
    const values: any[] = [];
    
    if (first_name !== undefined) { updates.push('first_name = ?'); values.push(first_name); }
    if (last_name !== undefined) { updates.push('last_name = ?'); values.push(last_name); }
    if (public_key !== undefined) { updates.push('public_key = ?'); values.push(public_key); }
    if (encrypted_private_key !== undefined) { updates.push('encrypted_private_key = ?'); values.push(encrypted_private_key); }
    
    if (updates.length === 0) {
      return c.json({ error: 'No fields to update' }, 400);
    }
    
    updates.push("updated_at = datetime('now')");
    values.push(userId);
    
    await c.env.DATABASE.prepare(`UPDATE profiles SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
    
    return c.json({ ok: true, message: 'Profile updated' });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

app.post('/create-profile-wallet', authMiddleware, requireUser, async (c) => {
  const body = await c.req.json();
  const userId = c.get('userId');
  const { first_name, last_name, public_key, encrypted_private_key, email, phone } = body;

  // Validate public_key is valid JSON string
  if (public_key !== undefined && !isValidJsonString(public_key)) {
    return c.json({ error: 'public_key must be a valid JSON string' }, 400);
  }
  
  // Validate encrypted_private_key is valid JSON string
  if (encrypted_private_key !== undefined) {
    // Check for empty string
    if (encrypted_private_key === '') {
      return c.json({ error: 'encrypted_private_key cannot be an empty string' }, 400);
    }
    if (!isValidJsonString(encrypted_private_key)) {
      return c.json({ error: 'encrypted_private_key must be a valid JSON string' }, 400);
    }
  }
  
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
