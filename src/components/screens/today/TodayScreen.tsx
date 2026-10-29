import { useState } from 'react';
import Card from '../../mm/Card';
import Stat from '../../mm/Stat';
import Chip from '../../mm/Chip';
import { Page, useModule } from '../../mm/Page';
import { useToday } from '../../../data/useToday';
import type { TodayApproval } from '../../../data/useToday';
import { useCallsToday } from '../../../data/useCallsToday';
import { useDailyCallGoal } from '../../../data/useDailyCallGoal';
import { decideApproval } from '../../../data/useEngine';
import { useTravelMode } from '../../../data/useTravelMode';
import TravelToday from './TravelToday';
import { YourLineCard } from '../../mm/TopTasks';
import { ageOf } from '../../../data/todayMath';

const usd = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const PORTAL_OF: Record<string, string> = { ecom: 'E-commerce', ecommerce: 'E-commerce', content: 'Content', marketing: 'Made by', madeby: 'Made by', master: 'HQ' };
const SCREEN_OF: Record<string, string> = { ecom: 'ecom-products', ecommerce: 'ecom-products', content: 'content-plan', marketing: 'hq', madeby: 'hq', master: 'hq' };

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

/** Today: the one screen that says what to do right now to make money.
 *  Problems first, then the calling hour, what's waiting on Marq (approve in
 *  one tap), what to post, and money in vs AI spend this week. Nothing else. */
