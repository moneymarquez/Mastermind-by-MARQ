// DRY_RUN (brief §0): any Worker env with DRY_RUN=1 — every dev/preview
// deploy, and every test — simulates outbound actions (posts, texts, emails,
// store launches, supplier orders) instead of performing them, and says so
// in the record it writes. Production leaves it unset.
export interface DryRunEnv { DRY_RUN?: string }
export const isDryRun = (env: DryRunEnv | undefined | null): boolean => !!env && (env.DRY_RUN === '1' || env.DRY_RUN === 'true');
export const dryRunId = (kind: string) => `dry-run-${kind}-${Date.now().toString(36)}`;
