import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockD1Database, createMockEnv, createMockJwt } from '../utils/mocks';
import type { D1Database } from '@cloudflare/workers-types';

// Import app
import app from '../../src/index';

// Response data interfaces
interface ApiResponse {
  ok?: boolean;
  error?: string;
  code?: string;
  message?: string;
}

interface AuthResponse extends ApiResponse {
  token?: string;
  user?: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
  };
}

interface ProfileResponse extends ApiResponse {
  profile?: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    public_key?: string;
    encrypted_private_key?: string;
    notifications?: string;
    created_at?: string;
    updated_at?: string;
  };
}

interface WalletResponse extends ApiResponse {
  wallet?: {
    user_id: string;
    public_key?: string;
    encrypted_private_key?: string;
    verified: number;
    created_at?: string;
    updated_at?: string;
  };
}

interface BlockResponse extends ApiResponse {
  block?: {
    id: number;
    data?: any;
    previous_hash?: string;
    hash: string;
    created_at?: string;
    user_id?: string;
  };
  blocks?: Array<{
    id: number;
    data?: any;
    previous_hash?: string;
    hash: string;
    created_at?: string;
    user_id?: string;
  }>;
}

interface ContactResponse extends ApiResponse {
  contact?: {
    id: number;
    user_id: string;
    contact_user_id?: string;
    name: string;
    address: string;
    email?: string;
    label?: string;
    public_key?: string;
    created_at?: string;
    updated_at?: string;
  };
  contacts?: Array<{
    id: number;
    user_id: string;
    contact_user_id?: string;
    name: string;
    address: string;
    email?: string;
    label?: string;
    public_key?: string;
    created_at?: string;
    updated_at?: string;
  }>;
}

interface MfaEnableResponse extends ApiResponse {
  secret?: string;
  otpauthUrl?: string;
}

interface MfaVerifyResponse extends ApiResponse {
  backupCodes?: string[];
}

interface MfaStatusResponse {
  enabled: boolean;
}