export default function TodayScreen() {
  const { device, nav, isOwner } = useModule();
  const phone = device === 'phone';
  const t = useToday();
  const travel = useTravelMode();
  const { callsToday } = useCallsToday();
  const goal = useDailyCallGoal();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Record<string, string>>({});
  const callsLeft = Math.max(0, goal - callsToday);
  const pct = goal ? Math.min(100, Math.round((callsToday / goal) * 100)) : 0;

  const decide = async (a: TodayApproval, status: 'approved' | 'sent_back') => {
    setBusy(a.id);
    const r = await decideApproval(a.id, status, status === 'sent_back' ? 'Sent back from Today.' : null);
    setBusy(null);
    if (r.error || r.ok === false) { setMsg((m) => ({ ...m, [a.id]: r.error ?? 'Could not save. Open it to decide.' })); return; }
    await t.reload();
  };

  const grid = (cols: number) => ({ display: 'grid', gridTemplateColumns: phone ? '1fr 1fr' : `repeat(${cols},minmax(0,1fr))`, gap: 12 });

  return (
    travel ? (
      <Page title={`${greeting()}, Marq`} sub="Travel mode: calls, products, invoices, training. Nothing else." back="Home" backTo="home">
        <TravelToday />
      </Page>
    ) : (
    <Page title={`${greeting()}, Marq`} sub="Here's what makes money today. Everything else can wait." back="Home" backTo="home">
      <YourLineCard nav={nav} owner={isOwner} />
      {t.flags.length > 0 && (
        <Card title="Fix first" meta={`${t.flags.length} problem${t.flags.length === 1 ? '' : 's'}`} action={<button className="mm-btn" style={{ height: 32 }} onClick={() => nav('hq')}>Open HQ</button>}>
          {t.flags.map((f) => (
            <div key={f.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 14 }}>
              <Chip k="bad">{PORTAL_OF[f.domain] ?? f.domain}</Chip>
              <span style={{ flex: 1, minWidth: 0 }}>{f.message.split('\n')[0]}</span>
            </div>
          ))}
        </Card>
      )}

      <div style={grid(4)}>
        <Stat hero label="Money in · this week" value={t.board ? usd(t.board.totalIn) : '…'} pill={t.board ? `${usd(t.board.totalSpend)} AI spend` : undefined} k={t.board && t.board.net > 0 ? 'good' : 'neutral'} />
        <Stat label="Calls today" value={`${callsToday} / ${goal}`} pill={callsLeft ? `${callsLeft} to go` : 'Goal hit'} k={callsLeft ? 'warn' : 'good'} onClick={() => nav('leadflow')} />
        <Stat label="Waiting on you" value={String(t.approvals.length)} pill="Approvals" k={t.approvals.length ? 'warn' : 'neutral'} />
        <Stat label="Posts due today" value={String(t.posts.length)} pill="Content" k={t.posts.length ? 'warn' : 'neutral'} onClick={() => nav('content-plan')} />
      </div>

      {t.overnight.places > 0 && (
        <Card title="Found overnight" meta="Client Finder" action={<button className="mm-btn mm-btn--primary" style={{ height: 36 }} onClick={() => nav('lead-engines')}>See them</button>}>
          <span style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text)' }}>{t.overnight.places} business{t.overnight.places === 1 ? '' : 'es'}</strong> with website problems: {t.overnight.noSite} with no website at all, {t.overnight.places - t.overnight.noSite} with a broken or weak one. Ranked best first, ready to call.
          </span>
        </Card>
      )}
      <Card title="Calling hour" meta={`${pct}% of today's goal`} action={<button className="mm-btn mm-btn--primary" style={{ height: 36 }} onClick={() => nav('leadflow')}>{callsToday ? 'Keep calling' : 'Start calling'}</button>}>
        <div style={{ height: 8, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: callsLeft ? 'var(--accent)' : 'var(--success)' }} />
        </div>
        <span style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{callsLeft ? `${callsLeft} calls left. Lead pool first, newest A-tier at the top.` : 'Goal hit. Anything more is a bonus.'}</span>
      </Card>

      <Card title="Waiting on you" meta={t.approvals.length ? `${t.approvals.length}, money first` : 'Nothing'} flush>
        {t.loading ? <div style={{ padding: '6px 0 14px', color: 'var(--text-tertiary)' }}>Loading…</div>
          : t.approvals.length === 0 ? <div style={{ padding: '6px 0 14px', fontSize: 14, color: 'var(--text-tertiary)' }}>Nothing waiting. The bots queue anything with money or a public face here first.</div>
          : t.approvals.slice(0, 8).map((a) => (
            <div key={a.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => nav(SCREEN_OF[a.domain] ?? 'hq')} style={{ flex: '1 1 200px', minWidth: 0, textAlign: 'left', background: 'none', border: 0, padding: 0, color: 'var(--text)', fontFamily: 'inherit', fontSize: 14.5, cursor: 'pointer' }}>
                <span style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>{a.title}</span>
                <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{PORTAL_OF[a.domain] ?? a.domain} · waiting {ageOf(a.created_at)}{a.is_money ? ` · money${a.amount_usd != null ? ` ${usd(Number(a.amount_usd))}` : ''}` : ''}</span>
                {msg[a.id] && <span style={{ display: 'block', fontSize: 12.5, color: 'var(--danger)' }}>{msg[a.id]}</span>}
              </button>
              <button className="mm-btn" style={{ height: 34 }} disabled={busy === a.id} onClick={() => void decide(a, 'sent_back')}>Send back</button>
              <button className="mm-btn mm-btn--primary" style={{ height: 34 }} disabled={busy === a.id} onClick={() => void decide(a, 'approved')}>{busy === a.id ? 'Saving…' : 'Approve'}</button>
            </div>
          ))}
        {t.approvals.length > 8 && <button className="mm-btn" style={{ margin: '4px 0 14px', height: 36 }} onClick={() => nav('hq')}>See all {t.approvals.length}</button>}
      </Card>

      <Card title="Post today" meta={t.posts.length ? `${t.posts.length} planned` : 'Nothing planned'} action={<button className="mm-btn" style={{ height: 32 }} onClick={() => nav('content-plan')}>Plan</button>}>
        {t.posts.length === 0 ? <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>No posts planned for today. Open Plan or Ideas to line one up.</span>
          : t.posts.map((p) => (
            <div key={p.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 14 }}>
              <span style={{ width: 52, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{p.scheduled_time?.slice(0, 5) ?? 'Any'}</span>
              <span style={{ flex: 1, minWidth: 0 }}>{p.concept || p.caption || 'Untitled post'}</span>
              {p.format && <Chip k="neutral">{p.format}</Chip>}
            </div>
          ))}
      </Card>

      {t.board && (
        <Card title="Money this week" meta={`Net ${usd(t.board.net)}`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) repeat(3,minmax(0,1fr))', gap: '8px 10px', fontSize: 14 }}>
            {['', 'In', 'AI spend', 'Net'].map((h) => <span key={h} style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: h ? 'right' : 'left' }}>{h}</span>)}
            {t.board.rows.filter((r) => r.moneyIn || r.aiSpend).map((r) => [
              <span key={`${r.portal}-n`}>{r.portal}</span>,
              <span key={`${r.portal}-i`} style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{usd(r.moneyIn)}</span>,
              <span key={`${r.portal}-s`} style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{usd(r.aiSpend)}</span>,
              <span key={`${r.portal}-t`} style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: r.net < 0 ? 'var(--danger)' : 'var(--text)' }}>{usd(r.net)}</span>,
            ])}
          </div>
          {!t.board.rows.some((r) => r.moneyIn || r.aiSpend) && <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>No money in or AI spend yet this week.</span>}
          <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>In: Shopify orders, paid client invoices and income you log in Ledger. Spend: AI only.</span>
        </Card>
      )}
    </Page>
    )
  );
}
