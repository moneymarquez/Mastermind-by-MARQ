import type { ContentCheckin } from './useContentGrowth';

export interface PostsStreak {
  /** Posts logged for the current calendar week (Monday-start) — 0 if no
   *  check-in yet this week. This is the headline number, not follower
   *  count — "the operator's actual problem is that he is not posting." */
  thisWeekPosts: number;
  hasCheckinThisWeek: boolean;
  /** Consecutive weeks, ending at the most recent week with any check-in
   *  data, where posts_count was > 0. A missed week (no check-in at all)
   *  breaks the streak, same as a week with zero posts does. */
  streakWeeks: number;
}

/** Monday of the week containing this date, as YYYY-MM-DD — the bucket
 *  key two checkins in the same week collapse into. */
function weekStartKey(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diffToMonday);
  return d.toISOString().slice(0, 10);
}

function subtractWeek(weekKey: string): string {
  const d = new Date(weekKey + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}

/** Computes the growth plan header's headline metric. Sums posts_count
 *  per calendar week (an operator could in principle log more than once
 *  a week) rather than taking the latest single check-in, so a
 *  mid-week correction doesn't silently drop earlier posts logged the
 *  same week. */
export function computePostsStreak(checkins: ContentCheckin[], today: Date = new Date()): PostsStreak {
  const byWeek = new Map<string, number>();
  for (const c of checkins) {
    const wk = weekStartKey(c.checkin_date);
    byWeek.set(wk, (byWeek.get(wk) ?? 0) + (c.posts_count ?? 0));
  }

  const currentWeekKey = weekStartKey(today.toISOString().slice(0, 10));
  const hasCheckinThisWeek = byWeek.has(currentWeekKey);
  const thisWeekPosts = byWeek.get(currentWeekKey) ?? 0;

  const weeks = [...byWeek.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  let streak = 0;
  if (weeks.length > 0) {
    let expected = weeks[0][0];
    for (const [wk, posts] of weeks) {
      if (wk !== expected || posts <= 0) break;
      streak++;
      expected = subtractWeek(expected);
    }
  }

  return { thisWeekPosts, hasCheckinThisWeek, streakWeeks: streak };
}
