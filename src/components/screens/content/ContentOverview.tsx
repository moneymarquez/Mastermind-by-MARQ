import type { ContentItem, ItemStatus, SocialAccount, SocialPost } from '../../../data/contentEngine';
import { STATUS } from '../../../data/contentEngine';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import type { ChipKind } from '../../mm/Chip';
import Row from '../../mm/Row';
import Stat from '../../mm/Stat';
import { useModule } from '../../mm/Page';

const DAY = 86400000;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const K: Record<ItemStatus, ChipKind> = { idea: 'neutral', script: 'neutral', filmed: 'accent', edited: 'warn', approved: 'accent', posted: 'good' };

/** The Content dashboard (design handoff: MM 5 Scaling, MM Wide). The
 *  design's per-client launch kits map onto what this module tracks: each
 *  account's posts this week against its own weekly goal, what's due in
 *  the next 7 days, and what went out this month. */
export default function ContentOverview({ accounts, items, posts, onOpenPlan }: { accounts: SocialAccount[]; items: ContentItem[]; posts: SocialPost[]; onOpenPlan: () => void }) {
  const { device, novaOpen } = useModule();
  const phone = device === 'phone';
  const now = new Date();
  const weekStart = new Date(now); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const today = ymd(now), in7 = ymd(new Date(now.getTime() + 7 * DAY));
  const postedThisWeek = (id: string) => posts.filter((p) => p.account_id === id && Date.parse(p.posted_at) >= weekStart.getTime()).length;
  const monthPosts = posts.filter((p) => { const d = new Date(p.posted_at); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); });
  const due = items.filter((i) => i.status !== 'posted' && i.scheduled_for && i.scheduled_for >= today && i.scheduled_for <= in7)
    .sort((a, b) => `${a.scheduled_for}${a.scheduled_time ?? ''}`.localeCompare(`${b.scheduled_for}${b.scheduled_time ?? ''}`));
  const overdue = items.filter((i) => i.status !== 'posted' && i.scheduled_for && i.scheduled_for < today).length;
  const open = items.filter((i) => i.status !== 'posted');
  const goal = accounts.reduce((s, a) => s + (a.posts_per_week_goal || 0), 0);
  const weekDone = accounts.reduce((s, a) => s + postedThisWeek(a.id), 0);
  // Days of the week gone, for the pace marker on each account's bar.
  const pace = Math.min(100, Math.round((((now.getDay() + 6) % 7) + 1) / 7 * 100));
  const name = (id: string | null) => { const a = accounts.find((x) => x.id === id); return a ? `@${a.handle}` : 'No account'; };
  const when = (i: ContentItem) => (i.scheduled_for === today ? 'Today' : new Date(`${i.scheduled_for}T12:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));

  const stats = [
    <Stat key="a" label="Accounts" value={String(accounts.length)} pill={`${goal} posts a week goal`} />,
    <Stat key="w" label="Posted this week" value={`${weekDone} of ${goal || '—'}`} pill={goal && weekDone >= goal ? 'Goal met' : goal ? `${Math.max(0, goal - weekDone)} to go` : 'Set a goal'} k={goal && weekDone >= goal ? 'good' : 'neutral'} />,
    <Stat key="d" label="Due this week" value={String(due.length)} pill={overdue ? `${overdue} overdue` : 'Scheduled'} k={overdue ? 'warn' : 'neutral'} />,
    <Stat key="m" label="Posted" value={String(monthPosts.length)} pill="This month" />,
  ];

  const kits = (
    <Card title="This week by account" meta={`${accounts.length}`} wide={!phone}>
      {accounts.length ? accounts.map((a, n) => {
        const done = postedThisWeek(a.id), g = a.posts_per_week_goal || 0;
        const pct = g ? Math.min(100, Math.round((done / g) * 100)) : 0;
        const k: ChipKind = !g ? 'neutral' : pct >= pace ? 'good' : 'warn';
        const mine = open.filter((i) => i.account_id === a.id);
        return (
          <div key={a.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: n ? 14 : 0, borderTop: n ? '1px solid var(--grid)' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>@{a.handle}</span>
              <Chip k={k}>{!g ? 'No goal' : pct >= 100 ? 'Done' : pct >= pace ? 'On track' : 'Behind'}</Chip>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 500, color: 'var(--text-secondary)' }}><span>{done} of {g || '—'} posts</span><span style={{ color: 'var(--text)' }}>{pct}%</span></div>
            <div style={{ position: 'relative', height: 6, borderRadius: 999, background: 'var(--surface-3)' }}>
              <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: 'var(--accent)' }} />
              {g > 0 && <div title="Where you'd be at an even pace" style={{ position: 'absolute', left: `${pace}%`, top: -3, width: 2, height: 12, borderRadius: 1, background: 'var(--text-tertiary)' }} />}
            </div>
            {mine.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(['idea', 'script', 'filmed', 'edited', 'approved'] as ItemStatus[]).map((s) => { const c = mine.filter((i) => i.status === s).length; return c ? <Chip key={s} k={K[s]}>{`${c} ${STATUS[s].label.toLowerCase()}`}</Chip> : null; })}
            </div>}
          </div>
        );
      }) : <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>No accounts yet. Add one to start planning posts.</span>}
    </Card>
  );
  const dueCard = (
    <Card title="Due this week" meta={String(due.length)} flush wide={!phone}>
      {due.length ? <div>{due.slice(0, 6).map((i, n) => <Row key={i.id} first={n === 0} name={i.concept} meta={name(i.account_id)} chip={STATUS[i.status]?.label ?? i.status} k={K[i.status] ?? 'neutral'} amt={when(i)} onClick={onOpenPlan} />)}</div>
        : <div style={{ padding: '10px 0 14px', fontSize: 14, color: 'var(--text-tertiary)' }}>Nothing scheduled in the next 7 days.</div>}
    </Card>
  );

  if (phone) return <><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{stats.slice(1, 3)}</div>{kits}{dueCard}</>;
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>{stats}</div>
      <div style={{ display: 'grid', gridTemplateColumns: device === 'desktop' && !novaOpen ? 'minmax(0,2fr) minmax(0,1fr)' : 'repeat(2,minmax(0,1fr))', gap: 16, alignItems: 'start' }}>{kits}{dueCard}</div>
    </>
  );
}
