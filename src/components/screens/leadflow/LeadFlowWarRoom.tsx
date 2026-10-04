import { useMemo, useRef, useState } from 'react';
import { useLeadflowIndustryPool, useLeadflowLeads } from '../../../data/useLeadflow';
import type { LeadflowLead } from '../../../data/useLeadflow';
import { US_STATES, NICHES } from './shared';
import { fmtPhone, telHref, fmtIndustry, websiteSignal } from './format';
import { Tag, Callout, Progress, KpiStrip, NotConnected, Segmented, PhoneIcon, FieldBox, PanelHead, Dot } from './ui';
import { HeaderAction, useLfPhone } from './layout';
import { PHONE_TAB_H } from '../../shell/Shell';

const MINDSET = [
  "Every no gets you closer to a yes. Your job today is to collect nos as fast as possible.",
  "You're not interrupting them — you're finding the ones who need you. Most just don't know it yet.",
  "Confidence isn't feeling ready. It's deciding to go anyway. Dial.",
  "The rep who makes the most calls wins. It's math, not magic.",
  "You have a solution to a real problem. Act like it.",
  "One conversation can change a business forever. Be that conversation.",
  "Rejection is information. Every objection tells you exactly what to say next.",
];

const OPENERS: Record<string, string> = {
  restaurant: "Hey, is this [Business Name]? Hey perfect — I was actually trying to place an order through your website and couldn't find one. Do you guys have a site up right now?",
  salon: "Hi, is this [Business Name]? Hey I was trying to book an appointment online but couldn't find your booking page — do you have a website or is it all by phone?",
  barbershop: "Hey is this [Business Name]? I was trying to find your hours online but couldn't pull up a website — are you guys on Google yet?",
  gym: "Hey, is this [Business Name]? I was looking up membership info online but couldn't find a site — do you have one up?",
  plumber: "Hi, is this [Business Name]? I was searching for a plumber in the area and found your number but no website — are you guys online anywhere?",
  electrician: "Hey is this [Business Name]? Found your number but couldn't find a website — are you taking new customers right now?",
  default: "Hey, is this [Business Name]? I was trying to find you online but couldn't pull up a website — do you have one up right now?",
};

const DRILLS = [
  { title: "I'm not interested", response: "Totally fair — I'm not trying to sell you anything right now. I just noticed you didn't have a site and wanted to show you what other [industry] owners in your area are doing. Can I send you a quick link?" },
  { title: "We already have a website", response: "Oh perfect! Can I ask — is it showing up when people search [industry] near [city]? A lot of sites exist but aren't actually pulling traffic. Takes 30 seconds to check." },
  { title: "We're too busy", response: "That's actually exactly why I called — the businesses that are too busy for marketing are usually the ones losing customers to competitors who aren't. I'll keep it under 2 minutes." },
  { title: "Send me an email", response: "I can do that — what's the best email? And just so I know what to send, is the main thing you're missing more walk-ins, more calls, or just showing up on Google?" },
  { title: "How much does it cost?", response: "Depends on what you need — we've got options starting under $200/month. But before I quote anything, can I ask what's your biggest thing right now — website, Google listing, or getting more calls?" },
];

type Result = 'hot' | 'warm' | 'cold';
const RESULTS: { value: Result; label: string; s: 'go' | 'wait' | 'neu'; tag: string }[] = [
  { value: 'hot', label: 'Hot', s: 'go', tag: 'Hot' },
  { value: 'warm', label: 'Warm', s: 'wait', tag: 'Warm' },
  { value: 'cold', label: 'Not ready', s: 'neu', tag: 'Not Ready' },
];

/** Multi-select with search; picked states show as removable 4px tags. */
function StatePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const matches = US_STATES.filter((s) => !value.includes(s) && s.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8);
  const add = (s: string) => { onChange([...value, s]); setQ(''); inputRef.current?.focus(); };
  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <div onClick={() => inputRef.current?.focus()} style={{ minHeight: 36, border: '1px solid var(--lf-border-strong)', borderRadius: 'var(--lf-r-ctl)', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', flexWrap: 'wrap', background: 'var(--lf-surface)', cursor: 'text' }}>
        {value.map((s) => (
          <span key={s} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', height: 24, padding: '0 4px 0 8px', borderRadius: 4, background: 'var(--lf-surface-2)', fontSize: 12, fontWeight: 500 }}>
            {s}<button type="button" aria-label={`Remove ${s}`} onClick={(e) => { e.stopPropagation(); onChange(value.filter((x) => x !== s)); }} style={{ all: 'unset', cursor: 'pointer', padding: '0 4px', color: 'var(--lf-text-tertiary)' }}>×</button>
          </span>
        ))}
        <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => { if (e.key === 'Enter' && matches[0]) { e.preventDefault(); add(matches[0]); } if (e.key === 'Backspace' && !q && value.length) onChange(value.slice(0, -1)); }}
          placeholder={value.length ? '' : 'All states. Search to narrow…'} aria-label="Search states"
          style={{ flex: 1, minWidth: 120, border: 0, outline: 'none', background: 'transparent', color: 'var(--lf-text)', fontSize: 14, height: 26 }} />
      </div>
      {open && matches.length > 0 && (
        <div className="lf-menu" role="listbox" style={{ left: 0, right: 0, top: 'calc(100% + 4px)', maxHeight: 240, overflowY: 'auto' }}>
          {matches.map((s) => <button key={s} role="option" aria-selected={false} onMouseDown={(e) => e.preventDefault()} onClick={() => add(s)}>{s}</button>)}
        </div>
      )}
    </div>
  );
}

