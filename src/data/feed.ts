// Feed v1 (brief §4.10): win cards, reactions only, private by default.

export type WinKind = 'goal' | 'streak' | 'workout' | 'macros' | 'money' | 'manual';
export const REACTIONS = ['🔥', '👏', '💪'] as const;
export const FEED_DAILY_LIMIT = 10;

export interface WinInput { kind: WinKind; title?: string; goal?: string; days?: number; workout?: string; minutes?: number; calories?: number; protein_g?: number; amount_usd?: number; weight_lbs?: number }
/** The card's title and line, with sensitive numbers hidden unless the
 *  person turned them on for this post. Peptides never make a win card. Pure. */
export function winCard(w: WinInput, showNumbers: boolean): { title: string; line: string; data: Record<string, unknown> } {
  const n = <T,>(v: T | undefined) => (showNumbers ? v : undefined);
  switch (w.kind) {
    case 'goal': return { title: `Goal complete: ${w.goal ?? 'a goal'}`, line: 'Finished what I set out to do.', data: { goal: w.goal } };
    case 'streak': return { title: `${w.days ?? 0}-day streak`, line: 'Showing up every day.', data: { days: w.days } };
    case 'workout': return { title: `Workout logged${w.workout ? `: ${w.workout}` : ''}`, line: w.minutes ? `${w.minutes} minutes in.` : 'Got it done.', data: { workout: w.workout, minutes: w.minutes, weight_lbs: n(w.weight_lbs) } };
    case 'macros': return { title: 'Hit my macros today', line: showNumbers && w.protein_g ? `${w.protein_g}g protein${w.calories ? `, ${w.calories.toLocaleString('en-US')} kcal` : ''}.` : 'On target.', data: { calories: n(w.calories), protein_g: n(w.protein_g) } };
    case 'money': return { title: 'Money Move paid off', line: showNumbers && w.amount_usd ? `Made $${w.amount_usd.toLocaleString('en-US')} from this week's move.` : 'Made money from this week\'s move.', data: { amount_usd: n(w.amount_usd) } };
    default: return { title: (w.title ?? 'A win').slice(0, 120), line: '', data: {} };
  }
}
export const STREAK_MILESTONES = [7, 14, 30, 60, 100, 365];
export const isStreakMilestone = (d: number) => STREAK_MILESTONES.includes(d);
export const canPost = (postedLast24h: number) => postedLast24h < FEED_DAILY_LIMIT;

/** "3 people 🔥'd your win": batched, at most once an hour. Pure. */
export function reactionNotice(reactions: { post_id: string; user_id: string; emoji: string; created_at: string }[], lastNoticeAt: string | null, now: Date): { send: boolean; text: string; count: number } {
  if (lastNoticeAt && now.getTime() - Date.parse(lastNoticeAt) < 3600000) return { send: false, text: '', count: 0 };
  const fresh = reactions.filter((r) => !lastNoticeAt || Date.parse(r.created_at) > Date.parse(lastNoticeAt));
  const people = new Set(fresh.map((r) => r.user_id)).size;
  if (!people) return { send: false, text: '', count: 0 };
  const top = [...fresh.reduce((m, r) => m.set(r.emoji, (m.get(r.emoji) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1])[0][0];
  const posts = new Set(fresh.map((r) => r.post_id)).size;
  return { send: true, count: people, text: `${people} ${people === 1 ? 'person' : 'people'} ${top}'d your ${posts === 1 ? 'win' : 'wins'}` };
}
