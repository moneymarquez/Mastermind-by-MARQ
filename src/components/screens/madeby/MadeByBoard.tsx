import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { supabase } from '../../../lib/supabase';
import { Page, useModule } from '../../mm/Page';
import Chip from '../../mm/Chip';
import { Empty } from '../../mm/States';
import { NewDeal } from '../v2/ClientCRMV2';
import { STAGES } from '../clientStyles';
import { MODULE_REGISTRY } from '../../../modules.config';
import { checklistFor, nextStep, phaseOf, phaseProgress, ringFor, waitingOnMarq } from '../../../data/madeby';
import type { CheckItem } from '../../../data/madeby';
import { JOURNEY_STEPS, journeyStepOf, nextJourneyStep, phaseForStep } from '../../../data/madebyJourney';
import type { JourneyStepN } from '../../../data/madebyJourney';
import type { CrmClient } from '../../../data/types';

interface Client { id: string; business_name: string; contact_name: string | null; stage: string; delivery_phase: number | null; room: string | null; client_type: string | null; last_activity_at: string }
const stageLabel = (s: string) => STAGES.find((x) => x.key === s)?.label ?? s;
const toolLabel = (route: string) => MODULE_REGISTRY.find((m) => m.routes[0] === route)?.label ?? route;

interface Props {
  /** Open a client's record (Client CRM), optionally on a section. */
  onOpenClient: (id: string, section?: string) => void;
  /** Whether this account can open a tool route (nav access, travel mode). */
  canOpen: (route: string) => boolean;
}

/** Clients board: Made by's landing (Made by journey, Oct 2026). One column
 *  per numbered step, 1 Diagnose → 8 Prove & Renew; each client sits on the step
 *  its sales stage / delivery phase puts it on (data/madebyJourney.ts), with
 *  its next checklist item and how long it has been waiting on Marq. Each
 *  column header lists that step's tools, so nothing is a tab deeper.
 *  Moving a client writes the same delivery_phase field the CRM and the
 *  Classroom use, and seeds that phase's checklist the same way. */
