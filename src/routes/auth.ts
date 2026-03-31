import { Hono } from 'hono';
import type { Env } from '../db/schema';
import { authMiddleware, requireUser } from '../middleware/auth';
import { RegisterInputSchema, LoginInputSchema, MfaLoginInputSchema } from '../schemas';
import { ErrorCode, HTTP_STATUS, VALIDATION } from '../constants';
import {
  generateSignInMessage,
  generateNonce,
  verifyRequestSignature,
  normalizeAddress,
} from '../middleware/ethereum-auth';
import { connectMetaMaskSchema } from '../schemas/blockchain';
// Use WebCrypto for Workers compatibility
// PBKDF2 with WebCrypto

const app = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

// Helper: PBKDF2 hash using WebCrypto
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  // Import password as key
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  // Derive bits
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    64 * 8
  );
  
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${saltHex}:${hashHex}`;
}

// Helper: Verify password against hash
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [saltHex, expectedHash] = hash.split(':');
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    64 * 8
  );
  
  const hashHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex === expectedHash;
}

// POST /register - email/password → profile + hash + wallet + temp JWT
app.post('/register', async (c) => {
  const body = await c.req.json();
  
  // Validate input using Zod schema
  const parseResult = RegisterInputSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ ok: false, error: parseResult.error.message, code: ErrorCode.VALIDATION_ERROR }, HTTP_STATUS.BAD_REQUEST);
  }
  const { email, password, first_name, last_name, public_key, encrypted_private_key } = parseResult.data;

  try {
    // Check if email already exists
    const existingUser = await c.env.DATABASE.prepare(
      `SELECT id FROM profiles WHERE email = ?`
    ).bind(email).first();

    if (existingUser) {
      return c.json({ ok: false, error: 'Email already registered', code: ErrorCode.EMAIL_EXISTS }, HTTP_STATUS.CONFLICT);
    }

    const passwordHash = await hashPassword(password);
    const userId = crypto.randomUUID();
    
    // Insert profile with optional key fields
    await c.env.DATABASE.prepare(`
      INSERT INTO profiles (id, email, first_name, last_name, password_hash, public_key, encrypted_private_key)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(userId, email, first_name, last_name || null, passwordHash, public_key || null, encrypted_private_key || null).run();

    // Create wallet entry for the user (with keys if provided)
    await c.env.DATABASE.prepare(`
      INSERT INTO wallets (user_id, public_key, encrypted_private_key, verified)
      VALUES (?, ?, ?, 0)
    `).bind(userId, public_key || null, encrypted_private_key || null).run();

    // Generate JWT (simple, exp 7d)
    const token = await jwtSign({ sub: userId, email }, c.env.JWT_SECRET!, { exp: Math.floor(Date.now() / 1000) + 60*60*24*7 });

    // Return token and user data
    return c.json({ 
      ok: true, 
      token, 
      user: {
        id: userId,
        email,
        first_name: first_name,
        last_name: last_name,
      }
    });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

// POST /login - email/password → JWT if match
app.post('/login', async (c) => {
  const body = await c.req.json();
  
  // Validate input using Zod schema
  const parseResult = LoginInputSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ ok: false, error: parseResult.error.message, code: ErrorCode.VALIDATION_ERROR }, HTTP_STATUS.BAD_REQUEST);
  }
  const { email, password } = parseResult.data;

  try {
    const { results } = await c.env.DATABASE.prepare('SELECT id, first_name, last_name, email, password_hash FROM profiles WHERE email = ?').bind(email).all();
    if (results.length === 0) {
      return c.json({ ok: false, error: 'Invalid credentials', code: ErrorCode.INVALID_CREDENTIALS }, HTTP_STATUS.UNAUTHORIZED);
    }

    const user = results[0] as any;
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return c.json({ ok: false, error: 'Invalid credentials', code: ErrorCode.INVALID_CREDENTIALS }, HTTP_STATUS.UNAUTHORIZED);
    }

    // Generate JWT
    const token = await jwtSign({ sub: user.id, email }, c.env.JWT_SECRET!, { exp: Math.floor(Date.now() / 1000) + 60*60*24*7 });

    // Return token and user data
    return c.json({ 
      ok: true, 
      token, 
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
      }
    });
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

