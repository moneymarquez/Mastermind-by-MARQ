import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { field, useModule } from '../mm/Page';
import Chip from '../mm/Chip';
import { useFlags } from '../../data/useFlags';
import { DELIVERY_PHASES, phaseOf, phaseProgress, nextStep, checklistFor, caseDeltas, daysSince } from '../../data/madeby';
import type { CheckItem, Owner, Metrics } from '../../data/madeby';
import type { CrmClient } from '../../data/types';
import CommsThread from './CommsThread';

type C = CrmClient & { delivery_phase?: number | null; phase_started_at?: string | null; business_kind?: string | null; last_contact_at?: string | null };
const OWNER_LABEL: Record<Owner, string> = { marq: 'Marq', client: 'Client', bot: 'Bot' };
const KINDS = ['restaurant', 'food truck', 'service', 'retail', 'other'];
const today = () => new Date().toISOString().slice(0, 10);

function useChecklist(clientId: string) {
  const [items, setItems] = useState<CheckItem[]>([]);
  const [missing, setMissing] = useState(false);
  const load = useCallback(async () => {
    const { data, error } = await supabase.from('client_checklist').select('*').eq('client_id', clientId).order('phase').order('sort');
    setMissing(!!error); setItems((data ?? []) as CheckItem[]);
  }, [clientId]);
  useEffect(() => { void load(); }, [load]);
  return { items, missing, reload: load };
}

/** Overview: only phase, next step, who it's waiting on, last contact, open flags. */
export function ClientOverview({ client, onOpen }: { client: CrmClient; onOpen: (s: 'delivery' | 'comms' | 'sales' | 'money') => void }) {
  const c = client as C;
  const { items } = useChecklist(c.id);
  const flags = useFlags(true).flags.filter((f) => f.entity_id === c.id);
  const [lastMsg, setLastMsg] = useState<string | null>(null);
  useEffect(() => { void supabase.from('comm_messages').select('created_at').eq('client_id', c.id).order('created_at', { ascending: false }).limit(1).then(({ data }) => setLastMsg(((data ?? [])[0] as { created_at: string } | undefined)?.created_at ?? null)); }, [c.id]);
  const phase = phaseOf(c.delivery_phase);
  const step = phase ? nextStep(items, phase.n) : null;
  const prog = phase ? phaseProgress(items, phase.n) : null;
  const last = [c.last_contact_at, lastMsg, c.last_activity_at].filter(Boolean).sort().at(-1) ?? null;
  const row = (k: string, v: React.ReactNode, onClick?: () => void) => (
    <button onClick={onClick} disabled={!onClick} style={{ all: 'unset', cursor: onClick ? 'pointer' : 'default', display: 'grid', gridTemplateColumns: '140px minmax(0,1fr)', gap: 12, padding: '12px 0', borderTop: '1px solid var(--grid)', fontSize: 14.5 }}>
      <span style={{ color: 'var(--text-tertiary)' }}>{k}</span><span style={{ color: 'var(--text)' }}>{v}</span>
    </button>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginTop: 12, maxWidth: 680 }}>
      {row('Phase', phase ? <>{phase.n} · {phase.label} <span style={{ color: 'var(--text-tertiary)' }}>({prog?.pct ?? 0}%)</span></> : c.stage === 'active' || c.stage === 'retainer' ? 'Not started — open Delivery' : 'Still in sales', () => onOpen('delivery'))}
      {row('Next step', step ? step.title : phase ? 'Phase checklist done' : '—', () => onOpen('delivery'))}
      {row('Waiting on', step ? <Chip k={step.owner === 'marq' ? (daysSince(step.created_at, new Date()) > 3 ? 'bad' : 'warn') : 'neutral'}>{OWNER_LABEL[step.owner]}{step.owner === 'marq' ? ` · ${daysSince(step.created_at, new Date())}d` : ''}</Chip> : '—')}
      {row('Last contact', last ? new Date(last).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never', () => onOpen('comms'))}
      {row('Open flags', flags.length ? flags.map((f) => <Chip key={f.id} k={f.severity === 'red' ? 'bad' : 'warn'}>{f.message}</Chip>) : 'None')}
    </div>
  );
}