// Helper functions mirroring auth.ts implementation
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
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
  
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${saltHex}:${hashHex}`;
}

// Generate TOTP code for testing MFA
async function generateTOTP(secret: string): Promise<string> {
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleanedSecret = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
  
  let bits = '';
  for (const char of cleanedSecret) {
    const val = base32Chars.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  
  const keyBytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    keyBytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  
  const keyData = new Uint8Array(keyBytes);
  const timeStep = Math.floor(Date.now() / 1000 / 30);
  
  const stepBytes = new Uint8Array(8);
  let step = timeStep;
  for (let i = 7; i >= 0; i--) {
    stepBytes[i] = step & 0xff;
    step = Math.floor(step / 256);
  }
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const hmac = await crypto.subtle.sign('HMAC', cryptoKey, stepBytes);
  const hmacBytes = new Uint8Array(hmac);
  
  const offsetBits = hmacBytes[hmacBytes.length - 1] & 0x0f;
  const binary = 
    ((hmacBytes[offsetBits] & 0x7f) << 24) |
    ((hmacBytes[offsetBits + 1] & 0xff) << 16) |
    ((hmacBytes[offsetBits + 2] & 0xff) << 8) |
    (hmacBytes[offsetBits + 3] & 0xff);
  
  return (binary % 1000000).toString().padStart(6, '0');
}

// Mock prepared statement for integration tests
class IntegrationMockPreparedStatement {
  private boundValues: any[] = [];
  
  constructor(
    private query: string,
    private storage: Map<string, any[]>,
    private idCounters: Map<string, number>
  ) {}
  
  bind(...args: any): IntegrationMockPreparedStatement {
    this.boundValues = args;
    return this;
  }
  
  async run(): Promise<{ success: true; meta: any; results: any[] }> {
    const query = this.query.toLowerCase();
    
    if (query.includes('insert into profiles')) {
      const profiles = this.storage.get('profiles') || [];
      const newProfile = {
        id: this.boundValues[0],
        email: this.boundValues[1],
        first_name: this.boundValues[2],
        last_name: this.boundValues[3],
        password_hash: this.boundValues[4],
        public_key: this.boundValues[5],
        encrypted_private_key: this.boundValues[6],
        notifications: '{}',
        mfa_enabled: 0,
        mfa_secret: null,
        mfa_backup_codes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      profiles.push(newProfile);
      this.storage.set('profiles', profiles);
    } else if (query.includes('insert into wallets')) {
      const wallets = this.storage.get('wallets') || [];
      const existingIndex = wallets.findIndex(w => w.user_id === this.boundValues[0]);
      const newWallet = {
        user_id: this.boundValues[0],
        public_key: this.boundValues[1],
        encrypted_private_key: this.boundValues[2],
        verified: this.boundValues[3] || 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (existingIndex >= 0) {
        wallets[existingIndex] = { ...wallets[existingIndex], ...newWallet };
      } else {
        wallets.push(newWallet);
      }
      this.storage.set('wallets', wallets);
    } else if (query.includes('insert into blocks')) {
      const blocks = this.storage.get('blocks') || [];
      const id = (this.idCounters.get('blocks') || 0) + 1;
      this.idCounters.set('blocks', id);
      const newBlock = {
        id,
        data: this.boundValues[0],
        previous_hash: this.boundValues[1],
        hash: this.boundValues[2],
        created_at: new Date().toISOString(),
        user_id: this.boundValues[3],
      };
      blocks.push(newBlock);
      this.storage.set('blocks', blocks);
    } else if (query.includes('insert into contacts')) {
      const contacts = this.storage.get('contacts') || [];
      const id = (this.idCounters.get('contacts') || 0) + 1;
      this.idCounters.set('contacts', id);
      const newContact = {
        id,
        user_id: this.boundValues[0],
        contact_user_id: this.boundValues[1],
        name: this.boundValues[2],
        address: this.boundValues[3],
        email: this.boundValues[4],
        label: this.boundValues[5],
        public_key: this.boundValues[6],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      contacts.push(newContact);
      this.storage.set('contacts', contacts);
    } else if (query.includes('update profiles set')) {
      const profiles = this.storage.get('profiles') || [];
      const userId = this.boundValues[this.boundValues.length - 1];
      const profileIndex = profiles.findIndex(p => p.id === userId);
      if (profileIndex >= 0) {
        // Handle different update patterns
        if (query.includes('mfa_enabled = 1')) {
          profiles[profileIndex].mfa_enabled = 1;
          profiles[profileIndex].mfa_secret = this.boundValues[0];
          profiles[profileIndex].mfa_backup_codes = this.boundValues[1];
        } else if (query.includes('mfa_enabled = 0')) {
          profiles[profileIndex].mfa_enabled = 0;
          profiles[profileIndex].mfa_secret = null;
          profiles[profileIndex].mfa_backup_codes = null;
        } else if (query.includes('mfa_secret = ?') && !query.includes('mfa_enabled')) {
          // mfa-enable sets only mfa_secret
          profiles[profileIndex].mfa_secret = this.boundValues[0];
        } else if (query.includes('password_hash')) {
          profiles[profileIndex].password_hash = this.boundValues[0];
        } else {
          // General profile update
          profiles[profileIndex].updated_at = new Date().toISOString();
        }
      }
      this.storage.set('profiles', profiles);
    } else if (query.includes('update wallets')) {
      const wallets = this.storage.get('wallets') || [];
      const userId = this.boundValues[this.boundValues.length - 1];
      const walletIndex = wallets.findIndex(w => w.user_id === userId);
      if (walletIndex >= 0) {
        if (query.includes('verified = 1')) {
          wallets[walletIndex].verified = 1;
        }
        wallets[walletIndex].updated_at = new Date().toISOString();
      }
      this.storage.set('wallets', wallets);
    } else if (query.includes('update contacts')) {
      const contacts = this.storage.get('contacts') || [];
      const contactId = this.boundValues[this.boundValues.length - 2];
      const contactIndex = contacts.findIndex(c => String(c.id) === String(contactId));
      if (contactIndex >= 0) {
        if (this.boundValues[0]) contacts[contactIndex].name = this.boundValues[0];
        if (this.boundValues[1]) contacts[contactIndex].address = this.boundValues[1];
        if (this.boundValues[2]) contacts[contactIndex].email = this.boundValues[2];
        if (this.boundValues[3]) contacts[contactIndex].label = this.boundValues[3];
        if (this.boundValues[4]) contacts[contactIndex].public_key = this.boundValues[4];
        contacts[contactIndex].updated_at = new Date().toISOString();
      }
      this.storage.set('contacts', contacts);
    } else if (query.includes('delete from contacts')) {
      const contacts = this.storage.get('contacts') || [];
      const contactId = this.boundValues[0];
      const userId = this.boundValues[1];
      const filtered = contacts.filter(c => !(String(c.id) === String(contactId) && c.user_id === userId));
      this.storage.set('contacts', filtered);
    }
    
    return { success: true as const, meta: {}, results: [] };
  }
  
  async first<T = any>(): Promise<T | null> {
    const results = await this.all<T>();
    return results.results[0] || null;
  }
  
  async all<T = any>(): Promise<{ results: T[]; success: true; meta: any }> {
    const query = this.query.toLowerCase();
    let results: any[] = [];
    
    if (query.includes('from profiles')) {
      const profiles = this.storage.get('profiles') || [];
      if (query.includes('where email = ?')) {
        results = profiles.filter(p => p.email === this.boundValues[0]);
      } else if (query.includes('where id = ?')) {
        results = profiles.filter(p => p.id === this.boundValues[0]);
      } else if (query.includes('where public_key like')) {
        const searchPattern = this.boundValues[0].replace(/%/g, '');
        results = profiles.filter(p => p.public_key && p.public_key.includes(searchPattern));
      } else {
        results = profiles;
      }
    } else if (query.includes('from wallets')) {
      const wallets = this.storage.get('wallets') || [];
      if (query.includes('where user_id = ?')) {
        results = wallets.filter(w => w.user_id === this.boundValues[0]);
      } else {
        results = wallets;
      }
    } else if (query.includes('from blocks')) {
      const blocks = this.storage.get('blocks') || [];
      if (query.includes('where id = ? and user_id = ?')) {
        results = blocks.filter(b => String(b.id) === String(this.boundValues[0]) && b.user_id === this.boundValues[1]);
      } else if (query.includes('where hash = ?')) {
        results = blocks.filter(b => b.hash === this.boundValues[0]);
      } else if (query.includes('where user_id = ?')) {
        const userBlocks = blocks.filter(b => b.user_id === this.boundValues[0]);
        if (query.includes('order by id desc limit 1')) {
          results = userBlocks.slice(-1);
        } else {
          results = userBlocks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }
      } else {
        results = blocks;
      }
    } else if (query.includes('from contacts')) {
      const contacts = this.storage.get('contacts') || [];
      if (query.includes('where id = ? and user_id = ?')) {
        results = contacts.filter(c => String(c.id) === String(this.boundValues[0]) && c.user_id === this.boundValues[1]);
      } else if (query.includes('where id = ?')) {
        results = contacts.filter(c => String(c.id) === String(this.boundValues[0]));
      } else if (query.includes('where user_id = ? and name = ? and address = ?')) {
        results = contacts.filter(c => 
          c.user_id === this.boundValues[0] && 
          c.name === this.boundValues[1] && 
          c.address === this.boundValues[2]
        );
      } else if (query.includes('where user_id = ?')) {
        results = contacts.filter(c => c.user_id === this.boundValues[0]);
        results.sort((a, b) => a.name.localeCompare(b.name));
      } else {
        results = contacts;
      }
    }
    
    return { results: results as T[], success: true as const, meta: {} };
  }
  
  async raw<T = any>(): Promise<T[]> {
    const result = await this.all<T>();
    return result.results;
  }
}

// Extended MockD1Database with tracking capabilities
class IntegrationMockD1Database {
  private storage: Map<string, any[]> = new Map();
  private idCounters: Map<string, number> = new Map();
  
  constructor() {
    // Initialize tables
    this.storage.set('profiles', []);
    this.storage.set('wallets', []);
    this.storage.set('blocks', []);
    this.storage.set('contacts', []);
    this.storage.set('otp_tokens', []);
    this.idCounters.set('blocks', 0);
    this.idCounters.set('contacts', 0);
    this.idCounters.set('otp_tokens', 0);
  }
  
  // Get storage for testing assertions
  getStorage(table: string): any[] {
    return this.storage.get(table) || [];
  }
  
  // Add a record directly (for test setup)
  addRecord(table: string, record: any): void {
    const records = this.storage.get(table) || [];
    records.push(record);
    this.storage.set(table, records);
  }
  
  prepare(query: string): IntegrationMockPreparedStatement {
    return new IntegrationMockPreparedStatement(query, this.storage, this.idCounters);
  }
  
  batch<T = unknown>(_statements: any[]): Promise<any[]> {
    return Promise.resolve([]);
  }
  
  exec(_query: string): Promise<{ count: number; duration: number }> {
    return Promise.resolve({ count: 0, duration: 0 });
  }
  
  withSession(_constraintOrBookmark: string | ArrayBuffer): any {
    return this;
  }
}

describe('API Integration Tests', () => {
  let mockDb: IntegrationMockD1Database;
  const JWT_SECRET = 'test-jwt-secret-key-for-testing-purposes-only';
  
  beforeEach(() => {
    mockDb = new IntegrationMockD1Database();
  });
  
  // Helper to make requests to the app
  async function makeRequest(
    method: string, 
    path: string, 
    body?: any, 
    token?: string
  ): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const request = new Request(`http://localhost${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    
    return app.fetch(request, {
      DATABASE: mockDb as unknown as D1Database,
      JWT_SECRET,
    });
  }
  
  describe('Registration and Login Workflow', () => {
    it('should register, login, and access protected routes', async () => {
      // Step 1: Register a new user
      const registerResponse = await makeRequest('POST', '/api/auth/register', {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        first_name: 'John',
        last_name: 'Doe',
      });
      
      expect(registerResponse.status).toBe(200);
      const registerData = await registerResponse.json() as AuthResponse;
      expect(registerData.ok).toBe(true);
      expect(registerData.token).toBeDefined();
      expect(registerData.user?.email).toBe('test@example.com');
      
      // Step 2: Login with the same credentials
      const loginResponse = await makeRequest('POST', '/api/auth/login', {
        email: 'test@example.com',
        password: 'SecurePassword123!',
      });
      
      expect(loginResponse.status).toBe(200);
      const loginData = await loginResponse.json() as AuthResponse;
      expect(loginData.ok).toBe(true);
      expect(loginData.token).toBeDefined();
      
      // Step 3: Access protected route with token
      const profileResponse = await makeRequest('GET', '/api/profile', undefined, loginData.token);
      expect(profileResponse.status).toBe(200);
      const profileData = await profileResponse.json() as ProfileResponse;
      expect(profileData.ok).toBe(true);
      expect(profileData.profile?.email).toBe('test@example.com');
    });
    
    it('should reject access to protected routes without token', async () => {
      const response = await makeRequest('GET', '/api/profile');
      expect(response.status).toBe(401);
      const data = await response.json() as ApiResponse;
      expect(data.ok).toBe(false);
      expect(data.code).toBe('UNAUTHORIZED');
    });
    
    it('should reject duplicate email registration', async () => {
      // Register first user
      await makeRequest('POST', '/api/auth/register', {
        email: 'duplicate@example.com',
        password: 'SecurePassword123!',
        first_name: 'First',
      });
      
      // Try to register with same email
      const response = await makeRequest('POST', '/api/auth/register', {
        email: 'duplicate@example.com',
        password: 'AnotherPassword123!',
        first_name: 'Second',
      });
      
      expect(response.status).toBe(409);
      const data = await response.json() as ApiResponse;
      expect(data.ok).toBe(false);
      expect(data.code).toBe('EMAIL_EXISTS');
    });
  });
  
  describe('Profile Workflow', () => {
    let authToken: string;
    let userId: string;
    
    beforeEach(async () => {
      // Register and login to get token
      const registerResponse = await makeRequest('POST', '/api/auth/register', {
        email: 'profile@example.com',
        password: 'SecurePassword123!',
        first_name: 'Profile',
        last_name: 'User',
      });
      const registerData = await registerResponse.json() as AuthResponse;
      authToken = registerData.token!;
      userId = registerData.user!.id;
    });
    
    it('should get profile after login', async () => {
      const response = await makeRequest('GET', '/api/profile', undefined, authToken);
      expect(response.status).toBe(200);
      const data = await response.json() as ProfileResponse;
      expect(data.ok).toBe(true);
      expect(data.profile?.email).toBe('profile@example.com');
      expect(data.profile?.first_name).toBe('Profile');
      expect(data.profile?.last_name).toBe('User');
    });
    
    it('should update profile fields', async () => {
      const response = await makeRequest('PUT', '/api/profile', {
        first_name: 'Updated',
        last_name: 'Name',
        phone: '+1234567890',
      }, authToken);
      
      expect(response.status).toBe(200);
      const data = await response.json() as ApiResponse;
      expect(data.ok).toBe(true);
    });
    
    it('should search profile by email', async () => {
      const response = await makeRequest(
        'GET', 
        '/api/profile/search?email=profile@example.com', 
        undefined, 
        authToken
      );
      
      expect(response.status).toBe(200);
      const data = await response.json() as ProfileResponse;
      expect(data.ok).toBe(true);
      expect(data.profile?.email).toBe('profile@example.com');
    });
    
    it('should search profile by thumbprint', async () => {
      // First update profile with a public_key containing thumbprint
      // Note: The search uses LIKE '%"thumbprint": "value"%' pattern with space after colon
      const profiles = mockDb.getStorage('profiles');
      const profile = profiles.find(p => p.id === userId);
      if (profile) {
        profile.public_key = '{"thumbprint": "abc123xyz"}';
      }
      
      const response = await makeRequest(
        'GET',
        '/api/profile/search?thumbprint=abc123xyz',
        undefined,
        authToken
      );
      
      expect(response.status).toBe(200);
      const data = await response.json() as ProfileResponse;
      expect(data.ok).toBe(true);
    });
  });
  
  describe('Wallet Workflow', () => {
    let authToken: string;
    
    beforeEach(async () => {
      const registerResponse = await makeRequest('POST', '/api/auth/register', {
        email: 'wallet@example.com',
        password: 'SecurePassword123!',
        first_name: 'Wallet',
      });
      const registerData = await registerResponse.json() as AuthResponse;
      authToken = registerData.token!;
    });
    
    it('should save wallet after registration', async () => {
      const publicKey = JSON.stringify({
        kty: 'EC',
        crv: 'P-256',
        x: 'test-x-coordinate',
        y: 'test-y-coordinate',
      });
      
      const response = await makeRequest('POST', '/api/wallet', {
        public_key: publicKey,
        encrypted_private_key: JSON.stringify({ ciphertext: 'encrypted-data' }),
        verified: false,
      }, authToken);
      
      expect(response.status).toBe(200);
      const data = await response.json() as ApiResponse;
      expect(data.ok).toBe(true);
    });
    
    it('should verify wallet ownership', async () => {
      // Generate ECDSA key pair for testing
      const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify']
      ) as CryptoKeyPair;
      
      const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
      const challenge = 'test-challenge-string';
      
      // Sign the challenge
      const encoder = new TextEncoder();
      const signatureBuffer = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        keyPair.privateKey,
        encoder.encode(challenge)
      );
      const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
      
      const response = await makeRequest('POST', '/api/wallet/verify-wallet', {
        public_key: publicKeyJwk,
        challenge,
        signature,
      }, authToken);
      
      expect(response.status).toBe(200);
      const data = await response.json() as ApiResponse;
      expect(data.ok).toBe(true);
    });
    
    it('should get wallet data', async () => {
      const response = await makeRequest('GET', '/api/wallet', undefined, authToken);
      expect(response.status).toBe(200);
      const data = await response.json() as WalletResponse;
      expect(data.ok).toBe(true);
      expect(data.wallet).toBeDefined();
    });
  });
  
  describe('Transaction Workflow', () => {
    let authToken: string;
    
    beforeEach(async () => {
      const registerResponse = await makeRequest('POST', '/api/auth/register', {
        email: 'blocks@example.com',
        password: 'SecurePassword123!',
        first_name: 'Blocks',
      });
      const registerData = await registerResponse.json() as AuthResponse;
      authToken = registerData.token!;
    });
    
    it('should create a block with public_summary', async () => {
      const blockData = JSON.stringify({
        public_summary: {
          from: 'sender-address',
          to: 'receiver-address',
          amount: '100',
          currency: 'ETH',
        },
      });
      
      const response = await makeRequest('POST', '/api/blocks', {
        data: blockData,
      }, authToken);
      
      expect(response.status).toBe(201);
      const data = await response.json() as BlockResponse;
      expect(data.ok).toBe(true);
      expect(data.block).toBeDefined();
      expect(data.block?.hash).toBeDefined();
      expect(data.block?.hash).toHaveLength(64);
    });
    
    it('should get all user blocks', async () => {
      // Create a few blocks first
      await makeRequest('POST', '/api/blocks', {
        data: JSON.stringify({ tx: 1 }),
      }, authToken);
      
      await makeRequest('POST', '/api/blocks', {
        data: JSON.stringify({ tx: 2 }),
      }, authToken);
      
      const response = await makeRequest('GET', '/api/blocks', undefined, authToken);
      expect(response.status).toBe(200);
      const data = await response.json() as BlockResponse;
      expect(data.ok).toBe(true);
      expect(Array.isArray(data.blocks)).toBe(true);
      expect(data.blocks!.length).toBeGreaterThanOrEqual(2);
    });
    
    it('should get specific block by id', async () => {
      // Create a block
      const createResponse = await makeRequest('POST', '/api/blocks', {
        data: JSON.stringify({ specific: 'block' }),
      }, authToken);
      const createData = await createResponse.json() as BlockResponse;
      const blockId = createData.block!.id;
      
      const response = await makeRequest('GET', `/api/blocks/${blockId}`, undefined, authToken);
      expect(response.status).toBe(200);
      const data = await response.json() as BlockResponse;
      expect(data.ok).toBe(true);
      expect(data.block?.id).toBe(blockId);
    });
    
    it('should chain blocks with previous_hash', async () => {
      // Create first block (genesis)
      const firstResponse = await makeRequest('POST', '/api/blocks', {
        data: JSON.stringify({ sequence: 1 }),
      }, authToken);
      const firstData = await firstResponse.json() as BlockResponse;
      const firstHash = firstData.block!.hash;
      
      // Create second block - should automatically chain
      const secondResponse = await makeRequest('POST', '/api/blocks', {
        data: JSON.stringify({ sequence: 2 }),
      }, authToken);
      const secondData = await secondResponse.json() as BlockResponse;
      
      // The second block should reference the first block's hash
      expect(secondData.block?.previous_hash).toBe(firstHash);
    });
  });
  
  describe('Contact Workflow', () => {
    let authToken: string;
    
    beforeEach(async () => {
      const registerResponse = await makeRequest('POST', '/api/auth/register', {
        email: 'contacts@example.com',
        password: 'SecurePassword123!',
        first_name: 'Contacts',
      });
      const registerData = await registerResponse.json() as AuthResponse;
      authToken = registerData.token!;
    });
    
    it('should create a contact', async () => {
      const response = await makeRequest('POST', '/api/contacts', {
        name: 'John Doe',
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E',
        email: 'john@example.com',
        label: 'Friend',
      }, authToken);
      
      expect(response.status).toBe(201);
      const data = await response.json() as ContactResponse;
      expect(data.ok).toBe(true);
      expect(data.contact).toBeDefined();
      expect(data.contact?.name).toBe('John Doe');
      expect(data.contact?.address).toBe('0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E');
    });
    
    it('should get all contacts', async () => {
      // Create multiple contacts
      await makeRequest('POST', '/api/contacts', {
        name: 'Alice',
        address: '0xAlice',
      }, authToken);
      
      await makeRequest('POST', '/api/contacts', {
        name: 'Bob',
        address: '0xBob',
      }, authToken);
      
      const response = await makeRequest('GET', '/api/contacts', undefined, authToken);
      expect(response.status).toBe(200);
      const data = await response.json() as ContactResponse;
      expect(data.ok).toBe(true);
      expect(Array.isArray(data.contacts)).toBe(true);
      expect(data.contacts!.length).toBeGreaterThanOrEqual(2);
    });
    
    it('should update a contact', async () => {
      // Create a contact first
      const createResponse = await makeRequest('POST', '/api/contacts', {
        name: 'Original Name',
        address: '0xOriginal',
      }, authToken);
      const createData = await createResponse.json() as ContactResponse;
      const contactId = createData.contact!.id;
      
      // Update the contact
      const response = await makeRequest('PUT', `/api/contacts/${contactId}`, {
        name: 'Updated Name',
        email: 'updated@example.com',
      }, authToken);
      
      expect(response.status).toBe(200);
      const data = await response.json() as ContactResponse;
      expect(data.ok).toBe(true);
      expect(data.contact?.name).toBe('Updated Name');
      expect(data.contact?.email).toBe('updated@example.com');
    });
    
    it('should delete a contact', async () => {
      // Create a contact
      const createResponse = await makeRequest('POST', '/api/contacts', {
        name: 'To Delete',
        address: '0xDelete',
      }, authToken);
      const createData = await createResponse.json() as ContactResponse;
      const contactId = createData.contact!.id;
      
      // Delete the contact
      const deleteResponse = await makeRequest('DELETE', `/api/contacts/${contactId}`, undefined, authToken);
      expect(deleteResponse.status).toBe(200);
      const deleteData = await deleteResponse.json() as ApiResponse;
      expect(deleteData.ok).toBe(true);
      
      // Verify it's deleted
      const getResponse = await makeRequest('GET', `/api/contacts/${contactId}`, undefined, authToken);
      expect(getResponse.status).toBe(404);
    });
  });
  
  describe('MFA Workflow', () => {
    let authToken: string;
    let userId: string;
    const userPassword = 'SecurePassword123!';
    
    beforeEach(async () => {
      const registerResponse = await makeRequest('POST', '/api/auth/register', {
        email: 'mfa@example.com',
        password: userPassword,
        first_name: 'MFA',
      });
      const registerData = await registerResponse.json() as AuthResponse;
      authToken = registerData.token!;
      userId = registerData.user!.id;
    });
    
    it('should enable MFA and return secret', async () => {
      const response = await makeRequest('POST', '/api/auth/mfa-enable', undefined, authToken);
      
      expect(response.status).toBe(200);
      const data = await response.json() as MfaEnableResponse;
      expect(data.ok).toBe(true);
      expect(data.secret).toBeDefined();
      expect(data.secret).toHaveLength(16);
      expect(data.otpauthUrl).toBeDefined();
      expect(data.otpauthUrl).toContain('otpauth://totp/');
    });
    
    it('should verify MFA code', async () => {
      // Enable MFA first
      const enableResponse = await makeRequest('POST', '/api/auth/mfa-enable', undefined, authToken);
      const enableData = await enableResponse.json() as MfaEnableResponse;
      const secret = enableData.secret!;
      
      // Generate valid TOTP code
      const code = await generateTOTP(secret);
      
      const response = await makeRequest('POST', '/api/auth/mfa-verify', { code }, authToken);
      
      expect(response.status).toBe(200);
      const data = await response.json() as MfaVerifyResponse;
      expect(data.ok).toBe(true);
      expect(data.backupCodes).toBeDefined();
      expect(data.backupCodes).toHaveLength(10);
    });
    
    it('should require MFA on login after enabled', async () => {
      // Enable and verify MFA
      const enableResponse = await makeRequest('POST', '/api/auth/mfa-enable', undefined, authToken);
      const enableData = await enableResponse.json() as MfaEnableResponse;
      const secret = enableData.secret!;
      
      const code = await generateTOTP(secret);
      await makeRequest('POST', '/api/auth/mfa-verify', { code }, authToken);
      
      // Generate new TOTP for login
      const loginCode = await generateTOTP(secret);
      
      // Login with MFA
      const loginResponse = await makeRequest('POST', '/api/auth/mfa-login', {
        email: 'mfa@example.com',
        password: userPassword,
        mfaCode: loginCode,
      });
      
      expect(loginResponse.status).toBe(200);
      const loginData = await loginResponse.json() as AuthResponse;
      expect(loginData.ok).toBe(true);
      expect(loginData.token).toBeDefined();
    });
    
    it('should disable MFA with password', async () => {
      // Enable and verify MFA first
      const enableResponse = await makeRequest('POST', '/api/auth/mfa-enable', undefined, authToken);
      const enableData = await enableResponse.json() as MfaEnableResponse;
      const secret = enableData.secret!;
      
      const code = await generateTOTP(secret);
      await makeRequest('POST', '/api/auth/mfa-verify', { code }, authToken);
      
      // Disable MFA
      const response = await makeRequest('POST', '/api/auth/mfa-disable', {
        password: userPassword,
      }, authToken);
      
      expect(response.status).toBe(200);
      const data = await response.json() as ApiResponse;
      expect(data.ok).toBe(true);
      
      // Verify MFA is disabled
      const statusResponse = await makeRequest('GET', '/api/auth/mfa-status', undefined, authToken);
      const statusData = await statusResponse.json() as MfaStatusResponse;
      expect(statusData.enabled).toBe(false);
    });
  });
});