// POST /send-otp - send magic link to email (for email verification)
app.post('/send-otp', async (c) => {
  const body = await c.req.json();
  const { email } = body;
  if (!email) {
    return c.json({ error: 'Missing email' }, 400);
  }

  try {
    // Check if user exists
    const { results } = await c.env.DATABASE.prepare('SELECT id FROM profiles WHERE email = ?').bind(email).all();
    
    if (results.length === 0) {
      // For security, don't reveal if email exists or not
      return c.json({ ok: true, message: 'If that email exists, a magic link has been sent' });
    }

    // Generate a magic link token
    const otpToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes
    
    // Store OTP token in database
    await c.env.DATABASE.prepare(`
      INSERT INTO otp_tokens (email, token, expires_at)
      VALUES (?, ?, ?)
    `).bind(email, otpToken, expiresAt).run();
    
    // TODO: In production, integrate with email service (SendGrid, Resend, etc.)
    // For now, we'll return a mock success but token is stored in DB
    console.log(`[send-otp] Magic link for ${email}: ${otpToken}`);
    
    // CRITICAL: Do NOT return the OTP token in production!
    // The token should only be sent via email
    return c.json({ ok: true, message: 'If that email exists, a magic link has been sent' });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

// POST /verify-otp - verify magic link token and return JWT
app.post('/verify-otp', async (c) => {
  const body = await c.req.json();
  const { email, token } = body;
  if (!email || !token) {
    return c.json({ error: 'Missing email or token' }, 400);
  }

  try {
    // Check if user exists
    const { results } = await c.env.DATABASE.prepare('SELECT id FROM profiles WHERE email = ?').bind(email).all();
    
    if (results.length === 0) {
      // For security, don't reveal if email exists
      return c.json({ ok: true, message: 'If that email exists, a magic link has been sent' });
    }

    // Validate OTP token from database
    const now = new Date().toISOString();
    const { results: otpResults } = await c.env.DATABASE.prepare(`
      SELECT id, email, expires_at, used 
      FROM otp_tokens 
      WHERE email = ? AND token = ? AND used = 0 AND expires_at > ?
      ORDER BY created_at DESC 
      LIMIT 1
    `).bind(email, token, now).all();
    
    if (otpResults.length === 0) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    // Mark token as used
    await c.env.DATABASE.prepare('UPDATE otp_tokens SET used = 1 WHERE id = ?').bind(otpResults[0].id).run();

    const user = results[0] as any;
    
    // Generate JWT
    const jwtToken = await jwtSign({ sub: user.id, email }, c.env.JWT_SECRET!, { exp: Math.floor(Date.now() / 1000) + 60*60*24*7 });

    return c.json({ ok: true, token: jwtToken });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

// POST /change-password - change user password
app.post('/change-password', authMiddleware, requireUser, async (c) => {
  const body = await c.req.json();
  const { password } = body;
  const userId = c.get('userId');
  
  if (!password) {
    return c.json({ error: 'Missing password' }, 400);
  }

  try {
    const passwordHash = await hashPassword(password);
    await c.env.DATABASE.prepare('UPDATE profiles SET password_hash = ? WHERE id = ?').bind(passwordHash, userId).run();
    
    return c.json({ ok: true });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

// GET /mfa-status - check if user has MFA enabled
app.get('/mfa-status', authMiddleware, requireUser, async (c) => {
  const userId = c.get('userId');
  
  try {
    const { results } = await c.env.DATABASE.prepare('SELECT mfa_enabled FROM profiles WHERE id = ?').bind(userId).all();
    
    if (results.length === 0) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    const user = results[0] as any;
    return c.json({ enabled: !!user.mfa_enabled });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

// POST /mfa-enable - Enable TOTP MFA for the user
app.post('/mfa-enable', authMiddleware, requireUser, async (c) => {
  const userId = c.get('userId');
  
  try {
    // Get user email for the secret
    const { results: userResults } = await c.env.DATABASE.prepare('SELECT email FROM profiles WHERE id = ?').bind(userId).all();
    if (userResults.length === 0) {
      return c.json({ error: 'User not found' }, 404);
    }
    const email = (userResults[0] as any).email;
    
    // Generate a random secret (base32 encoded)
    const secret = generateBase32Secret();
    
    // Generate otpauth URL for QR code
    const otpauthUrl = `otpauth://totp/CryoPay:${email}?secret=${secret}&issuer=CryoPay`;
    
    // Store the secret temporarily (not enabled yet until verified)
    await c.env.DATABASE.prepare('UPDATE profiles SET mfa_secret = ? WHERE id = ?').bind(secret, userId).run();
    
    return c.json({ 
      ok: true, 
      secret, 
      otpauthUrl,
      message: 'Scan the QR code with your authenticator app, then verify with a code'
    });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

// POST /mfa-verify - Verify and enable TOTP MFA
app.post('/mfa-verify', authMiddleware, requireUser, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const { code } = body;
  
  if (!code) {
    return c.json({ error: 'Missing verification code' }, 400);
  }
  
  try {
    // Get the stored secret
    const { results } = await c.env.DATABASE.prepare('SELECT mfa_secret FROM profiles WHERE id = ?').bind(userId).all();
    if (results.length === 0) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    const secret = (results[0] as any).mfa_secret;
    if (!secret) {
      return c.json({ error: 'No MFA setup in progress. Call /mfa-enable first.' }, 400);
    }
    
    // Verify the code against the secret
    const isValid = await verifyTOTP(code, secret);
    if (!isValid) {
      return c.json({ error: 'Invalid verification code' }, 401);
    }
    
    // Generate backup codes
    const backupCodes = generateBackupCodes();
    
    // Enable MFA
    await c.env.DATABASE.prepare('UPDATE profiles SET mfa_enabled = 1, mfa_secret = ?, mfa_backup_codes = ? WHERE id = ?')
      .bind(secret, JSON.stringify(backupCodes), userId).run();
    
    return c.json({ 
      ok: true, 
      message: 'MFA enabled successfully',
      backupCodes  // Return backup codes once
    });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

// POST /mfa-disable - Disable MFA (requires password)
app.post('/mfa-disable', authMiddleware, requireUser, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const { password } = body;
  
  if (!password) {
    return c.json({ error: 'Password required to disable MFA' }, 400);
  }
  
  try {
    // Verify password
    const { results } = await c.env.DATABASE.prepare('SELECT password_hash FROM profiles WHERE id = ?').bind(userId).all();
    if (results.length === 0) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    const isValid = await verifyPassword(password, (results[0] as any).password_hash);
    if (!isValid) {
      return c.json({ error: 'Invalid password' }, 401);
    }
    
    // Disable MFA
    await c.env.DATABASE.prepare('UPDATE profiles SET mfa_enabled = 0, mfa_secret = NULL, mfa_backup_codes = NULL WHERE id = ?')
      .bind(userId).run();
    
    return c.json({ ok: true, message: 'MFA disabled successfully' });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

// POST /mfa-login - Login with TOTP code (if MFA is enabled)
app.post('/mfa-login', async (c) => {
  const body = await c.req.json();
  
  // Validate input using Zod schema (note: schema uses mfa_code, body uses mfaCode)
  const parseResult = MfaLoginInputSchema.safeParse({
    email: body.email,
    password: body.password,
    mfa_code: body.mfaCode
  });
  if (!parseResult.success) {
    return c.json({ ok: false, error: parseResult.error.message, code: ErrorCode.VALIDATION_ERROR }, HTTP_STATUS.BAD_REQUEST);
  }
  const { email, password, mfa_code: mfaCode } = parseResult.data;
  
  try {
    // First verify credentials - include first_name and last_name in the query
    const { results } = await c.env.DATABASE.prepare('SELECT id, email, first_name, last_name, password_hash, mfa_enabled, mfa_secret FROM profiles WHERE email = ?').bind(email).all();
    if (results.length === 0) {
      return c.json({ ok: false, error: 'Invalid credentials', code: ErrorCode.INVALID_CREDENTIALS }, HTTP_STATUS.UNAUTHORIZED);
    }
    
    const user = results[0] as any;
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return c.json({ ok: false, error: 'Invalid credentials', code: ErrorCode.INVALID_CREDENTIALS }, HTTP_STATUS.UNAUTHORIZED);
    }
    
    // If MFA is enabled, verify the TOTP code
    if (user.mfa_enabled && user.mfa_secret) {
      const isMfaValid = await verifyTOTP(mfaCode, user.mfa_secret);
      if (!isMfaValid) {
        return c.json({ ok: false, error: 'Invalid MFA code', code: ErrorCode.MFA_INVALID }, HTTP_STATUS.UNAUTHORIZED);
      }
    }
    
    // Generate JWT
    const token = await jwtSign({ sub: user.id, email }, c.env.JWT_SECRET!, { exp: Math.floor(Date.now() / 1000) + 60*60*24*7 });
    
    return c.json({ 
      ok: true, 
      token, 
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
      }
    });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

// Helper: Generate base32 secret
function generateBase32Secret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  const randomValues = crypto.getRandomValues(new Uint8Array(16));
  for (let i = 0; i < 16; i++) {
    secret += chars[randomValues[i] % 32];
  }
  return secret;
}

// Helper: Generate backup codes
function generateBackupCodes(): string[] {
  const codes: string[] = [];
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  for (let i = 0; i < 10; i++) {
    let code = '';
    const randomValues = crypto.getRandomValues(new Uint8Array(8));
    for (let j = 0; j < 8; j++) {
      code += chars[randomValues[j] % 36];
      if (j === 3) code += '-';
    }
    codes.push(code);
  }
  return codes;
}

// Helper: Generate JWT for MetaMask authentication (24-hour expiry)
async function generateJWT(userId: string, secret: string): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    sub: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
  }));
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${header}.${payload}`)
  );
  
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  return `${header}.${payload}.${sig}`;
}

// Helper: Verify TOTP code using HMAC-SHA1 (RFC 6238 compliant)
async function verifyTOTP(code: string, secret: string): Promise<boolean> {
  // Decode base32 secret
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleanedSecret = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
  
  // Convert base32 to Uint8Array
  let bits = '';
  for (const char of cleanedSecret) {
    const val = base32Chars.indexOf(char);
    if (val === -1) return false;
    bits += val.toString(2).padStart(5, '0');
  }
  
  const keyBytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    keyBytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  
  const keyData = new Uint8Array(keyBytes);
  
  // Get current time step (30 second periods)
  const timeStep = Math.floor(Date.now() / 1000 / 30);
  
  // Check current and adjacent time steps (for clock drift)
  for (const offset of [-1, 0, 1]) {
    let step = timeStep + offset;
    const stepBytes = new Uint8Array(8);
    for (let i = 7; i >= 0; i--) {
      stepBytes[i] = step & 0xff;
      step = Math.floor(step / 256);
    }
    
    // Compute HMAC-SHA1
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    const hmac = await crypto.subtle.sign('HMAC', cryptoKey, stepBytes);
    const hmacBytes = new Uint8Array(hmac);
    
    // Dynamic truncation (RFC 4226)
    const offsetBits = hmacBytes[hmacBytes.length - 1] & 0x0f;
    const binary = 
      ((hmacBytes[offsetBits] & 0x7f) << 24) |
      ((hmacBytes[offsetBits + 1] & 0xff) << 16) |
      ((hmacBytes[offsetBits + 2] & 0xff) << 8) |
      (hmacBytes[offsetBits + 3] & 0xff);
    
    const expectedCode = (binary % 1000000).toString().padStart(6, '0');
    if (expectedCode === code) {
      return true;
    }
  }
  
  return false;
}

// ============ MetaMask Authentication Routes ============

/**
 * GET /api/auth/metamask/nonce
 * Generate a nonce for MetaMask sign-in
 */
app.get('/metamask/nonce', async (c) => {
  const address = c.req.query('address');

  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return c.json({ error: 'Invalid Ethereum address' }, 400);
  }

  const nonce = generateNonce();
  const message = generateSignInMessage(address, nonce, 'CryoPay');

  // Store nonce temporarily (in production, use a proper cache)
  // For now, we'll include it in the message and verify on return

  return c.json({
    success: true,
    data: {
      nonce,
      message,
      address: normalizeAddress(address),
    },
  });
});

/**
 * POST /api/auth/metamask/connect
 * Connect/register a MetaMask wallet
 */
app.post('/metamask/connect', async (c) => {
  try {
    const body = await c.req.json();

    // Validate request
    const parseResult = connectMetaMaskSchema.safeParse(body);
    if (!parseResult.success) {
      return c.json(
        {
          success: false,
          error: 'Validation failed',
          details: parseResult.error.issues,
        },
        400
      );
    }

    const { address, signature, message, firstName, lastName } = parseResult.data;

    // Verify the signature
    const verification = await verifyRequestSignature({
      address,
      signature,
      message,
    });

    if (!verification.valid) {
      return c.json(
        {
          success: false,
          error: 'Signature verification failed',
          message: verification.error,
        },
        401
      );
    }

    const normalizedAddress = normalizeAddress(address);

    // Check if wallet is already registered
    const { results: existingUser } = await c.env.DATABASE.prepare(
      'SELECT id, ethereum_address FROM ethereum_users WHERE ethereum_address = ?'
    ).bind(normalizedAddress).all();

    if (existingUser && existingUser.length > 0) {
      // Wallet already linked - generate JWT token
      const userId = (existingUser[0] as any).id;

      // Update profile with firstName/lastName if provided
      if (firstName || lastName) {
        const now = new Date().toISOString();
        if (firstName && lastName) {
          await c.env.DATABASE.prepare(
            `UPDATE profiles SET first_name = ?, last_name = ?, updated_at = ? WHERE id = ?`
          ).bind(firstName, lastName, now, userId).run();
        } else if (firstName) {
          await c.env.DATABASE.prepare(
            `UPDATE profiles SET first_name = ?, updated_at = ? WHERE id = ?`
          ).bind(firstName, now, userId).run();
        } else if (lastName) {
          await c.env.DATABASE.prepare(
            `UPDATE profiles SET last_name = ?, updated_at = ? WHERE id = ?`
          ).bind(lastName, now, userId).run();
        }
      }

      // Get profile info
      const { results: profileResults } = await c.env.DATABASE.prepare(
        'SELECT * FROM profiles WHERE id = ?'
      ).bind(userId).all();

      if (!profileResults || profileResults.length === 0) {
        return c.json({ error: 'User profile not found' }, 404);
      }

      const profile = profileResults[0] as any;

      // Generate JWT token (reuse existing token generation logic)
      const token = await generateJWT(userId, c.env.JWT_SECRET);

      return c.json({
        success: true,
        message: 'Wallet connected successfully',
        data: {
          token,
          user: {
            id: userId,
            ethereumAddress: normalizedAddress,
            email: profile.email,
            firstName: profile.first_name,
            lastName: profile.last_name,
          },
          isNewUser: false,
        },
      });
    }

    // Check if a profile already exists with this wallet's email
    // This handles the case where ethereum_users entry was deleted but profile still exists
    const walletEmail = `${normalizedAddress}@wallet.cryopay`;
    const { results: existingProfile } = await c.env.DATABASE.prepare(
      'SELECT id, email, first_name, last_name FROM profiles WHERE email = ?'
    ).bind(walletEmail).all();

    if (existingProfile && existingProfile.length > 0) {
      // Profile exists but ethereum_users entry is missing - recreate the link
      const profile = existingProfile[0] as any;
      const userId = profile.id;
      const now = new Date().toISOString();

      // Recreate ethereum_users entry
      await c.env.DATABASE.prepare(
        `INSERT INTO ethereum_users (id, ethereum_address, verified, created_at, updated_at)
         VALUES (?, ?, 1, ?, ?)`
      ).bind(userId, normalizedAddress, now, now).run();

      // Update profile with firstName/lastName if provided
      if (firstName || lastName) {
        if (firstName && lastName) {
          await c.env.DATABASE.prepare(
            `UPDATE profiles SET first_name = ?, last_name = ?, updated_at = ? WHERE id = ?`
          ).bind(firstName, lastName, now, userId).run();
        } else if (firstName) {
          await c.env.DATABASE.prepare(
            `UPDATE profiles SET first_name = ?, updated_at = ? WHERE id = ?`
          ).bind(firstName, now, userId).run();
        } else if (lastName) {
          await c.env.DATABASE.prepare(
            `UPDATE profiles SET last_name = ?, updated_at = ? WHERE id = ?`
          ).bind(lastName, now, userId).run();
        }
      }

      // Generate JWT token
      const token = await generateJWT(userId, c.env.JWT_SECRET);

      return c.json({
        success: true,
        message: 'Wallet reconnected successfully',
        data: {
          token,
          user: {
            id: userId,
            ethereumAddress: normalizedAddress,
            email: profile.email,
            firstName: firstName || profile.first_name,
            lastName: lastName || profile.last_name,
          },
          isNewUser: false,
        },
      });
    }

    // New wallet - create user account
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Create profile with firstName/lastName if provided
    await c.env.DATABASE.prepare(
      `INSERT INTO profiles (id, email, first_name, last_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(userId, `${normalizedAddress}@wallet.cryopay`, firstName || null, lastName || null, now, now).run();

    // Link Ethereum address
    await c.env.DATABASE.prepare(
      `INSERT INTO ethereum_users (id, ethereum_address, verified, created_at, updated_at)
       VALUES (?, ?, 1, ?, ?)`
    ).bind(userId, normalizedAddress, now, now).run();

    // Generate JWT token
    const token = await generateJWT(userId, c.env.JWT_SECRET);

    return c.json({
      success: true,
      message: 'Wallet registered successfully',
      data: {
        token,
        user: {
          id: userId,
          ethereumAddress: normalizedAddress,
          email: `${normalizedAddress}@wallet.cryopay`,
          firstName: firstName || null,
          lastName: lastName || null,
        },
        isNewUser: true,
      },
    });
  } catch (error) {
    console.error('MetaMask connect error:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to connect wallet',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * POST /api/auth/metamask/link
 * Link a MetaMask wallet to an existing account (requires JWT auth)
 */
app.post('/metamask/link', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const userId = c.get('userId');

    // Validate request
    const parseResult = connectMetaMaskSchema.safeParse(body);
    if (!parseResult.success) {
      return c.json(
        {
          success: false,
          error: 'Validation failed',
          details: parseResult.error.issues,
        },
        400
      );
    }

    const { address, signature, message } = parseResult.data;

    // Verify the signature
    const verification = await verifyRequestSignature({
      address,
      signature,
      message,
    });

    if (!verification.valid) {
      return c.json(
        {
          success: false,
          error: 'Signature verification failed',
          message: verification.error,
        },
        401
      );
    }

    const normalizedAddress = normalizeAddress(address);

    // Check if wallet is already linked to another user
    const { results: existingLink } = await c.env.DATABASE.prepare(
      'SELECT id FROM ethereum_users WHERE ethereum_address = ?'
    ).bind(normalizedAddress).all();

    if (existingLink && existingLink.length > 0) {
      const linkedUserId = (existingLink[0] as any).id;
      if (linkedUserId !== userId) {
        return c.json(
          {
            success: false,
            error: 'Wallet already linked to another account',
          },
          409
        );
      }
      // Already linked to this user
      return c.json({
        success: true,
        message: 'Wallet already linked to your account',
        data: {
          ethereumAddress: normalizedAddress,
        },
      });
    }

    // Check if user already has a wallet linked
    const { results: userWallet } = await c.env.DATABASE.prepare(
      'SELECT ethereum_address FROM ethereum_users WHERE id = ?'
    ).bind(userId).all();

    const now = new Date().toISOString();

    if (userWallet && userWallet.length > 0) {
      // Update existing link
      await c.env.DATABASE.prepare(
        `UPDATE ethereum_users 
         SET ethereum_address = ?, verified = 1, updated_at = ?
         WHERE id = ?`
      ).bind(normalizedAddress, now, userId).run();
    } else {
      // Create new link
      await c.env.DATABASE.prepare(
        `INSERT INTO ethereum_users (id, ethereum_address, verified, created_at, updated_at)
         VALUES (?, ?, 1, ?, ?)`
      ).bind(userId, normalizedAddress, now, now).run();
    }

    return c.json({
      success: true,
      message: 'Wallet linked successfully',
      data: {
        ethereumAddress: normalizedAddress,
      },
    });
  } catch (error) {
    console.error('MetaMask link error:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to link wallet',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/auth/metamask/status
 * Get MetaMask wallet status for authenticated user
 */
app.get('/metamask/status', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');

    const { results } = await c.env.DATABASE.prepare(
      'SELECT * FROM ethereum_users WHERE id = ?'
    ).bind(userId).all();

    if (!results || results.length === 0) {
      return c.json({
        success: true,
        data: {
          linked: false,
          ethereumAddress: null,
        },
      });
    }

    const wallet = results[0] as any;

    return c.json({
      success: true,
      data: {
        linked: true,
        ethereumAddress: wallet.ethereum_address,
        verified: wallet.verified === 1,
        createdAt: wallet.created_at,
      },
    });
  } catch (error) {
    console.error('MetaMask status error:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to get wallet status',
      },
      500
    );
  }
});

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