/** Delivery: 5 phases, the checklist with owners and due dates, plays, numbers. */
export function DeliveryTab({ client, onChanged }: { client: CrmClient; onChanged: () => void }) {
  const c = client as C;
  const { isOwner } = useModule();
  const cl = useChecklist(c.id);
  const [phaseN, setPhaseN] = useState<number | null>(c.delivery_phase ?? null);
  const [kind, setKind] = useState(c.business_kind ?? '');
  const [plays, setPlays] = useState<{ id: string; title: string; business_kind: string | null; phase: number | null; steps: { title: string; owner?: Owner; days?: number }[] }[]>([]);
  const [metrics, setMetrics] = useState<(Metrics & { id: string; kind: string; phase: number | null; captured_at: string })[]>([]);
  const [newItem, setNewItem] = useState('');
  const [msg, setMsg] = useState('');
  const [m, setM] = useState<Metrics>({});
  useEffect(() => { setPhaseN(c.delivery_phase ?? null); setKind(c.business_kind ?? ''); }, [c.id, c.delivery_phase, c.business_kind]);
  const loadExtra = useCallback(async () => {
    const [p, mm] = await Promise.all([supabase.from('plays').select('id,title,business_kind,phase,steps').order('uses', { ascending: false }), supabase.from('client_metrics').select('*').eq('client_id', c.id).order('captured_at')]);
    setPlays((p.data ?? []) as typeof plays); setMetrics((mm.data ?? []) as typeof metrics);
  }, [c.id]);
  useEffect(() => { void loadExtra(); }, [loadExtra]);
  const phase = phaseOf(phaseN);
  const mine = cl.items.filter((i) => i.phase === phaseN);
  const prog = phaseN ? phaseProgress(cl.items, phaseN) : null;
  const matchingPlays = plays.filter((p) => p.phase === phaseN && (!p.business_kind || !kind || p.business_kind === kind));

  const enter = async (n: number) => {
    const start = today();
    const { error } = await supabase.from('crm_clients').update({ delivery_phase: n, phase_started_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', c.id);
    if (error) { setMsg(error.message); return; }
    if (!cl.items.some((i) => i.phase === n)) {
      const rows = checklistFor(n, start, matchingPlaysFor(n)).map((r) => ({ ...r, client_id: c.id }));
      await supabase.from('client_checklist').insert(rows);
    }
    setPhaseN(n); setMsg(`Moved to ${phaseOf(n)?.label}. Its checklist is ready${n > 1 ? '; capture this phase\'s numbers below for the case study' : ''}.`);
    await cl.reload(); onChanged();
  };
  const matchingPlaysFor = (n: number) => plays.filter((p) => p.phase === n && (!p.business_kind || !kind || p.business_kind === kind));
  const patch = async (id: string, p: Partial<CheckItem>) => { await supabase.from('client_checklist').update({ ...p, ...(p.done != null ? { done_at: p.done ? new Date().toISOString() : null } : {}), updated_at: new Date().toISOString() }).eq('id', id); await cl.reload(); };
  const add = async () => { if (!newItem.trim() || !phaseN) return; await supabase.from('client_checklist').insert({ client_id: c.id, phase: phaseN, title: newItem.trim(), owner: 'marq', sort: mine.length }); setNewItem(''); await cl.reload(); };
  const saveKind = async (k: string) => { setKind(k); await supabase.from('crm_clients').update({ business_kind: k || null }).eq('id', c.id); };
  const saveAsPlay = async () => {
    if (!phase) return;
    const { error } = await supabase.from('plays').insert({ title: `${phase.label} — ${c.business_name}`, business_kind: kind || null, phase: phase.n, steps: mine.map((i) => ({ title: i.title, owner: i.owner })), source_client_id: c.id });
    setMsg(error ? error.message : 'Saved as a play. New clients of this type entering this phase will be offered it, and the bots read it too.'); await loadExtra();
  };
  const applyPlay = async (id: string) => {
    const p = plays.find((x) => x.id === id); if (!p || !phaseN) return;
    const have = new Set(mine.map((i) => i.title.toLowerCase()));
    const rows = p.steps.filter((s) => !have.has(s.title.toLowerCase())).map((s, i) => ({ client_id: c.id, phase: phaseN, title: s.title, owner: s.owner ?? 'marq', sort: mine.length + i, play_id: p.id }));
    if (rows.length) await supabase.from('client_checklist').insert(rows);
    await supabase.from('plays').update({ uses: ((p as { uses?: number }).uses ?? 0) + 1 }).eq('id', p.id);
    setMsg(`Added ${rows.length} step${rows.length === 1 ? '' : 's'} from "${p.title}".`); await cl.reload();
  };
  const saveMetrics = async () => {
    const isBase = !metrics.some((x) => x.kind === 'baseline');
    const { error } = await supabase.from('client_metrics').insert({ client_id: c.id, phase: phaseN, kind: isBase ? 'baseline' : 'snapshot', ...m });
    setMsg(error ? error.message : isBase ? 'Baseline saved.' : 'Snapshot saved.'); setM({}); await loadExtra();
  };
  const base = metrics.find((x) => x.kind === 'baseline');
  const latest = [...metrics].reverse().find((x) => x.kind === 'snapshot');
  const deltas = base && latest ? caseDeltas(base, latest) : [];
  const makeCase = async () => {
    const done = cl.items.filter((i) => i.done).map((i) => ({ phase: i.phase, title: i.title, at: i.done_at }));
    const { error } = await supabase.from('case_studies').insert({ client_id: c.id, title: `${c.business_name}: ${deltas[0] ? `${deltas[0].label} ${deltas[0].change}` : 'before → after'}`, body: { deltas, done, started: c.phase_started_at ?? null, client: c.business_name } });
    setMsg(error ? error.message : 'Case study drafted. Add the client quote and publish it in Show Your Work.');
  };

  if (cl.missing) return <div style={{ marginTop: 12, fontSize: 14, color: 'var(--text-tertiary)' }}>Delivery phases need the October migration (schema_125).</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {DELIVERY_PHASES.map((p) => {
          const pr = phaseProgress(cl.items, p.n);
          const on = p.n === phaseN, past = phaseN != null && p.n < phaseN;
          return <button key={p.n} className={`mm-btn ${on ? 'mm-btn--primary' : ''}`} style={{ height: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, opacity: past ? 0.75 : 1 }} onClick={() => { if (p.n !== phaseN && window.confirm(`Move ${c.business_name} to ${p.label}?`)) void enter(p.n); }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>{past ? '✓ ' : ''}Phase {p.n}</span><span style={{ fontSize: 13.5, fontWeight: 600 }}>{p.short}</span>{pr.total > 0 && <span style={{ fontSize: 11.5, opacity: 0.7 }}>{pr.done}/{pr.total}</span>}
          </button>;
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Business type</span>
        <select style={{ ...field, width: 'auto', height: 34 }} value={kind} onChange={(e) => void saveKind(e.target.value)}><option value="">—</option>{KINDS.map((k) => <option key={k}>{k}</option>)}</select>
        {!phase && <button className="mm-btn mm-btn--primary" style={{ height: 34 }} onClick={() => void enter(1)}>Start Onboard & Audit</button>}
        {phase && phase.n < 5 && prog && prog.total > 0 && prog.done === prog.total && <button className="mm-btn mm-btn--primary" style={{ height: 34 }} onClick={() => void enter(phase.n + 1)}>Move to {phaseOf(phase.n + 1)?.label} →</button>}
      </div>
      {phase && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'center', background: 'var(--surface-2)' }}>
            <strong style={{ flex: 1 }}>{phase.label} checklist</strong>
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{prog?.pct}%</span>
            {isOwner && mine.length > 0 && <button className="mm-btn" style={{ height: 30, fontSize: 12.5 }} onClick={() => void saveAsPlay()}>Save as play</button>}
          </div>
          {mine.map((i) => (
            <div key={i.id} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto auto', gap: 8, alignItems: 'center', padding: '8px 12px', borderTop: '1px solid var(--grid)' }}>
              <input type="checkbox" checked={i.done} onChange={(e) => void patch(i.id, { done: e.target.checked })} aria-label={i.title} />
              <span style={{ fontSize: 14, textDecoration: i.done ? 'line-through' : 'none', color: i.done ? 'var(--text-tertiary)' : 'var(--text)' }}>{i.title}</span>
              <select style={{ ...field, height: 30, width: 'auto', fontSize: 12.5 }} value={i.owner} onChange={(e) => void patch(i.id, { owner: e.target.value as Owner })}>{(['marq', 'client', 'bot'] as Owner[]).map((o) => <option key={o} value={o}>{OWNER_LABEL[o]}</option>)}</select>
              <input type="date" style={{ ...field, height: 30, width: 'auto', fontSize: 12.5 }} value={i.due ?? ''} onChange={(e) => void patch(i.id, { due: e.target.value || null })} />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, padding: '8px 12px', borderTop: '1px solid var(--grid)' }}>
            <input style={{ ...field, height: 34, flex: 1 }} placeholder="Add a step" value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void add(); }} />
          </div>
        </div>
      )}
      {phase && matchingPlays.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Plays for {kind || 'this type'} in {phase.label}</span>
          {matchingPlays.slice(0, 4).map((p) => <div key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}><span style={{ flex: 1 }}>{p.title} <span style={{ color: 'var(--text-tertiary)' }}>· {p.steps.length} steps</span></span><button className="mm-btn" style={{ height: 30 }} onClick={() => void applyPlay(p.id)}>Use</button></div>)}
        </div>
      )}
      <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <strong>{base ? 'Numbers now' : 'Baseline numbers'}</strong>
        <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{base ? 'Capture at each phase change. Before → after becomes the case study.' : 'Captured at Onboard & Audit, so the results later have something to compare to.'}</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 8 }}>
          {([['followers', 'Followers'], ['monthly_revenue', 'Monthly revenue $'], ['google_reviews', 'Google reviews'], ['google_rating', 'Google rating'], ['site_traffic', 'Site visits / mo'], ['leads_month', 'Leads / mo']] as [keyof Metrics, string][]).map(([k, l]) => (
            <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: 'var(--text-secondary)' }}>{l}<input style={{ ...field, height: 36 }} inputMode="decimal" value={m[k] ?? ''} onChange={(e) => setM({ ...m, [k]: e.target.value === '' ? null : Number(e.target.value) })} /></label>
          ))}
        </div>
        <button className="mm-btn" style={{ alignSelf: 'flex-start', height: 34 }} disabled={!Object.values(m).some((v) => v != null)} onClick={() => void saveMetrics()}>Save {base ? 'snapshot' : 'baseline'}</button>
        {deltas.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {deltas.map((d) => <div key={d.key} style={{ fontSize: 14 }}>{d.label}: {d.before.toLocaleString('en-US')} → {d.after.toLocaleString('en-US')} <Chip k={d.change.startsWith('-') ? 'bad' : 'good'}>{d.change}</Chip></div>)}
            <button className="mm-btn mm-btn--primary" style={{ alignSelf: 'flex-start', height: 34 }} onClick={() => void makeCase()}>Make the case study</button>
          </div>
        )}
      </div>
      {msg && <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{msg}</div>}
    </div>
  );
}