export default function LeadFlowWarRoom() {
  const phone = useLfPhone();
  const [configured, setConfigured] = useState(false);
  const [niche, setNiche] = useState('restaurant');
  const [states, setStates] = useState<string[]>([]);
  const [count, setCount] = useState(20);
  const [queue, setQueue] = useState<LeadflowLead[]>([]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [queueOpen, setQueueOpen] = useState(false);
  const [openerOpen, setOpenerOpen] = useState(true);
  const [building, setBuilding] = useState(false);

  const { notConnected, reload } = useLeadflowIndustryPool(niche);
  const { updateLead, industries } = useLeadflowLeads();

  // The niche list comes from the industries actually in the data (falls
  // back to the fixed list until that loads), so every pick can fill a queue.
  const niches = useMemo(() => {
    const real = industries.filter((i) => i !== 'All');
    const list = real.length ? real : NICHES;
    return list.includes(niche) ? list : [niche, ...list];
  }, [industries, niche]);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const mindset = MINDSET[new Date().getDay() % MINDSET.length];
  const drill = DRILLS[new Date().getDay() % DRILLS.length];
  const opener = OPENERS[niche] || OPENERS.default;
  const n = Math.min(100, Math.max(5, count || 5));

  const buildQueue = async () => {
    setBuilding(true);
    const freshPool = await reload();
    let filtered = freshPool;
    if (states.length > 0) filtered = filtered.filter((l) => l.state && states.includes(l.state));
    const shuffled = [...filtered].sort(() => Math.random() - 0.5);
    setQueue(shuffled.slice(0, n));
    setIndex(0);
    setResults({});
    setNotes({});
    setConfigured(true);
    setBuilding(false);
  };

  const logResult = (id: string, result: Result) => {
    setResults((r) => ({ ...r, [id]: result }));
    updateLead(id, { tag: RESULTS.find((x) => x.value === result)!.tag });
  };

  const current = queue[index];
  const done = configured && index >= queue.length;
  const tally = (r: Result) => Object.values(results).filter((x) => x === r).length;
  const drillBody = <><span style={{ fontWeight: 500, color: 'var(--lf-text)' }}>Objection:</span> “{drill.title}”<br /><span style={{ fontWeight: 500, color: 'var(--lf-text)' }}>Response:</span> {drill.response} <span style={{ color: 'var(--lf-text-tertiary)' }}>Practice out loud 3 times.</span></>;

  // ── Setup ──────────────────────────────────────────────────────────
  if (!configured) {
    const fieldRow = (label: string, child: React.ReactNode, top?: boolean) => (
      <div style={{ display: 'flex', flexDirection: phone ? 'column' : 'row', gap: phone ? 6 : 0, padding: '12px 16px', alignItems: phone ? 'stretch' : top ? 'flex-start' : 'center', borderBottom: '1px solid var(--lf-border)' }}>
        <div className="lf-label" style={{ width: 120, flex: 'none', paddingTop: top && !phone ? 10 : 0 }}>{label}</div>
        {child}
      </div>
    );
    return (
      <>
        <HeaderAction><button className="lf-btn lf-btn--primary" onClick={buildQueue} disabled={building}>{building ? 'Building…' : 'Start session'}</button></HeaderAction>
        {notConnected && <NotConnected />}
        <div style={{ display: 'grid', gridTemplateColumns: phone ? 'minmax(0,1fr)' : 'minmax(0,1.4fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
          <div className="lf-panel">
            <PanelHead title="New session" sub={today} />
            {fieldRow('Niche', (
              <select className="lf-input" value={niche} onChange={(e) => setNiche(e.target.value)} style={{ flex: 1 }} aria-label="Niche">
                {niches.map((i) => <option key={i} value={i}>{fmtIndustry(i)}</option>)}
              </select>
            ))}
            {fieldRow('Leads', (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input className="lf-input" type="number" min={5} max={100} value={count} onChange={(e) => setCount(parseInt(e.target.value, 10) || 0)} onBlur={() => setCount(n)} style={{ width: 100 }} aria-label="Number of leads" />
                <span className="lf-label">5 to 100</span>
              </div>
            ))}
            {fieldRow('States', <StatePicker value={states} onChange={setStates} />, true)}
            <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="lf-btn lf-btn--primary" onClick={buildQueue} disabled={building} style={phone ? { width: '100%' } : undefined}>{building ? 'Building…' : <>Build my day · <span className="lf-mono">{n}</span> leads</>}</button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Callout label="Today's mindset"><span style={{ fontSize: 15, color: 'var(--lf-text)' }}>{mindset}</span></Callout>
            <Callout label="Today's drill">{drillBody}</Callout>
          </div>
        </div>
      </>
    );
  }

  // ── Complete ───────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="lf-panel" style={{ overflow: 'hidden' }}>
        <PanelHead title="Session complete" sub={queue.length ? `You worked through ${queue.length} lead${queue.length === 1 ? '' : 's'}.` : 'No leads matched that niche and those states.'} />
        <div style={{ borderBottom: '1px solid var(--lf-border)' }}>
          <div style={{ margin: -1 }}>
            <KpiStrip compact={phone} items={[
              { label: 'Worked', value: Object.keys(results).length, s: 'info' },
              { label: 'Hot', value: tally('hot'), s: 'go' },
              { label: 'Warm', value: tally('warm'), s: 'wait' },
              { label: 'Not ready', value: tally('cold'), s: 'neu' },
            ]} />
          </div>
        </div>
        {queue.map((l, i) => {
          const r = RESULTS.find((x) => x.value === results[l.id]);
          return (
            <div key={l.id} style={{ display: 'grid', gridTemplateColumns: phone ? '28px minmax(0,1fr) auto' : '30px minmax(0,2fr) minmax(0,1fr) 110px', alignItems: 'center', minHeight: 44, padding: '0 16px', gap: 8, borderTop: i ? '1px solid var(--lf-border)' : 0, fontSize: 14 }}>
              <span className="lf-mono" style={{ fontSize: 12, color: 'var(--lf-text-tertiary)' }}>{i + 1}</span>
              <span className="lf-trunc" style={{ fontWeight: 500 }}>{l.business_name}</span>
              {!phone && <span className="lf-cell-2 lf-trunc">{l.city}</span>}
              <span>{r ? <Tag s={r.s}>{r.label}</Tag> : <span className="lf-label">Skipped</span>}</span>
            </div>
          );
        })}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--lf-border)' }}>
          <button className="lf-btn lf-btn--primary" onClick={() => setConfigured(false)}>Start new session</button>
        </div>
      </div>
    );
  }

  // ── Live ───────────────────────────────────────────────────────────
  const result = current ? results[current.id] ?? null : null;
  const site = current ? websiteSignal(current) : null;
  const queueList = (
    <div>
      {queue.map((l, i) => {
        const r = RESULTS.find((x) => x.value === results[l.id]);
        return (
          <button key={l.id} onClick={() => { setIndex(i); setQueueOpen(false); }} aria-current={i === index ? 'true' : undefined}
            style={{ all: 'unset', boxSizing: 'border-box', width: '100%', display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 12px', borderTop: '1px solid var(--lf-border)', background: i === index ? 'var(--lf-selected)' : 'transparent', fontSize: 13, cursor: 'pointer' }}>
            <span className="lf-mono" style={{ fontSize: 12, color: 'var(--lf-text-tertiary)', width: 20 }}>{i + 1}</span>
            <span className="lf-trunc" style={{ flex: 1, fontWeight: i === index ? 500 : 400 }}>{l.business_name}</span>
            {r && <span title={r.label}><Dot s={r.s} /></span>}
          </button>
        );
      })}
    </div>
  );
  const nextBtn = (
    <button className={`lf-btn ${result ? 'lf-btn--primary' : 'lf-btn--secondary'}`} onClick={() => setIndex(index + 1)}>
      {index < queue.length - 1 ? 'Next lead' : 'Finish session'}
    </button>
  );
  const resultSeg = current && (
    <Segmented label="Result" value={result} onChange={(v) => logResult(current.id, v)} style={{ display: 'flex', width: '100%', maxWidth: phone ? undefined : 420 }}
      options={RESULTS.map((r) => ({ value: r.value, label: <><Dot s={r.s} /><span style={{ color: 'var(--lf-text)' }}>{r.label}</span></> }))} />
  );
  const leadBody = current && (
    <>
      <div className="lf-label">Lead <span className="lf-mono">{index + 1}</span> of <span className="lf-mono">{queue.length}</span> · {fmtIndustry(niche)} · {states.length ? states.join(', ') : 'All states'}</div>
      <h2 style={{ margin: 0, fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{current.business_name}</h2>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {current.state && <Tag s="neu" dot={false}>{current.state}</Tag>}
        {current.industry && <Tag s="neu" dot={false}>{fmtIndustry(current.industry)}</Tag>}
        {site && <Tag s={site.s}>{site.label}</Tag>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        {current.phone ? <a className="lf-mono" href={telHref(current.phone)} style={{ fontSize: phone ? 28 : 32, fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--lf-text)', textDecoration: 'none' }}>{fmtPhone(current.phone)}</a>
          : <span style={{ color: 'var(--lf-text-tertiary)' }}>No phone on file</span>}
        {!phone && current.phone && <a className="lf-btn lf-btn--primary" href={telHref(current.phone)} style={{ height: 40, padding: '0 20px' }}><PhoneIcon />Call now</a>}
      </div>
      {phone && (
        <Callout label="Opener" action={<button className="lf-btn lf-btn--ghost lf-btn--xs" onClick={() => setOpenerOpen((v) => !v)} style={{ height: 20, padding: '0 4px' }}>{openerOpen ? 'Hide ▴' : 'Show ▾'}</button>}>
          {openerOpen ? opener : null}
        </Callout>
      )}
      <FieldBox labelW={phone ? 100 : 130} rows={[
        { label: 'Phone', value: current.phone ? fmtPhone(current.phone) : '–', mono: true },
        { label: 'Industry', value: fmtIndustry(current.industry) || '–' },
        { label: 'Legal name', value: <>{current.registry_legal_name || current.business_name}<div className="lf-label" style={{ marginTop: 2 }}>Use this on TruePeopleSearch</div></> },
        { label: 'Website', value: site?.label ?? (current.website_status || '–') },
      ]} />
      <textarea className="lf-input" placeholder="Call notes: who you spoke to, what they said, when to try again…" value={notes[current.id] || ''} onChange={(e) => setNotes((m) => ({ ...m, [current.id]: e.target.value }))} rows={3} style={{ minHeight: 80 }} aria-label="Call notes" />
    </>
  );

  if (phone) {
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="lf-btn lf-btn--secondary lf-btn--sm" onClick={() => setQueueOpen((v) => !v)} aria-expanded={queueOpen}><span className="lf-mono">{Math.min(index + 1, queue.length)} of {queue.length}</span> ▾</button>
          <div style={{ flex: 1 }}><Progress value={index} total={queue.length} label={false} /></div>
          <button className="lf-btn lf-btn--ghost lf-btn--sm" onClick={() => setConfigured(false)}>Reconfigure</button>
        </div>
        {queueOpen && <div className="lf-panel" style={{ overflow: 'hidden', marginTop: -4 }}><div style={{ marginTop: -1 }}>{queueList}</div></div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 150 }}>{leadBody}</div>
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: `calc(${PHONE_TAB_H - 20}px + max(env(safe-area-inset-bottom), 20px))`, zIndex: 60, padding: '12px 16px', background: 'var(--lf-surface)', borderTop: '1px solid var(--lf-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {resultSeg}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="lf-btn lf-btn--ghost" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0} aria-label="Previous lead" style={{ height: 52 }}>‹</button>
            {current?.phone ? <a className="lf-btn lf-btn--primary lf-btn--call" href={telHref(current.phone)} style={{ flex: 1 }}><PhoneIcon />Call</a> : <button className="lf-btn lf-btn--primary lf-btn--call" disabled style={{ flex: 1 }}>No phone</button>}
            <button className={`lf-btn ${result ? 'lf-btn--primary' : 'lf-btn--secondary'}`} onClick={() => setIndex(index + 1)} style={{ height: 52 }}>{index < queue.length - 1 ? 'Next' : 'Finish'}</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px minmax(0,1fr) 300px', gap: 16, alignItems: 'start' }}>
      <div className="lf-panel" style={{ overflow: 'hidden' }}>
        <div style={{ padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 15, fontWeight: 500 }}>Queue</span>
            <span className="lf-mono" style={{ fontSize: 13 }}>{Math.min(index + 1, queue.length)} of {queue.length}</span>
          </div>
          <div style={{ marginTop: 8 }}><Progress value={index} total={queue.length} label={false} /></div>
          <button className="lf-btn lf-btn--ghost lf-btn--sm" onClick={() => setConfigured(false)} style={{ marginTop: 8, marginLeft: -10 }}>Reconfigure</button>
        </div>
        {queueList}
      </div>
      <div className="lf-panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {leadBody}
        {resultSeg}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--lf-border)', paddingTop: 14 }}>
          <button className="lf-btn lf-btn--ghost" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0}>Previous</button>
          {nextBtn}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Callout label="Today's opener">{opener}</Callout>
        <Callout label="Today's drill">{drillBody}</Callout>
      </div>
    </div>
  );
}
