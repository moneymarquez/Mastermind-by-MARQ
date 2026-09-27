import { defineConfig } from 'vitest/config';

// Unit tests for the pure logic and the Worker handlers (fetch is mocked
// in-test). `npm test` runs them; CI arrives in Phase 2.
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
