import type { MarketingPlay } from './useMarketingPlays';

/** Money-adjacent metrics only — the build prompt's own rule: "one metric
 *  per play... must be money-adjacent: calls/bookings/orders, never
 *  impressions/follows." A constrained list instead of free text so the
 *  rule is structural, not just advisory — impressions/reach/follows/
 *  likes are never even offered as a choice. */
export const PRIMARY_METRIC_OPTIONS = [
  'Calls',
  'Bookings / appointments',
  'Orders / sales',
  'Leads / quote requests',
  'Store visits / walk-ins',
] as const;

export interface LaunchOption {
  key: 'cheapest' | 'fastest' | 'ceiling';
  label: string;
  budget: string;
  checkpoint_days: number;
  rationale: string;
}

interface Baseline {
  dailyMin: number;
  dailyMax: number;
  channelName: string;
  /** Extra reasoning specific to this channel's floor — e.g. Meta's own
   *  ~50-conversion learning-phase anchor — appended to every option's
   *  rationale so the number traces back to something real, not a
   *  guess. */
  context?: string;
}

// Keyed by the paid play_keys from marketingPlaysEngine.ts's CATALOGS.
// Each floor/ceiling is the channel's own typical range, not one
// universal number applied everywhere — Meta's floor is anchored to
// "needs roughly 50 conversions to leave learning phase," LinkedIn's is
// anchored to its own high CPCs, and so on.
const PAID_BASELINES: Record<string, Baseline> = {
  local_search_ads: { dailyMin: 15, dailyMax: 25, channelName: 'Local Search ads' },
  google_search_ads: { dailyMin: 20, dailyMax: 40, channelName: 'Google Search ads' },
  meta_prospecting: {
    dailyMin: 25, dailyMax: 40, channelName: 'Meta prospecting ads',
    context: 'Meta needs roughly 50 conversions total to leave learning phase and actually optimize — that sets this floor, not an arbitrary daily number.',
  },
  google_shopping_search: { dailyMin: 15, dailyMax: 30, channelName: 'Google Shopping / Search' },
  search_ads_intent: { dailyMin: 20, dailyMax: 40, channelName: 'Search ads' },
  linkedin_search_ads: {
    dailyMin: 40, dailyMax: 80, channelName: 'LinkedIn + Search ads',
    context: 'LinkedIn CPCs run high — this floor reflects that, not a discount version of a consumer platform\'s numbers.',
  },
};

/** Generates 2-3 launch options with different risk shapes — "cheapest
 *  test / fastest signal / highest ceiling," per the build prompt.
 *  Deterministic and keyed off the play's own channel, not generated
 *  fresh each time, so the same play always gets the same honest
 *  framing. Offline plays don't have a daily-spend shape at all, so they
 *  get a single "commit" option instead of forcing three budget tiers
 *  onto something that isn't ad spend. */
export function generateLaunchOptions(play: MarketingPlay): LaunchOption[] {
  if (play.category === 'offline') {
    return [{
      key: 'cheapest',
      label: 'Commit',
      budget: play.cost_estimate || 'Time/relationship cost — no ad spend',
      checkpoint_days: 14,
      rationale: 'Offline plays run on relationship-building time, not daily ad spend — one committed push, checked in two weeks since B2B/offline cycles run longer than a paid channel\'s.',
    }];
  }

  const baseline = PAID_BASELINES[play.play_key];
  if (!baseline) {
    return [{
      key: 'cheapest',
      label: 'Start small',
      budget: play.cost_estimate || 'Set a real number before launching',
      checkpoint_days: 7,
      rationale: 'No baseline on file for this exact channel — start at the low end of whatever the slate estimated and treat week one as the real test.',
    }];
  }

  const suffix = baseline.context ? ` ${baseline.context}` : '';
  const mid = Math.round((baseline.dailyMin + baseline.dailyMax) / 2);
  return [
    {
      key: 'cheapest',
      label: 'Cheapest test',
      budget: `$${baseline.dailyMin}/day`,
      checkpoint_days: 7,
      rationale: `The floor for a readable signal on ${baseline.channelName} — a week at this level either shows something or it doesn't, without much on the table.${suffix}`,
    },
    {
      key: 'fastest',
      label: 'Fastest signal',
      budget: `$${mid}/day`,
      checkpoint_days: 5,
      rationale: `Splits the difference to get a read in less time — costs more per day, but the checkpoint comes two days sooner.${suffix}`,
    },
    {
      key: 'ceiling',
      label: 'Highest ceiling',
      budget: `$${baseline.dailyMax}/day`,
      checkpoint_days: 7,
      rationale: `${baseline.channelName} at its upper range — only worth starting here if there's already some reason to believe in this channel; otherwise start cheaper and raise it weekly, not monthly.${suffix}`,
    },
  ];
}

/** Checkpoint date default for a chosen option — today + checkpoint_days,
 *  as an ISO date string (yyyy-mm-dd) for a native date input. Just a
 *  starting suggestion; the operator can move it. */
export function suggestedCheckpointDate(checkpointDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + checkpointDays);
  return d.toISOString().slice(0, 10);
}

export function isLaunchComplete(play: Pick<MarketingPlay, 'primary_metric' | 'kill_threshold' | 'checkpoint_date' | 'expected_result'>): boolean {
  return !!(play.primary_metric && play.kill_threshold && play.checkpoint_date && play.expected_result);
}