export default function MadeByBoard({ onOpenClient, canOpen }: Props) {
  const { device, nav } = useModule();
  const phone = device === 'phone';
  const [clients, setClients] = useState<Client[]>([]);
  const [items, setItems] = useState<CheckItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<JourneyStepN | null>(null);
  const [showAll, setShowAll] = useState(false);
  const load = useCallback(async () => {
    const [c, i] = await Promise.all([
      supabase.from('crm_clients').select('id,business_name,contact_name,stage,delivery_phase,room,client_type,last_activity_at').order('last_activity_at', { ascending: false }),
      supabase.from('client_checklist').select('*'),
    ]);
    setMissing(!!c.error);
    setClients((c.data ?? []) as Client[]);
    setItems((i.data ?? []) as CheckItem[]);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const now = useMemo(() => new Date(), [items]); // eslint-disable-line react-hooks/exhaustive-deps
  const waiting = useMemo(() => waitingOnMarq(items, now), [items, now]);
  const waitDays = (id: string) => { const w = waiting.filter((x) => x.item.client_id === id); return w.length ? Math.max(...w.map((x) => x.days)) : null; };
  // Own brands and internal rows live in the Classroom, not on the client journey.
  const real = clients.filter((c) => showAll || !c.client_type || c.client_type === 'client');
  const hidden = clients.length - real.length;
  const list = real.filter((c) => !q || `${c.business_name} ${c.contact_name ?? ''}`.toLowerCase().includes(q.toLowerCase()));
  const byStep = (n: JourneyStepN) => list.filter((c) => journeyStepOf(c) === n);

  const moveTo = async (id: string, n: JourneyStepN) => {
    const c = clients.find((x) => x.id === id);
    const phase = phaseForStep(n);
    if (!c || phase == null || journeyStepOf(c) === n) return;
    setClients((xs) => xs.map((x) => (x.id === id ? { ...x, delivery_phase: phase, room: null } : x)));
    await supabase.from('crm_clients').update({ delivery_phase: phase, room: null, phase_started_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id);
    // Entering a phase for the first time seeds its checklist (same as the CRM and Classroom).
    if (!items.some((i) => i.client_id === id && i.phase === phase)) {
      await supabase.from('client_checklist').insert(checklistFor(phase, new Date().toISOString().slice(0, 10)).map((r) => ({ ...r, client_id: id })));
    }
    await load();
  };
  const create = async (input: { business_name: string; contact_email?: string | null; contact_phone?: string | null }) => {
    const { data } = await supabase.from('crm_clients').insert({ ...input, source: 'internal' }).select().single();
    await load();
    return data as CrmClient | null;
  };

  const menu = [
    { t: 'Guided start (idea → brand → site → plan → invoice)', onClick: () => nav('scaling-start') },
    { t: 'Client CRM (list view)', onClick: () => nav('client-crm') },
    { t: 'Comms hub (templates, sequences)', onClick: () => nav('comms') },
    { t: showAll ? 'Hide own brands / internal' : `Show own brands / internal${hidden ? ` (${hidden})` : ''}`, onClick: () => setShowAll((v) => !v) },
  ];
  const sub = loading ? 'Loading…' : `${real.length} ${real.length === 1 ? 'client' : 'clients'} · ${waiting.length ? `${waiting.length} waiting on you` : 'nothing waiting on you'}`;

  if (missing) return <Page title="Clients" sub="Every client, step 1 to 8" backTo="modules"><Empty text="The board needs the October Made by migration (schema_125) applied." /></Page>;

  const card = (c: Client) => {
    const n = journeyStepOf(c);
    const phase = phaseOf(c.delivery_phase);
    const mine = items.filter((i) => i.client_id === c.id);
    const step = phase ? nextStep(mine, phase.n) : null;
    const prog = phase ? phaseProgress(mine, phase.n) : null;
    const wd = waitDays(c.id);
    const ring = ringFor(wd);
    const nx = nextJourneyStep(n);
    return (
      <div key={c.id} draggable={!phone} onDragStart={(e) => { setDrag(c.id); e.dataTransfer.setData('text/plain', c.id); }} onDragEnd={() => { setDrag(null); setOver(null); }}
        style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', borderRadius: 12, background: 'var(--surface)', border: `1px solid ${ring === 'red' ? 'var(--danger)' : ring === 'amber' ? 'var(--warning)' : 'var(--border)'}`, opacity: drag === c.id ? 0.5 : 1, cursor: phone ? 'default' : 'grab', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, minWidth: 0 }}>
          <button onClick={() => onOpenClient(c.id)} style={{ all: 'unset', cursor: 'pointer', flex: 1, minWidth: 0, color: 'var(--text)', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.business_name}</button>
          {nx && <button className="mm-btn" style={{ height: 24, padding: '0 7px', fontSize: 11.5, flex: 'none' }} title={`Move to step ${nx}`} aria-label={`Move ${c.business_name} to step ${nx}`} onClick={() => void moveTo(c.id, nx)}>→ {nx}</button>}
        </div>
        <button onClick={() => onOpenClient(c.id)} style={{ all: 'unset', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip k={phase ? 'accent' : 'neutral'}>{phase ? `${phase.short}${prog?.total ? ` ${prog.pct}%` : ''}` : stageLabel(c.stage)}</Chip>
            {wd != null && <Chip k={ring === 'red' ? 'bad' : 'warn'}>you · {wd}d</Chip>}
          </span>
          <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{step ? `Next: ${step.title}` : c.contact_name ?? (phase ? 'Phase checklist done' : 'In sales')}</span>
        </button>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className="mm-btn" style={{ height: 28, padding: '0 10px', fontSize: 12 }} onClick={() => onOpenClient(c.id, 'portal')}>Portal</button>
          <button className="mm-btn" style={{ height: 28, padding: '0 10px', fontSize: 12 }} onClick={() => onOpenClient(c.id, 'comms')}>Comms</button>
        </div>
      </div>
    );
  };

  const head = (s: (typeof JOURNEY_STEPS)[number], count: number) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 22, height: 22, flex: 'none', borderRadius: 7, background: 'var(--text)', color: 'var(--bg)', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.n}</span>
        <span style={{ flex: 1, minWidth: 0, color: 'var(--text)', fontSize: 14, fontWeight: 600, lineHeight: 1.25 }}>{s.label}</span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>{count}</span>
      </div>
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.35 }}>{s.goal}</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {s.n <= 2 && canOpen('call-list') && <button className="mm-btn" style={toolBtn} onClick={() => nav('call-list')}>Call list</button>}
        {s.n === 1 && canOpen('leadflow') && <button className="mm-btn" style={toolBtn} onClick={() => nav('leadflow')}>LeadFlow</button>}
        {s.tools.filter(canOpen).map((t) => <button key={t} className="mm-btn" style={toolBtn} onClick={() => nav(t)}>{toolLabel(t)}</button>)}
        {s.n === 3 && canOpen('invoicing') && <button className="mm-btn" style={toolBtn} onClick={() => nav('invoicing')}>Invoicing</button>}
      </div>
      {s.checks && (
        <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.35 }}>
          {s.checks.map((c) => <li key={c}>{c}</li>)}
        </ul>
      )}
    </div>
  );

  return (
    <Page title="Clients" sub={sub} fab={{ t: 'New client', onClick: () => setAdding(true) }} menu={menu}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients" aria-label="Search clients" style={{ height: 36, padding: '0 10px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', maxWidth: phone ? undefined : 320 }} />
      {phone ? (
        // Phone: the five steps stacked, each a section with its tools and clients.
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {JOURNEY_STEPS.map((s) => { const here = byStep(s.n); return (
            <section key={s.n} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {head(s, here.length)}
              {here.map(card)}
              {!here.length && !loading && <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{emptyText(s)}</span>}
            </section>
          ); })}
        </div>
      ) : (
        // iPad / desktop: one column per step; drag a card to move it (steps with a delivery phase).
        <div className="mm-scroll-x" style={{ display: 'grid', gridTemplateColumns: `repeat(${JOURNEY_STEPS.length}, minmax(164px, 1fr))`, gap: 10, overflowX: 'auto', alignItems: 'start', paddingBottom: 4 }}>
          {JOURNEY_STEPS.map((s) => { const here = byStep(s.n); const droppable = phaseForStep(s.n) != null; return (
            <section key={s.n} aria-label={`Step ${s.n}: ${s.label}`}
              onDragOver={droppable ? (e) => { e.preventDefault(); setOver(s.n); } : undefined} onDragLeave={() => setOver(null)}
              onDrop={droppable ? (e) => { e.preventDefault(); setOver(null); const id = drag ?? e.dataTransfer.getData('text/plain'); if (id) void moveTo(id, s.n); setDrag(null); } : undefined}
              style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, borderRadius: 14, minHeight: 320, minWidth: 0, background: 'var(--surface-2)', border: `1px solid ${over === s.n ? 'var(--accent)' : 'var(--border)'}`, transition: 'border-color .15s' }}>
              {head(s, here.length)}
              <div style={{ height: 1, background: 'var(--grid)', margin: '2px 0' }} />
              {here.map(card)}
              {!here.length && !loading && <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)', padding: '6px 2px' }}>{droppable ? 'Drop a client here.' : emptyText(s)}</span>}
            </section>
          ); })}
        </div>
      )}
      {!loading && real.length === 0 && <Empty text="No clients yet. Diagnose and win one from LeadFlow's Call list, then add them here." cta="New client" onCta={() => setAdding(true)} />}
      {adding && (
        <NewDeal title="New client" onClose={() => setAdding(false)} create={create as never} onMade={(id) => onOpenClient(id)}
          extra={<button className="mm-btn" style={{ height: 40, fontSize: 13 }} onClick={() => { setAdding(false); nav('scaling-start'); }}>Or start the guided flow: idea → brand → site → plan → invoice</button>} />
      )}
    </Page>
  );
}

/** What an empty column says: sales steps fill from LeadFlow, Protect is a review. */
const emptyText = (s: (typeof JOURNEY_STEPS)[number]) => (s.checks ? 'A review for every client in steps 4–8, not a place clients sit.' : s.n === 1 ? 'New leads: work them from the Call list.' : s.phases.length ? 'No clients on this step.' : 'Deals in discovery, analysis or proposal.');
const toolBtn: CSSProperties = { height: 26, padding: '0 9px', fontSize: 12, borderRadius: 999 };