export function ClientComms({ client }: { client: CrmClient }) {
  const who = useMemo(() => ({ clientId: client.id, name: client.contact_name || client.business_name, email: client.contact_email, phone: client.contact_phone }), [client]);
  return <div style={{ marginTop: 12 }}><CommsThread who={who} /></div>;
}

export function ClientContracts({ client }: { client: CrmClient }) {
  const { nav } = useModule();
  const [rows, setRows] = useState<{ id: string; title: string; status: string; signed_at: string | null; created_at: string }[]>([]);
  useEffect(() => { void supabase.from('contracts').select('id,title,status,signed_at,created_at').eq('client_id', client.id).order('created_at', { ascending: false }).then(({ data }) => setRows((data ?? []) as typeof rows)); }, [client.id]);
  return (
    <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><strong style={{ flex: 1 }}>Contracts</strong><button className="mm-btn" style={{ height: 32 }} onClick={() => { try { sessionStorage.setItem('contract_for_client', client.id); } catch { /* fine */ } nav('contracts'); }}>New contract</button></div>
      {rows.length === 0 && <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>No contracts with {client.business_name} yet.</span>}
      {rows.map((r) => <div key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}><span style={{ flex: 1 }}>{r.title}</span><Chip k={r.status === 'signed' ? 'good' : r.status === 'declined' ? 'bad' : 'neutral'}>{r.status}</Chip></div>)}
    </div>
  );
}
