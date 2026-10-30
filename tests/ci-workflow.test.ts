import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');

describe('CI workflow', () => {
  it('runs both typechecks and the test suite on pull requests and pushes to main', () => {
    expect(workflow).toMatch(/pull_request:/);
    expect(workflow).toMatch(/branches:\s*\[main\]/);
    expect(workflow).toContain('npx tsc -p tsconfig.app.json --noEmit');
    expect(workflow).toContain('npm run typecheck:worker');
    expect(workflow).toContain('npm test');
    expect(workflow).toContain('npm ci');
  });
});
