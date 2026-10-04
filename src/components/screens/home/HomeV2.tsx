import { useEffect, useMemo, useState } from 'react';
import { readPins } from '../../../data/homePins';
import type { CSSProperties, ReactNode } from 'react';
import '../../shell/shell.css';
import type { Device } from '../../shell/Shell';
import { glyphFor } from '../../shell/nav';
import Card from '../../mm/Card';
import Stat from '../../mm/Stat';
import Chip from '../../mm/Chip';
import type { ChipKind } from '../../mm/Chip';
import { Pill } from '../../mm/Stat';
import { useBudgeting } from '../../../data/useBudgeting';
import { useCallsToday } from '../../../data/useCallsToday';
import { useDailyCallGoal } from '../../../data/useDailyCallGoal';
import { useDailyPlan } from '../../../data/useDailyPlan';
import { useReminders } from '../../../data/useReminders';
import { useSobriety } from '../../../data/useSobriety';
import { useGoals } from '../../../data/useGoals';
import type { FeedLead } from '../../../data/useLeadFeed';
import { waitingMin, temperature, fmtAgo, fmtWait, URGENT_WAIT_MIN } from '../../../data/useLeadFeed';
import type { InboxItem } from '../../../data/useOwnerInbox';
import { monthBudget, sparkPaths, goalOnPace, money, splitMoney } from '../../../data/homeMath';
import { dateStr, timeToMinutes } from '../../../data/time';
import { supabase } from '../../../lib/supabase';
import { api } from '../../../lib/api';

/** Home (design handoff: Home). Phone: greeting → Left to spend → New
 *  leads → Needs attention → Daily brief → Pinned. Wide: hero + 2×2 stats,
 *  New leads 3 across, Needs attention | Today | Daily brief, Pinned 4
 *  across. Every figure is real; anything with no data says so. */
export interface HomeV2Props {
  device: Device; isOwner: boolean; novaOpen: boolean;
  leads: FeedLead[]; leadsNow: number; inboxItems: InboxItem[];
  canOpen: (screen: string) => boolean; labelFor: (screen: string) => string;
  onNavigate: (screen: string) => void; onOpenLead: (id: string) => void;
  top?: ReactNode;
  /** Masterminds only: one summary card per other accessible portal. */
  portalCards?: ReactNode;
}

