import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Page, useModule } from '../../mm/Page';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import { Empty } from '../../mm/States';
import { checklistFor, ROOMS, roomOf, dropPatch, phaseProgress, nextStep, waitingOnMarq, singlePoint, ringFor, phaseOf, daysSince } from '../../../data/madeby';
import type { CheckItem } from '../../../data/madeby';

interface Client { id: string; business_name: string; stage: string; delivery_phase: number | null; room: string | null; client_type: string | null; last_contact_at: string | null; last_activity_at: string }
const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const hue = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

/** Classroom (brief §5.3): the whole business as a floor plan. One room per
 *  delivery phase plus APHS and own brands; each client is an avatar.
 *  Dragging an avatar writes the same phase field the CRM uses. */
export default function ClassroomScreen() {
  const { device, nav } = useModule();
  const phone = device === 'phone';
  const [clients, setClients] = useState<Client[]>([]);
  const [items, setItems] = useState<CheckItem[]>([]);
  const [pick, setPick] = useState<Client | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [moved, setMoved] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const load = useCallback(async () => {
    const [c, i] = await Promise.all([
      supabase.from('crm_clients').select('id,business_name,stage,delivery_phase,room,client_type,last_contact_at,last_activity_at').order('business_name'),
      supabase.from('client_checklist').select('*'),
    ]);
    setMissing(!!c.error || !!i.error);
    setClients((c.data ?? []) as Client[]); setItems((i.data ?? []) as CheckItem[]);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const now = new Date();
  const waiting = useMemo(() => waitingOnMarq(items, now), [items]); // eslint-disable-line react-hooks/exhaustive-deps
  const spof = useMemo(() => new Set(singlePoint(items)), [items]);
  const waitDays = (id: string) => { const w = waiting.filter((x) => x.item.client_id === id); return w.length ? Math.max(...w.map((x) => x.days)) : null; };
  const placed = clients.filter((c) => roomOf(c));
  const unplaced = clients.filter((c) => !roomOf(c) && (c.stage === 'active' || c.stage === 'retainer'));

  const moveTo = async (clientId: string, roomKey: string) => {
    const c = clients.find((x) => x.id === clientId); if (!c || roomOf(c) === roomKey) return;
    const patch = dropPatch(roomKey);
    setClients((xs) => xs.map((x) => (x.id === clientId ? { ...x, ...patch, delivery_phase: patch.delivery_phase ?? x.delivery_phase } : x)));
    setMoved(clientId); setTimeout(() => setMoved(null), 900);
    await supabase.from('crm_clients').update({ ...patch, ...(patch.delivery_phase ? { phase_started_at: new Date().toISOString() } : {}), updated_at: new Date().toISOString() }).eq('id', clientId);
    // Entering a phase for the first time seeds its checklist (same as the CRM).
    if (patch.delivery_phase && !items.some((i) => i.client_id === clientId && i.phase === patch.delivery_phase)) {
      await supabase.from('client_checklist').insert(checklistFor(patch.delivery_phase, new Date().toISOString().slice(0, 10)).map((r) => ({ ...r, client_id: clientId })));
    }
    await load();
  };

  if (missing) return <Page title="Classroom"><Empty text="Classroom needs the October migration (schema_125) applied." /></Page>;
  return (
    <Page title="Classroom" sub="Every client, standing in their phase. Drag one to move it.">
      <style>{`@keyframes crIdle{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}} @keyframes crArrive{0%{transform:scale(.6);opacity:.2}60%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}} @media (prefers-reduced-motion: reduce){.cr-av{animation:none!important}}`}</style>
      <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : 'minmax(0,1fr) 320px', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr 1fr' : 'repeat(4, minmax(0,1fr))', gap: 10 }}>
          {ROOMS.map((r) => {
            const here = placed.filter((c) => roomOf(c) === r.key);
            return (
              <div key={r.key} onDragOver={(e) => { e.preventDefault(); setOver(r.key); }} onDragLeave={() => setOver(null)} onDrop={(e) => { e.preventDefault(); setOver(null); const id = drag ?? e.dataTransfer.getData('text/plain'); if (id) void moveTo(id, r.key); setDrag(null); }}
                style={{ minHeight: 150, borderRadius: 16, border: `2px ${over === r.key ? 'solid var(--accent)' : 'solid var(--border)'}`, background: `color-mix(in srgb, ${r.phase ? 'var(--accent)' : 'var(--text-tertiary)'} ${r.phase ? 4 + r.phase * 2 : 5}%, var(--surface))`, padding: 10, display: 'flex', flexDirection: 'column', gap: 8, transition: 'border-color .15s', gridColumn: !phone && r.key === 'own' ? 'span 2' : undefined }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{r.label}</span>
                  <span style={{ fontSize: 11.5, padding: '2px 8px', borderRadius: 999, border: '1px solid var(--border)', color: 'var(--text-secondary)', background: 'var(--surface)' }}>🚪 {here.length}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {here.map((c, i) => {
                    const ring = ringFor(waitDays(c.id));
                    return (
                      <button key={c.id} draggable onDragStart={(e) => { setDrag(c.id); e.dataTransfer.setData('text/plain', c.id); }} onClick={() => setPick(c)} className="cr-av" title={c.business_name}
                        style={{ all: 'unset', cursor: 'grab', width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', background: `hsl(${hue(c.business_name)} 45% 45%)`, boxShadow: ring === 'none' ? '0 1px 2px rgba(0,0,0,.2)' : `0 0 0 3px var(--surface), 0 0 0 6px ${ring === 'red' ? 'var(--danger)' : 'var(--warning)'}`, animation: moved === c.id ? 'crArrive .7s ease-out' : `crIdle ${2.4 + (i % 3) * 0.4}s ease-in-out ${i * 0.2}s infinite` }}>
                        {initials(c.business_name)}
                      </button>
                    );
                  })}
                  {!here.length && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Empty</span>}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="Waiting on you" meta={`${waiting.length} open · you're the only blocker on ${spof.size}`}>
            {waiting.length === 0 && <div style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Nothing is waiting on you. 🎉</div>}
            {waiting.slice(0, 12).map((w, i) => {
              const c = clients.find((x) => x.id === w.item.client_id);
              return (
                <button key={w.item.id} onClick={() => c && setPick(c)} style={{ all: 'unset', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', borderTop: i ? '1px solid var(--grid)' : 'none' }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13.5 }}><strong>{c?.business_name ?? 'Client'}</strong> · {w.item.title}</span>
                  <Chip k={w.days > 3 ? 'bad' : 'warn'}>{w.days}d</Chip>
                </button>
              );
            })}
          </Card>
          {unplaced.length > 0 && (
            <Card title="Not in a room yet" meta="active clients without a phase">
              {unplaced.map((c) => <button key={c.id} draggable onDragStart={(e) => { setDrag(c.id); e.dataTransfer.setData('text/plain', c.id); }} onClick={() => void moveTo(c.id, 'phase-1')} className="mm-btn" style={{ justifyContent: 'flex-start' }}>{c.business_name} → Phase 1</button>)}
            </Card>
          )}
        </div>
      </div>
      {pick && <MiniCard c={pick} items={items.filter((i) => i.client_id === pick.id)} waitDays={waitDays(pick.id)} onClose={() => setPick(null)} onOpen={() => nav('client-crm')} onMove={(k) => { void moveTo(pick.id, k); setPick(null); }} now={now} />}
    </Page>
  );
}

function MiniCard({ c, items, waitDays, onClose, onOpen, onMove, now }: { c: Client; items: CheckItem[]; waitDays: number | null; onClose: () => void; onOpen: () => void; onMove: (room: string) => void; now: Date }) {
  const phase = phaseOf(c.delivery_phase);
  const prog = phase ? phaseProgress(items, phase.n) : null;
  const step = phase ? nextStep(items, phase.n) : null;
  const last = c.last_contact_at ?? c.last_activity_at;
  return (
    <div role="dialog" aria-label={c.business_name} onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(0,0,0,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 380, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 20px 50px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><strong style={{ flex: 1, fontSize: 16 }}>{c.business_name}</strong><button className="mm-btn" style={{ height: 30 }} onClick={onClose}>✕</button></div>
        <div style={{ fontSize: 14 }}>{phase ? `Phase ${phase.n} · ${phase.label} — ${prog?.pct ?? 0}% through` : c.room === 'aphs' ? 'APHS room' : c.room === 'own' ? 'Own brands' : 'No phase yet'}</div>
        {prog && <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-2)', overflow: 'hidden' }}><div style={{ width: `${prog.pct}%`, height: '100%', background: 'var(--accent)', transition: 'width .4s' }} /></div>}
        <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>Next: {step?.title ?? '—'}</div>
        <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>Waiting on: {step ? (step.owner === 'marq' ? <Chip k={ringFor(waitDays) === 'red' ? 'bad' : 'warn'}>you · {waitDays ?? 0}d</Chip> : step.owner) : '—'}</div>
        <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>Last contact: {daysSince(last, now)}d ago</div>
        <select className="mm-btn" style={{ height: 38 }} value="" onChange={(e) => e.target.value && onMove(e.target.value)} aria-label="Move to room"><option value="">Move to…</option>{ROOMS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}</select>
        <button className="mm-btn mm-btn--primary" style={{ height: 40 }} onClick={onOpen}>Open in Client CRM</button>
      </div>
    </div>
  );
}
