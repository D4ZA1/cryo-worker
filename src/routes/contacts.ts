import { Hono } from 'hono';
import type { Env } from '../db/schema';
import { authMiddleware, requireUser } from '../middleware/auth';
import { ContactInputSchema, ContactUpdateInputSchema } from '../schemas';
import { ErrorCode, HTTP_STATUS } from '../constants';

const app = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

// GET /contacts - Get all contacts for current user
app.get('/', authMiddleware, requireUser, async (c) => {
  const userId = c.get('userId');
  
  try {
    const { results } = await c.env.DATABASE.prepare(`
      SELECT id, user_id, contact_user_id, name, address, email, label, public_key, created_at, updated_at
      // FROM contacts 
      WHERE user_id = ?
      ORDER BY name ASC
      LIMIT 100
    `).bind(userId).all();
    
    return c.json({ ok: true, contacts: results });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

// GET /contacts/:id - Get a specific contact
app.get('/:id', authMiddleware, requireUser, async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  
  try {
    const { results } = await c.env.DATABASE.prepare(`
      SELECT id, user_id, contact_user_id, name, address, email, label, public_key, created_at, updated_at
      FROM contacts 
      WHERE id = ? AND user_id = ?
    `).bind(id, userId).all();
    
    if (results.length === 0) {
      return c.json({ error: 'Contact not found' }, 404);
    }
    
    return c.json({ ok: true, contact: results[0] });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

// POST /contacts - Create a new contact
app.post('/', authMiddleware, requireUser, async (c) => {
  const userId = c.get('userId');
  
  try {
    const body = await c.req.json();
    
    const parseResult = ContactInputSchema.safeParse(body);
    if (!parseResult.success) {
      return c.json({ ok: false, error: parseResult.error.message, code: ErrorCode.VALIDATION_ERROR }, HTTP_STATUS.BAD_REQUEST);
    }
    
    const { name, address, email, label, public_key, contact_user_id } = parseResult.data;
    
    const { success } = await c.env.DATABASE.prepare(`
      INSERT INTO contacts (user_id, contact_user_id, name, address, email, label, public_key, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(userId, contact_user_id || null, name, address, email || null, label || null, public_key || null).run();
    
    if (!success) {
      return c.json({ error: 'Failed to create contact' }, 500);
    }
    
    // Get the inserted contact
    const { results } = await c.env.DATABASE.prepare(`
      SELECT id, user_id, contact_user_id, name, address, email, label, public_key, created_at, updated_at
      FROM contacts 
      WHERE user_id = ? AND name = ? AND address = ?
      ORDER BY id DESC LIMIT 1
    `).bind(userId, name, address).all();
    
    return c.json({ ok: true, contact: results[0] }, 201);
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

// PUT /contacts/:id - Update a contact
app.put('/:id', authMiddleware, requireUser, async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  
  try {
    const body = await c.req.json();
    
    const parseResult = ContactUpdateInputSchema.safeParse(body);
    if (!parseResult.success) {
      return c.json({ ok: false, error: parseResult.error.message, code: ErrorCode.VALIDATION_ERROR }, HTTP_STATUS.BAD_REQUEST);
    }
    
    const { name, address, email, label, public_key } = parseResult.data;
    
    // Check if contact exists and belongs to user
    const { results: existing } = await c.env.DATABASE.prepare(`
      SELECT id FROM contacts WHERE id = ? AND user_id = ?
    `).bind(id, userId).all();
    
    if (existing.length === 0) {
      return c.json({ error: 'Contact not found' }, 404);
    }
    
    const { success } = await c.env.DATABASE.prepare(`
      UPDATE contacts 
      SET name = COALESCE(?, name), 
          address = COALESCE(?, address),
          email = COALESCE(?, email),
          label = COALESCE(?, label),
          public_key = COALESCE(?, public_key),
          updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).bind(name, address, email, label, public_key, id, userId).run();
    
    if (!success) {
      return c.json({ error: 'Failed to update contact' }, 500);
    }
    
    // Get updated contact
    const { results } = await c.env.DATABASE.prepare(`
      SELECT id, user_id, contact_user_id, name, address, email, label, public_key, created_at, updated_at
      FROM contacts WHERE id = ?
    `).bind(id).all();
    
    return c.json({ ok: true, contact: results[0] });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

// DELETE /contacts/:id - Delete a contact
app.delete('/:id', authMiddleware, requireUser, async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  
  try {
    const { success } = await c.env.DATABASE.prepare(`
      DELETE FROM contacts WHERE id = ? AND user_id = ?
    `).bind(id, userId).run();
    
    if (!success) {
      return c.json({ error: 'Failed to delete contact' }, 500);
    }
    
    return c.json({ ok: true, message: 'Contact deleted' });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

export default app;