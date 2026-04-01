import { Hono } from 'hono';
import type { Env } from '../db/schema';
import { authMiddleware, requireUser } from '../middleware/auth';
import { BlockInputSchema } from '../schemas';
import { ErrorCode, HTTP_STATUS } from '../constants';

const app = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

// GET /blocks - Get all blocks for current user (transactions)
app.get('/', authMiddleware, requireUser, async (c) => {
  const userId = c.get('userId');
  
  try {
    const { results } = await c.env.DATABASE.prepare(`
      SELECT id, data, previous_hash, hash, created_at, user_id
      FROM blocks 
      WHERE user_id = ?
         OR json_extract(data, '$.public_summary.to_user_id') = ?
      ORDER BY created_at DESC
      LIMIT 100
    `).bind(userId, userId).all();
    
    // Parse the JSON data field for each block
    const blocks = (results || []).map((block: any) => ({
      ...block,
      data: typeof block.data === 'string' && block.data ? JSON.parse(block.data) : null,
    }));
    
    return c.json({ ok: true, blocks });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

// GET /blocks/:id - Get a specific block
app.get('/:id', authMiddleware, requireUser, async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  
  try {
    const { results } = await c.env.DATABASE.prepare(`
      SELECT id, data, previous_hash, hash, created_at, user_id
      FROM blocks 
      WHERE id = ? AND user_id = ?
    `).bind(id, userId).all();
    
    if (results.length === 0) {
      return c.json({ error: 'Block not found' }, 404);
    }
    
    // Parse the JSON data field
    const block = {
      ...results[0],
      data: typeof results[0].data === 'string' && results[0].data ? JSON.parse(results[0].data) : null,
    };
    
    return c.json({ ok: true, block });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

// POST /blocks - Create a new block (transaction)
app.post('/', authMiddleware, requireUser, async (c) => {
  const userId = c.get('userId');
  
  try {
    const body = await c.req.json();
    
    const parseResult = BlockInputSchema.safeParse(body);
    if (!parseResult.success) {
      return c.json({ ok: false, error: parseResult.error.message, code: ErrorCode.VALIDATION_ERROR }, HTTP_STATUS.BAD_REQUEST);
    }
    
    let { data, previous_hash } = parseResult.data;
    
    // Convert undefined to null for D1 database compatibility
    let dataValue: string | null = data ?? null;
    let previousHashValue: string | null = previous_hash ?? null;
    
    // If no previous_hash provided, this might be the first block for this user
    // Check if there's an existing block, otherwise use genesis hash
    if (!previousHashValue) {
      try {
        const { results } = await c.env.DATABASE.prepare(`
          SELECT hash FROM blocks WHERE user_id = ? ORDER BY id DESC LIMIT 1
        `).bind(userId).all();
        
        if (results && results.length > 0) {
          previousHashValue = results[0].hash as string | null;
        }
      } catch (e) {
        // If query fails, use null (genesis block)
        console.warn('Failed to get previous hash:', e);
      }
    }
    
    // Generate hash for new block
    const timestamp = Date.now().toString();
    const hashInput = `${dataValue || ''}${previousHashValue || ''}${timestamp}${userId}`;
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(hashInput));
    const hash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    const { success } = await c.env.DATABASE.prepare(`
      INSERT INTO blocks (data, previous_hash, hash, created_at, user_id)
      VALUES (?, ?, ?, datetime('now'), ?)
    `).bind(dataValue, previousHashValue, hash, userId).run();
    
    if (!success) {
      return c.json({ error: 'Failed to create block' }, 500);
    }
    
    // Get the inserted block
    const { results } = await c.env.DATABASE.prepare(`
      SELECT id, data, previous_hash, hash, created_at, user_id
      FROM blocks 
      WHERE hash = ?
    `).bind(hash).all();
    
    return c.json({ ok: true, block: {
      ...results[0],
      data: typeof results[0].data === 'string' && results[0].data ? JSON.parse(results[0].data) : null,
    } }, 201);
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

export default app;