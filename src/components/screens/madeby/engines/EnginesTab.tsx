import { pitchFor } from '../../../../data/madebyServices';
import { useState } from 'react';
import Card from '../../../mm/Card';
import Chip from '../../../mm/Chip';
import { Empty } from '../../../mm/States';
import { api } from '../../../../lib/api';
import ScorePills from '../../../mm/ScorePills';
import { money, type EngineCard, type EnginesState, type FindingGroup } from './types';

const WHAT: Record<EngineCard['engine'], string> = {
  client_finder: 'Finds local businesses with one fixable problem: no website, a broken or outdated one, or no way to book or order. Uses your lead pool first (free) and searches Google only when it runs out.',
  complaint_scanner: 'Reads public complaints (Reddit, review sites, forums) for one industry a day and groups the ones that keep repeating, with quotes, who is fixing it and an easy way in.',
};

function Toggle({ on, disabled, onChange, label }: { on: boolean; disabled?: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      style={{ width: 52, height: 30, borderRadius: 999, border: '1px solid var(--border)', background: on ? 'var(--success)' : 'var(--surface-2)', position: 'relative', cursor: disabled ? 'default' : 'pointer', flex: 'none', padding: 0 }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 25 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', boxShadow: 'var(--g-shadow-1)', transition: 'left .15s' }} />
    </button>
  );
}
const Stat = ({ k, v, sub }: { k: string; v: string; sub?: string }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{k}</span>
    <strong style={{ fontSize: 17, color: 'var(--text)', letterSpacing: '-0.01em' }}>{v}</strong>
    {sub && <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{sub}</span>}
  </div>
);

function EngineCardView({ c, killed, keys, onChange }: { c: EngineCard; killed: boolean; keys: EnginesState['keys']; onChange: (s: EnginesState | null, msg?: string) => void }) {
  const [daily, setDaily] = useState(String(c.dailyBudget));
  const [ceil, setCeil] = useState(String(c.monthlyCeiling));
  const [target, setTarget] = useState(String(c.dailyTarget));
  const [busy, setBusy] = useState('');
  const isFinder = c.engine === 'client_finder';
  const dirty = Number(daily) !== c.dailyBudget || Number(ceil) !== c.monthlyCeiling || (isFinder && Number(target) !== c.dailyTarget);
  const preview = Number(daily) > 0 ? `At ${money(Number(daily))}/day ≈ ${money(Number(daily) * 30, Number(daily) * 30 % 1 === 0 ? 0 : 2)}/month` : 'At $0.00/day this engine does nothing';
  const post = async (path: string, body: Record<string, unknown>, key: string) => {
    setBusy(key);
    const r = await api<EnginesState & { summary?: string; state?: EnginesState }>(`/api/engines/${path}`, { body: { engine: c.engine, ...body } });
    setBusy('');
    if (r.error) return onChange(null, r.error);
    onChange(r.state ?? (r.cards ? (r as EnginesState) : null), r.summary);
  };
  const needsKey = isFinder ? !keys.places : !keys.parallel || !keys.claude;
  return (
    <Card title={c.label} meta={c.paused ? 'Paused' : c.enabled ? 'On' : 'Off'} action={<div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Chip k={c.paused ? 'warn' : c.enabled ? 'good' : 'neutral'}>{c.paused ? c.paused.replace('Paused: ', 'Paused · ') : c.enabled ? 'Running nightly' : 'Off'}</Chip><Toggle on={c.enabled} label={`${c.label} on or off`} disabled={busy === 'toggle'} onChange={(v) => void post('toggle', { enabled: v }, 'toggle')} /></div>}>
      <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{WHAT[c.engine]}</p>
      {c.paused && <div style={{ fontSize: 13.5, color: 'var(--warning)', fontWeight: 600 }}>{c.paused}{c.paused.includes('daily') ? ' It starts again tomorrow (Denver time).' : ''}</div>}
      {killed && <div style={{ fontSize: 13, color: 'var(--danger)' }}>The kill switch is on, so nothing runs.</div>}
      {needsKey && <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{isFinder ? 'Add the Google Places key in Setup to search for new businesses. It can still work through leads you already have.' : 'Needs the Parallel and Anthropic keys in Setup.'}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 14 }}>
        <Stat k="Spent today" v={money(c.spentToday)} sub={`of ${money(c.dailyBudget)}`} />
        <Stat k="Spent this month" v={money(c.spentMonth)} sub={`ceiling ${money(c.monthlyCeiling, 0)}`} />
        <Stat k={isFinder ? 'Leads today' : 'Findings today'} v={String(c.foundToday)} sub={isFinder ? `target ${c.dailyTarget}` : `${c.foundMonth} this month`} />
        <Stat k={isFinder ? 'Cost per lead' : 'Cost per finding'} v={c.costPerLead != null ? money(c.costPerLead, 3) : '—'} sub="this month" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isFinder ? 'repeat(3,1fr)' : 'repeat(2,1fr)', gap: 10 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: 'var(--text-secondary)' }}>Daily budget ($)<input inputMode="decimal" value={daily} onChange={(e) => setDaily(e.target.value)} style={inp} /></label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: 'var(--text-secondary)' }}>Monthly ceiling ($)<input inputMode="decimal" value={ceil} onChange={(e) => setCeil(e.target.value)} style={inp} /></label>
        {isFinder && <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: 'var(--text-secondary)' }}>Leads a day<input inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} style={inp} /></label>}
      </div>
      <div style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 500 }}>{preview}</div>
      {c.lastSummary && <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Last run{c.lastRunAt ? ` ${new Date(c.lastRunAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}: {c.lastSummary}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="mm-btn mm-btn--primary" style={{ height: 36 }} disabled={!dirty || busy === 'budget'} onClick={() => void post('budget', { daily_budget_usd: Number(daily), monthly_ceiling_usd: Number(ceil), ...(isFinder ? { daily_target: Number(target) } : {}) }, 'budget')}>Save budget</button>
        <button className="mm-btn" style={{ height: 36 }} disabled={busy === 'run' || killed} onClick={() => void post('run', {}, 'run')}>{busy === 'run' ? 'Running…' : 'Run now'}</button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Every paid call counts against this budget. "Run now" uses the same budget as the night run.</div>
    </Card>
  );
}
const inp: React.CSSProperties = { height: 40, padding: '0 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 16, width: '100%', boxSizing: 'border-box' };

const KIND_LABEL: Record<string, string> = { no_website: 'No website', site_down: 'Site down', no_https: 'Not secure', no_mobile: 'No phone layout', slow_mobile: 'Slow on phones', stale_site: 'Outdated', no_cta: 'No book/call button' };
export function FindingsList({ items, onDraft, drafting }: { items: FindingGroup[]; onDraft: () => void; drafting: boolean }) {
  if (!items.length) return <Empty text="No website-gap leads yet. Switch Client Finder on, or press Run now." />;
  return (
    <Card title="Best leads right now" meta={`${items.length} shown`} action={<button className="mm-btn" style={{ height: 32, fontSize: 13 }} disabled={drafting} onClick={onDraft}>{drafting ? 'Drafting…' : 'Draft emails for the top 10'}</button>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map((f) => (
          <div key={f.lead.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
              <strong style={{ fontSize: 15, minWidth: 0, overflowWrap: 'anywhere' }}>{f.lead.business_name}</strong>
              <Chip k={f.score >= 70 ? 'hot' : f.score >= 50 ? 'warm' : 'neutral'}>{f.score}/100</Chip>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{[f.lead.category, f.lead.city, f.lead.rating ? `${f.lead.rating}★ (${f.lead.review_count ?? 0})` : null, f.lead.phone].filter(Boolean).join(' · ')}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{f.gaps.map((g) => <Chip key={g.kind} k={g.kind === 'no_website' ? 'bad' : 'warn'}>{KIND_LABEL[g.kind] ?? g.kind}</Chip>)}</div>
            <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{f.gaps[0]?.text}</div>
            <ScorePills type="lead" id={f.lead.id} compact />
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}><span style={{ color: 'var(--text-tertiary)' }}>Pitch: </span>{pitchFor(f.lead.category, f.gaps.map((g) => g.kind)).map((p) => p.label).join(' · ')}</div>
            {f.gaps[0] && <details style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}><summary style={{ cursor: 'pointer' }}>Evidence</summary><code style={{ overflowWrap: 'anywhere' }}>{JSON.stringify(f.gaps[0].evidence)}</code></details>}
            {f.lead.website && <a href={f.lead.website.startsWith('http') ? f.lead.website : `http://${f.lead.website}`} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: 'var(--accent)' }}>{f.lead.website}</a>}
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function EnginesTab({ state, onState, onDraft, drafting, phone }: { state: EnginesState; onState: (s: EnginesState) => void; onDraft: () => void; drafting: boolean; phone: boolean }) {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const change = (s: EnginesState | null, m?: string) => { if (s?.cards) onState({ ...state, cards: s.cards, killed: s.killed }); if (m) setMsg(m); };
  const kill = async () => { setBusy(true); const r = await api<EnginesState>('/api/engines/kill', { body: { paused: !state.killed } }); setBusy(false); if (!r.error) change(r); else setMsg(r.error); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip k={state.killed ? 'bad' : 'good'}>{state.killed ? 'Kill switch ON: both engines paused' : 'Kill switch off'}</Chip>
        <button className={state.killed ? 'mm-btn mm-btn--primary' : 'mm-btn'} style={{ height: 32, fontSize: 13 }} disabled={busy} onClick={() => void kill()}>{state.killed ? 'Resume both' : 'Pause both'}</button>
        <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Test mode stays on: nothing is sent to anyone.</span>
      </div>
      {msg && <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{msg}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : 'repeat(auto-fit,minmax(380px,1fr))', gap: 14 }}>
        {state.cards.map((c) => <EngineCardView key={c.engine} c={c} killed={state.killed} keys={state.keys} onChange={change} />)}
      </div>
      <FindingsList items={state.findings} onDraft={onDraft} drafting={drafting} />
    </div>
  );
}
