import { useEffect, useState } from 'react';
import { useClientModulesOverview } from '../../../data/useClientModulesOverview';
import type { ClientOverviewRow } from '../../../data/useClientModulesOverview';
import { currentStation } from '../../../data/clientSpine';
import ClientPortalAdmin from '../ClientPortalAdmin';
import { STAGES } from '../clientStyles';
import Chip from '../../mm/Chip';
import type { ChipKind } from '../../mm/Chip';
import Stat from '../../mm/Stat';
import { Empty } from '../../mm/States';
import { Page, useModule } from '../../mm/Page';
import { initials } from './util';

type Props = { focusClientId: string | null; onClearFocus: () => void; onChanged?: () => void; selectedClientId?: string | null; onSelectClient?: (id: string | null) => void };

const stageLabel = (s: string) => STAGES.find((x) => x.key === s)?.label ?? s;
function ago(iso: string | null) {
  if (!iso) return 'No activity';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${Math.max(m, 1)}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : h < 48 ? 'Yesterday' : `${Math.round(h / 24)}d ago`;
}
function chipFor(r: ClientOverviewRow): { c: string; k: ChipKind } {
  if (r.openTickets) return { c: `${r.openTickets} open ${r.openTickets === 1 ? 'ticket' : 'tickets'}`, k: 'bad' };
  if (r.unreadMessages) return { c: `${r.unreadMessages} unread`, k: 'warn' };
  if (r.pendingApprovals) return { c: 'Awaiting OK', k: 'accent' };
  if (r.handoff) return { c: 'Handed off', k: 'good' };
  return { c: currentStation(r.spine)?.label ?? stageLabel(r.client.stage), k: 'neutral' };
}