const TEMP_K: Record<string, ChipKind> = { hot: 'hot', warm: 'warm', cold: 'cold' };
const greet = (h: number) => (h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening');
/** Counts up from 0 to n once on mount (and on change). Respects reduced motion. */
function useCountUp(n: number, ms = 750): number {
  const [v, setV] = useState(n);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setV(n); return; }
    let raf = 0; const t0 = performance.now();
    const tick = (t: number) => { const k = Math.min(1, (t - t0) / ms); setV(n * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [n, ms]);
  return v;
}
const MILESTONES = [1, 3, 7, 14, 30, 60, 90, 180, 365, 730];
const PIN_TINT = ['var(--accent)', 'var(--cat-2)', 'var(--cat-3)', 'var(--success)'];

/** "Your day": three live rings (calls, plan, streak) on a slow aurora. */
function DayCard({ phone, calls, goal, done, total, streak, onOpen }: { phone: boolean; calls: number; goal: number; done: number; total: number; streak: number; onOpen: (s: string) => void }) {
  const next = MILESTONES.find((m) => m > streak) ?? streak + 100;
  const rows = [
    { k: 'dialing', l: 'Calls', v: calls, of: goal, sub: calls >= goal ? 'Goal hit' : `${Math.max(0, goal - calls)} to go`, c: 'var(--cat-1)' },
    { k: 'daily-plan', l: 'Plan', v: done, of: total, sub: total ? (done === total ? 'All done' : `${total - done} left today`) : 'No plan yet', c: 'var(--cat-2)' },
    { k: 'sobriety', l: 'Streak', v: streak, of: next, sub: `${next - streak} to ${next} days`, c: 'var(--cat-3)' },
  ];
  const S = phone ? 116 : 132, sw = phone ? 11 : 12;
  const cv = useCountUp(calls), dv = useCountUp(done), sv = useCountUp(streak);
  const shown = [cv, dv, sv];
  const pct = Math.round((rows.reduce((a, r) => a + (r.of ? Math.min(1, r.v / r.of) : 0), 0) / 3) * 100);
  return (
    <section style={{ position: 'relative', overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: phone ? 18 : 20, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: 'var(--card-shadow)' }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', width: '70%', height: '140%', left: '-20%', top: '-60%', borderRadius: '50%', background: 'radial-gradient(closest-side, color-mix(in srgb, var(--accent) 22%, transparent), transparent)', animation: 'mmAurora 14s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', width: '60%', height: '120%', right: '-18%', bottom: '-70%', borderRadius: '50%', background: 'radial-gradient(closest-side, color-mix(in srgb, var(--cat-3) 16%, transparent), transparent)', animation: 'mmAurora 18s ease-in-out infinite reverse' }} />
      </div>
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em' }}>Your day</span>
        <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-tertiary)' }}>{pct}% of today's targets</span>
      </div>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: phone ? 18 : 24 }}>
        <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} style={{ flex: 'none', transform: 'rotate(-90deg)' }} role="img" aria-label={rows.map((r) => `${r.l} ${r.v} of ${r.of}`).join(', ')}>
          {rows.map((r, i) => {
            const rad = S / 2 - sw / 2 - i * (sw + 4), C = 2 * Math.PI * rad, f = r.of ? Math.min(1, r.v / r.of) : 0;
            return (
              <g key={r.k}>
                <circle cx={S / 2} cy={S / 2} r={rad} fill="none" stroke={`color-mix(in srgb, ${r.c} 16%, transparent)`} strokeWidth={sw} />
                {f > 0 && <circle cx={S / 2} cy={S / 2} r={rad} fill="none" stroke={r.c} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${(f * C).toFixed(1)} ${C.toFixed(1)}`} style={{ '--len': `${(f * C).toFixed(1)}`, animation: `mmRingIn 1s cubic-bezier(.22,1,.36,1) ${i * 0.12}s both`, strokeDashoffset: 0 } as CSSProperties} />}
              </g>
            );
          })}
        </svg>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: phone ? 10 : 12 }}>
          {rows.map((r, i) => (
            <button key={r.k} onClick={() => onOpen(r.k)} style={{ display: 'flex', flexDirection: 'column', gap: 2, border: 0, background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.c, flex: 'none', alignSelf: 'center' }} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{r.l}</span>
                <span style={{ color: 'var(--text)', fontSize: phone ? 17 : 19, fontWeight: 600, letterSpacing: '-0.03em' }}>{Math.round(shown[i])}<span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: 0 }}> / {r.of}</span></span>
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-tertiary)', paddingLeft: 14 }}>{r.sub}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
const initials = (s: string) => s.split(/[\s.@]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '··';

export default function HomeV2(p: HomeV2Props) {
  const phone = p.device === 'phone', desk = p.device === 'desktop';
  const now = new Date();
  const budget = useBudgeting();
  const { callsToday } = useCallsToday();
  const callGoal = useDailyCallGoal();
  const { plan } = useDailyPlan();
  const { reminders, markDone } = useReminders();
  const sob = useSobriety();
  const goals = useGoals();
  const [ai, setAi] = useState<boolean | null>(null);
  const [brief, setBrief] = useState<string | null>(null);
  useEffect(() => {
    api<{ anthropic?: boolean }>('/api/engine/status').then((r) => setAi(r.error ? null : !!r.anthropic));
    supabase.from('ai_daily_summaries').select('summary_text,date').eq('domain', 'orchestrator').order('date', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { const d = data as { summary_text?: string; date?: string } | null; if (d?.summary_text && d.date === dateStr(new Date())) setBrief(d.summary_text); });
  }, []);

  const totalBudget = budget.categories.reduce((s, c) => s + Number(c.monthly_amount || 0), 0);
  const mb = useMemo(() => monthBudget(totalBudget, budget.transactions, now), [totalBudget, budget.transactions]); // eslint-disable-line react-hooks/exhaustive-deps
  const active = goals.activeGoals ?? [];
  const onPace = active.filter((g) => goalOnPace(g, now)).length;
  const tickets = p.inboxItems.filter((i) => i.kind === 'ticket');
  const ticketsWaiting = tickets.filter((t) => t.unread).length;
  const freshLeads = p.leads.filter((l) => waitingMin(l, p.leadsNow) != null || p.leadsNow - new Date(l.at).getTime() < 86400000).slice(0, 3);
  const leadsWaiting = p.leads.filter((l) => waitingMin(l, p.leadsNow) != null).length;

  // ── Needs attention: bills due / overdue, reminders, budget pace ────
  const today = dateStr(now);
  const attention: { key: string; name: string; tag: string; chip: string; k: ChipKind; amt?: string; act?: () => void; actLabel?: string; open?: () => void }[] = [];
  for (const r of budget.recurring.filter((x) => x.active && x.type === 'expense' && x.next_occurrence && x.next_occurrence <= dateStr(new Date(now.getTime() + 7 * 86400000))).sort((a, b) => a.next_occurrence.localeCompare(b.next_occurrence))) {
    const days = Math.round((new Date(`${r.next_occurrence}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000);
    attention.push({ key: `bill-${r.id}`, name: r.name, tag: 'Bill', chip: days < 0 ? `${-days} day${days === -1 ? '' : 's'} overdue` : days === 0 ? 'Due today' : `Due ${new Date(`${r.next_occurrence}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`, k: days < 0 ? 'bad' : 'warn', amt: money(Number(r.amount)), open: () => p.onNavigate('budgeting') });
  }
  for (const r of reminders.filter((x) => x.due_date <= today)) {
    attention.push({ key: `rem-${r.id}`, name: r.title, tag: 'Reminder', chip: r.due_date < today ? 'Overdue' : r.due_time ? `Today ${r.due_time.slice(0, 5)}` : 'Today', k: r.due_date < today ? 'bad' : 'warn', act: () => void markDone(r.id), actLabel: 'Done' });
  }
  if (totalBudget > 0 && mb.overPace > 1) attention.push({ key: 'pace', name: 'Spending', tag: 'Budget', chip: `Behind pace by ${money(mb.overPace, false)}`, k: 'warn', amt: money(mb.spent), open: () => p.onNavigate('budgeting') });

  // ── Today (Daily Plan) ──────────────────────────────────────────────
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const blocks = (plan?.blocks ?? []).slice().sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  const nextIdx = blocks.findIndex((b) => timeToMinutes(b.time) + (b.duration || 30) > nowMin);
  const todayRows = (nextIdx > 0 ? blocks.slice(Math.max(0, nextIdx - 1)) : blocks).slice(0, 5);
  const fmtTime = (t: string) => { const m = timeToMinutes(t); const h = Math.floor(m / 60), mm = m % 60; return `${h % 12 || 12}:${String(mm).padStart(2, '0')}`; };

  // ── Pinned ──────────────────────────────────────────────────────────
  const pins = readPins().filter(p.canOpen);
  const nextBlock = blocks.find((b) => timeToMinutes(b.time) >= nowMin);
  const pinSub = (id: string) => ({
    budgeting: totalBudget > 0 ? `${money(mb.left, false)} left` : 'Set a budget',
    'daily-plan': nextBlock ? `Next: ${fmtTime(nextBlock.time)} ${nextBlock.title}`.slice(0, 40) : plan ? 'Nothing left today' : 'No plan yet',
    goals: active.length ? `${onPace} of ${active.length} on pace` : 'No goals yet',
    sobriety: sob.loading ? '' : `${sob.streak} day${sob.streak === 1 ? '' : 's'}`,
    dialing: `${callsToday} of ${callGoal} calls`,
  } as Record<string, string>)[id] ?? '';

  // ── Pieces ──────────────────────────────────────────────────────────
  const leftShown = useCountUp(mb.left);
  const { whole, cents } = splitMoney(leftShown);
  const spark = sparkPaths(mb.remainingByDay.length ? mb.remainingByDay : [totalBudget], 322, desk ? 64 : 56);
  const hero = (
    <Card hero wide={!phone} style={{ gap: 12 }}>
      <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-secondary)' }}>Left to spend in {now.toLocaleDateString(undefined, { month: 'long' })}</span>
      {totalBudget > 0 ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', color: 'var(--text)', fontSize: 46, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1 }}>{whole}<span style={{ fontSize: 22, color: 'var(--text-tertiary)', letterSpacing: '-0.02em' }}>{cents}</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Pill k={mb.spentLast7 > 0 ? 'bad' : 'neutral'}>↑ {money(mb.spentLast7, false)} spent</Pill><span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>in the last 7 days</span></div>
          <svg width="100%" height={desk ? 64 : 56} viewBox={`0 0 322 ${desk ? 64 : 56}`} preserveAspectRatio="none" style={{ display: 'block' }} aria-hidden="true"><path d={spark.area} fill="var(--accent-wash)" /><path d={spark.line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /></svg>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 12, borderTop: '1px solid var(--grid)' }}>
            <span style={{ flex: 1, fontSize: 13, color: 'var(--text-tertiary)' }}>{mb.daysLeft} day{mb.daysLeft === 1 ? '' : 's'} left{mb.perDay != null ? ` · about ${money(mb.perDay, false)} a day` : mb.left < 0 ? ' · over budget' : ''}</span>
            <button className="mm-btn" style={{ height: 34 }} onClick={() => p.onNavigate('budgeting')}>Open budget</button>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.5 }}>Set monthly amounts for your categories and this shows what's left to spend, with a daily pace.</span>
          <button className="mm-btn mm-btn--primary" style={{ alignSelf: 'flex-start', height: 40 }} onClick={() => p.onNavigate('budgeting')}>Set up a budget</button>
        </div>
      )}
    </Card>
  );
  const stats = (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: phone ? 10 : 16 }}>
      <Stat label="Calls today" value={callsToday} pill={`goal ${callGoal}`} k={callsToday >= callGoal ? 'good' : 'neutral'} onClick={() => p.onNavigate('dialing')} />
      <Stat label="Clean streak" value={sob.loading ? '—' : `${sob.streak} day${sob.streak === 1 ? '' : 's'}`} onClick={() => p.onNavigate('sobriety')} />
      <Stat label="Goals" value={active.length ? `${onPace} of ${active.length}` : '—'} pill={active.length ? (active.length - onPace ? `${active.length - onPace} behind pace` : 'All on pace') : 'No goals yet'} k={active.length - onPace ? 'warn' : active.length ? 'good' : 'neutral'} onClick={() => p.onNavigate('goals')} />
      {p.isOwner
        ? <Stat label="Open tickets" value={tickets.length} pill={ticketsWaiting ? `${ticketsWaiting} waiting on you` : 'None waiting'} k="neutral" onClick={() => p.onNavigate('inbox')} />
        : <Stat label="Reminders today" value={reminders.filter((r) => r.due_date <= today).length} k="neutral" />}
    </div>
  );
  const leadCard = p.isOwner && (
    <Card wide={!phone} title={<>New leads{leadsWaiting > 0 && <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: p.leads.some((l) => (waitingMin(l, p.leadsNow) ?? 0) >= URGENT_WAIT_MIN) ? 'var(--danger)' : 'var(--accent)', color: 'var(--bg)', fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{leadsWaiting}</span>}{!phone && leadsWaiting > 0 && <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: 0 }}>waiting on you</span>}</>}
      action={p.leads.length ? <button onClick={() => p.onNavigate(phone ? 'inbox' : 'leads')} style={{ border: 0, background: 'transparent', color: 'var(--text)', fontSize: 13.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>See all {p.leads.length}</button> : undefined}>
      {freshLeads.length === 0
        ? <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>No new leads in the last day. Website form, audit form and lead emails show up here.</span>
        : <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: phone ? 0 : 24 }}>
            {freshLeads.map((l, i) => {
              const w = waitingMin(l, p.leadsNow);
              return (
                <button key={l.id} onClick={() => p.onOpenLead(l.id)} style={{ display: 'flex', gap: 10, textAlign: 'left', border: 0, borderTop: phone && i ? '1px solid var(--grid)' : 'none', background: 'transparent', padding: phone ? '12px 0' : 0, cursor: 'pointer', fontFamily: 'inherit', minWidth: 0 }}>
                  <span style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--surface-3)', color: 'var(--text)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{initials(l.name)}</span>
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ display: 'flex', gap: 8 }}><span style={{ flex: 1, color: 'var(--text)', fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span><span style={{ fontSize: 12, color: 'var(--text-tertiary)', flex: 'none' }}>{fmtAgo(l.at, p.leadsNow)}</span></span>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[l.business, l.source].filter(Boolean).join(' · ')}</span>
                    <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}><Chip k={TEMP_K[temperature(l, p.leadsNow)]}>{temperature(l, p.leadsNow).replace(/^\w/, (c) => c.toUpperCase())}</Chip>{w != null && <Chip k={w >= URGENT_WAIT_MIN ? 'bad' : 'warn'}>Waiting {fmtWait(w)}</Chip>}</span>
                  </span>
                </button>
              );
            })}
          </div>}
    </Card>
  );
  const attentionCard = (
    <Card wide={!phone} flush title="Needs attention" meta={attention.length ? `${attention.length} item${attention.length === 1 ? '' : 's'}` : ''}>
      {attention.length === 0 && <span style={{ fontSize: 14, color: 'var(--text-tertiary)', padding: '8px 0 14px' }}>Nothing due. Bills, reminders and budget pace show up here when they need you.</span>}
      {attention.slice(0, 6).map((a, i) => (
        <div key={a.key} onClick={a.open} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: i ? '1px solid var(--grid)' : 'none', cursor: a.open ? 'pointer' : undefined }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}><span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span><span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500 }}>{a.tag}</span></span>
            <span><Chip k={a.k}>{a.chip}</Chip></span>
          </div>
          {a.amt && <span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em' }}>{a.amt}</span>}
          {a.act && <button className="mm-btn" style={{ height: 32 }} onClick={(e) => { e.stopPropagation(); a.act!(); }}>{a.actLabel}</button>}
        </div>
      ))}
    </Card>
  );
  const todayCard = (
    <Card wide={!phone} flush title="Today" meta="From Daily Plan">
      {todayRows.length === 0
        ? <span style={{ fontSize: 14, color: 'var(--text-tertiary)', padding: '8px 0 14px' }}>{plan ? 'Nothing left on today\'s plan.' : 'No plan for today yet.'} <button onClick={() => p.onNavigate('daily-plan')} style={{ border: 0, background: 'transparent', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, padding: 0 }}>Open Daily Plan</button></span>
        : todayRows.map((b, i) => {
          const start = timeToMinutes(b.time), end = start + (b.duration || 30);
          const past = end <= nowMin, nowOn = start <= nowMin && nowMin < end, soon = !past && !nowOn && start - nowMin <= 60;
          return (
            <div key={`${b.time}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: i ? '1px solid var(--grid)' : 'none', opacity: past ? 0.55 : 1 }}>
              <span style={{ width: 42, fontSize: 13, color: 'var(--text-tertiary)', flex: 'none' }}>{fmtTime(b.time)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'var(--text)', fontSize: 14.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</div>
                {b.detail && <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.detail}</div>}
              </div>
              {nowOn && <Chip k="accent">Now</Chip>}
              {soon && <Chip k="warn">In {start - nowMin} min</Chip>}
            </div>
          );
        })}
    </Card>
  );
  const briefCard = (
    <Card wide={!phone} title="Daily brief">
      {brief
        ? <span style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{brief}</span>
        : ai === false
          ? <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}><span><Chip k="neutral">Paused</Chip></span><span style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.5 }}>AI isn't funded on this workspace, so the written brief is paused. Every number on this page still updates live.</span><button className="mm-btn" style={{ alignSelf: 'flex-start' }} onClick={() => p.onNavigate('setup')}>Turn on AI</button></div>
          : <span style={{ fontSize: 15, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>Today's brief isn't written yet — it lands with the 5:30am digest.</span>}
    </Card>
  );
  const pinned = pins.length > 0 && (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em' }}>Pinned</span>
      <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr 1fr' : 'repeat(4, minmax(0, 1fr))', gap: phone ? 10 : 16 }}>
        {pins.map((id, i) => (
          <button key={id} className="mm-tile" onClick={() => p.onNavigate(id)} style={phone ? undefined : { flexDirection: 'row', alignItems: 'center', minHeight: 64, gap: 12, padding: '12px 14px' }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: `color-mix(in srgb, ${PIN_TINT[i % 4]} 16%, var(--surface))`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: PIN_TINT[i % 4], fontSize: 11, fontWeight: 700, flex: 'none' }}>{glyphFor(p.labelFor(id))}</span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600 }}>{p.labelFor(id)}</span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pinSub(id)}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
  const head = (
    <div>
      <h1 style={{ margin: 0, color: 'var(--text)', fontSize: phone ? 24 : 28, fontWeight: 700, letterSpacing: '-0.035em' }}>{greet(now.getHours())}</h1>
      <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>{now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
    </div>
  );
  const dayCard = <DayCard phone={phone} calls={callsToday} goal={callGoal} done={blocks.filter((b) => b.done).length} total={blocks.length} streak={sob.streak} onOpen={p.onNavigate} />;
  const col: CSSProperties = { display: 'flex', flexDirection: 'column', gap: phone ? 20 : 16 };

  if (phone) {
    return (
      <div className="mm-stagger" style={col}>
        {head}{dayCard}{p.portalCards}{p.top}{hero}{stats}{leadCard}{attentionCard}{todayCard}{briefCard}{pinned}
      </div>
    );
  }
  const threeCols = desk && !p.novaOpen;
  const threeColsTop = threeCols;
  return (
    <div className="mm-stagger" style={{ ...col, gap: 20 }}>
      {head}
      <div style={{ display: 'grid', gridTemplateColumns: threeColsTop ? 'minmax(0, 1fr) minmax(0, 1.1fr) minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 1fr)', gap: 16 }}>{dayCard}{hero}{threeColsTop ? stats : null}</div>
      {!threeColsTop && stats}
      {p.portalCards}
      {p.top}
      {leadCard}
      <div style={{ display: 'grid', gridTemplateColumns: threeCols ? 'repeat(3, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))', gap: 16, alignItems: 'start' }}>{attentionCard}{todayCard}{briefCard}</div>
      {pinned}
    </div>
  );
}
