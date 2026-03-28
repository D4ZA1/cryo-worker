import type { D1Database, D1PreparedStatement, D1Result, D1ExecResult } from '@cloudflare/workers-types';

/**
 * Mock D1 Database for testing
 * Note: We use 'as unknown as D1Database' pattern because the mock doesn't need 
 * to implement all D1Database methods exactly - just the ones used in tests.
 */
export class MockD1Database {
  private mocks: Map<string, { results: any[]; error?: Error }> = new Map();
  private preparedStatements: Map<string, { bind: (...args: any[]) => MockPreparedStatement }> = new Map();
  
  prepare(query: string): MockPreparedStatement {
    const stmt = new MockPreparedStatement(query, this.mocks);
    this.preparedStatements.set(query, { bind: (...args: any[]) => stmt });
    return stmt;
  }

  // Method to set mock results for queries
  mockQuery(query: string, results: any[]): void {
    this.mocks.set(query, { results });
  }

  // Method to set mock error for queries
  mockQueryError(query: string, error: Error): void {
    this.mocks.set(query, { results: [], error });
  }

  // Required D1Database methods (for type compatibility)
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    return Promise.resolve([]);
  }

  exec(query: string): Promise<D1ExecResult> {
    return Promise.resolve({ count: 0, duration: 0 });
  }

  withSession(constraintOrBookmark: string | ArrayBuffer): D1Database {
    return this as unknown as D1Database;
  }

  // Unused methods - not implemented for mock
  bind(...args: any): any { return this; }
  run(...args: any): any { return { success: true as const }; }
  first(...args: any): any { return null; }
  all(...args: any): any { return { results: [] }; }
  raw(...args: any): any { return []; }
  dump(...args: any): any { return Promise.resolve(); }
}

/**
 * Mock Prepared Statement for D1
 */
export class MockPreparedStatement {
  constructor(
    private query: string,
    private mocks: Map<string, { results: any[]; error?: Error }>
  ) {}

  bind(...args: any): MockPreparedStatement {
    return this;
  }

  async run<T = unknown>(): Promise<{ success: true; meta: any; results: T[] }> {
    const mock = this.mocks.get(this.query);
    if (mock?.error) {
      throw mock.error;
    }
    return { success: true as const, meta: {}, results: [] };
  }

  async first<T = any>(): Promise<T | null> {
    const mock = this.mocks.get(this.query);
    if (mock?.error) {
      throw mock.error;
    }
    return mock?.results?.[0] ?? null;
  }

  async all<T = any>(): Promise<{ results: T[]; success: true; meta: any }> {
    const mock = this.mocks.get(this.query);
    if (mock?.error) {
      throw mock.error;
    }
    return { results: mock?.results ?? [], success: true as const, meta: {} };
  }

  async raw<T = any>(): Promise<T[]> {
    const mock = this.mocks.get(this.query);
    if (mock?.error) {
      throw mock.error;
    }
    return mock?.results ?? [];
  }
}

/**
 * Create mock environment bindings
 */
export function createMockEnv(overrides?: Partial<{
  JWT_SECRET: string;
  DATABASE: D1Database;
  [key: string]: any;
}>): {
  JWT_SECRET: string;
  DATABASE: D1Database;
} {
  return {
    JWT_SECRET: 'test-jwt-secret-key-for-testing-purposes-only',
    DATABASE: new MockD1Database(),
    ...overrides,
  };
}

/**
 * Create a mock JWT token for testing
 */
export async function createMockJwt(payload: object, secret: string, expiresInSeconds: number = 3600): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + expiresInSeconds;
  const claim = btoa(JSON.stringify({ ...payload, iat, exp }));
  
  // Create signature using WebCrypto
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(header + '.' + claim));
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig)));
  
  return header + '.' + claim + '.' + signature;
}

/**
 * Create mock context for Hono
 */
export function createMockContext(overrides?: {
  env?: any;
  userId?: string;
  headers?: Record<string, string>;
  body?: any;
}): {
  req: {
    json: () => Promise<any>;
    header: (name: string) => string | undefined;
    query: (name: string) => string | undefined;
  };
  json: (data: any, status?: number) => Response;
  set: (key: string, value: any) => void;
  get: (key: string) => any;
  env: any;
} {
  const env = overrides?.env ?? createMockEnv();
  const userId = overrides?.userId ?? 'test-user-id';
  
  return {
    req: {
      json: async () => overrides?.body ?? {},
      header: (name: string) => {
        if (name === 'Authorization' && overrides?.headers?.['Authorization']) {
          return overrides.headers['Authorization'];
        }
        if (name === 'Cookie' && overrides?.headers?.['Cookie']) {
          return overrides.headers['Cookie'];
        }
        return undefined;
      },
      query: () => '',
    },
    json: (data: any, _status?: number) => {
      return new Response(JSON.stringify(data), {
        status: _status ?? 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
    set: () => {},
    get: (key: string) => {
      if (key === 'userId') return userId;
      return undefined;
    },
    env,
  };
}

/**
 * Wait helper for async tests
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}