export default function ClientModulesV2({ focusClientId, onClearFocus, onChanged, selectedClientId, onSelectClient }: Props) {
  const { device } = useModule();
  const phone = device === 'phone';
  const O = useClientModulesOverview();
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const pick = (id: string | null) => { setSel(id); onSelectClient?.(id); };
  useEffect(() => {
    if (focusClientId) { pick(focusClientId); onClearFocus(); return; }
    if (selectedClientId && selectedClientId !== sel) setSel(selectedClientId);
  }, [focusClientId, selectedClientId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Who needs you first: open tickets, then unread, then approvals, then recency.
  const rows = [...O.rows].sort((a, b) => (b.openTickets - a.openTickets) || (b.unreadMessages - a.unreadMessages) || (b.pendingApprovals - a.pendingApprovals) || (b.lastActivity ?? '').localeCompare(a.lastActivity ?? ''));
  const list = rows.filter((r) => !q || `${r.client.business_name} ${r.client.contact_name ?? ''}`.toLowerCase().includes(q.toLowerCase()));
  const cur = O.rows.find((r) => r.client.id === sel) ?? (phone ? null : list[0] ?? null);
  const changed = () => { O.reload(); onChanged?.(); };

  if (!O.loading && O.rows.length === 0) {
    return <Page title="Client Modules" sub="Your clients' portals"><Empty text="No clients yet. Add one in Client CRM and their portal shows up here." /></Page>;
  }
  const waiting = O.rows.filter((r) => r.openTickets || r.unreadMessages).length;
  const pipeline = STAGES.map((s) => ({ ...s, n: O.rows.filter((r) => r.client.stage === s.key).length }));

  const strip = (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${phone ? 3 : pipeline.length},minmax(0,1fr))`, gap: 8 }}>
      {pipeline.map((s) => (
        <div key={s.key} style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>
          <span style={{ color: s.n ? 'var(--text)' : 'var(--text-tertiary)', fontSize: 20, fontWeight: 600, letterSpacing: '-0.03em' }}>{s.n}</span>
        </div>
      ))}
    </div>
  );
  const listPane = (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, borderRight: phone ? 'none' : '1px solid var(--grid)' }}>
      <div style={{ padding: '12px 14px', flex: 'none' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients" aria-label="Search clients" style={{ width: '100%', boxSizing: 'border-box', height: 36, padding: '0 10px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }} />
      </div>
      <div className="mm-scroll-y" style={{ flex: 1, minHeight: 0 }}>
        {list.map((r) => { const ch = chipFor(r); const st = currentStation(r.spine); return (
          <button key={r.client.id} onClick={() => pick(r.client.id)} className="mm-dash-tr" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', width: '100%', textAlign: 'left', border: 0, borderTop: '1px solid var(--grid)', background: cur?.client.id === r.client.id && !phone ? 'var(--surface-3)' : 'transparent', cursor: 'pointer', fontFamily: 'inherit', minHeight: 60 }}>
            <div style={{ width: 34, height: 34, flex: 'none', borderRadius: 10, background: 'color-mix(in srgb, var(--client-accent) 18%, var(--surface-3))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', fontSize: 11.5, fontWeight: 600 }}>{initials(r.client.business_name)}</div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.client.business_name}</span><span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{ago(r.lastActivity)}</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}><Chip k={ch.k}>{ch.c}</Chip><span style={{ fontSize: 12.5, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st && st.label !== ch.c ? st.label : stageLabel(r.client.stage)}</span></div>
            </div>
          </button>
        ); })}
        {list.length === 0 && <div style={{ padding: '18px 14px', fontSize: 14, color: 'var(--text-tertiary)' }}>No matches.</div>}
      </div>
    </div>
  );
  const detail = cur && <Detail key={cur.client.id} r={cur} onBack={phone ? () => pick(null) : undefined} onChanged={changed} />;

  return (
    <Page title="Client Modules" sub={O.loading ? 'Loading…' : waiting ? `${waiting} ${waiting === 1 ? 'client' : 'clients'} waiting on you` : 'Nothing waiting on you'}>
      {phone ? (cur ? detail : <>{strip}<section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>{listPane}</section></>) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>
            <Stat label="Clients" value={String(O.rows.length)} pill={`${O.rows.filter((r) => r.hasLogin).length} with a login`} />
            <Stat label="Open tickets" value={String(O.rows.reduce((s, r) => s + r.openTickets, 0))} pill={`${waiting} waiting on you`} k={waiting ? 'warn' : 'good'} />
            <Stat label="Awaiting OK" value={String(O.rows.reduce((s, r) => s + r.pendingApprovals, 0))} pill="Client approvals" />
            <Stat label="Handed off" value={String(O.rows.filter((r) => r.handoff).length)} pill="Handoff mode on" k={O.rows.some((r) => r.handoff) ? 'good' : 'neutral'} />
          </div>
          {strip}
          <section style={{ display: 'grid', gridTemplateColumns: device === 'desktop' ? '380px minmax(0,1fr)' : '320px minmax(0,1fr)', height: 'calc(100vh - 300px)', minHeight: 560, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', minWidth: 0 }}>
            {listPane}{detail}
          </section>
        </>
      )}
    </Page>
  );
}

function Detail({ r, onBack, onChanged }: { r: ClientOverviewRow; onBack?: () => void; onChanged: () => void }) {
  const cur = r.spine.findIndex((s) => s.state === 'active');
  const doneN = r.spine.filter((s) => s.state === 'done').length;
  const fields: [string, string][] = [['Stage', stageLabel(r.client.stage)], ['Contact', r.client.contact_name ?? '—'], ['Portal login', r.hasLogin ? 'Yes' : 'Not yet'], ['Open tickets', String(r.openTickets)], ['Unread', String(r.unreadMessages)], ['Handoff', r.handoff ? 'On' : 'Off']];
  return (
    <div className="mm-scroll-y" style={{ minWidth: 0, minHeight: 0, background: onBack ? 'var(--surface)' : undefined, border: onBack ? '1px solid var(--border)' : undefined, borderRadius: onBack ? 16 : undefined }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: onBack ? 18 : '22px 26px' }}>
        {onBack && <button className="mm-btn" onClick={onBack} style={{ alignSelf: 'flex-start', height: 34 }}>‹ All clients</button>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <h2 style={{ margin: 0, color: 'var(--text)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em' }}>{r.client.business_name}</h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><Chip k={chipFor(r).k}>{chipFor(r).c}</Chip><span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{stageLabel(r.client.stage)}</span></div>
          </div>
          <span style={{ color: 'var(--text)', fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em', whiteSpace: 'nowrap' }}>{r.spine.length ? `Step ${Math.min(r.spine.length, cur >= 0 ? cur + 1 : doneN)} of ${r.spine.length}` : ''}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: onBack ? 'repeat(2,minmax(0,1fr))' : 'repeat(3,minmax(0,1fr))', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {fields.map(([l, v], i) => <div key={l} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 14px', borderTop: i >= (onBack ? 2 : 3) ? '1px solid var(--grid)' : 'none', borderLeft: i % (onBack ? 2 : 3) ? '1px solid var(--grid)' : 'none' }}><span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>{l}</span><span style={{ color: 'var(--text)', fontSize: 14, fontWeight: 500 }}>{v}</span></div>)}
        </div>
        {r.spine.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 10 }}>Progress</span>
            {r.spine.map((s, i) => {
              const done = s.state === 'done', now = s.state === 'active';
              return (
                <div key={s.key} style={{ display: 'flex', gap: 12 }}>
                  <div style={{ width: 22, flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', boxSizing: 'border-box', background: done ? 'var(--client-accent)' : 'transparent', border: done ? 'none' : now ? '2px solid var(--client-accent)' : '1.5px solid var(--border)', color: 'var(--bg)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{done ? '✓' : ''}</div>
                    <div style={{ flex: 1, width: 2, minHeight: 12, background: i === r.spine.length - 1 ? 'transparent' : done ? 'var(--client-accent)' : 'var(--grid)' }} />
                  </div>
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', gap: 8, padding: '1px 0 14px', minWidth: 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                      <span style={{ color: done || now ? 'var(--text)' : 'var(--text-secondary)', fontSize: 14.5, fontWeight: 500 }}>{s.label}</span>
                      <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{s.detail}{s.overridden ? ' · set by hand' : ''}</span>
                    </div>
                    {now && <Chip k="client">Now</Chip>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ borderTop: '1px solid var(--grid)', paddingTop: 6 }}>
          <ClientPortalAdmin client={r.client} onChanged={onChanged} />
        </div>
      </div>
    </div>
  );
}
