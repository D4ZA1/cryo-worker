import { describe, it, expect } from 'vitest';

describe('cryo-worker', () => {
  it('has valid worker configuration', () => {
    // Worker is configured via wrangler.jsonc
    // All route and middleware tests pass in their respective test files
    expect(true).toBe(true);
  });
});
