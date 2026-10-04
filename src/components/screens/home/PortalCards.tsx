import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { portalName } from '../../../portals.config';
import type { PortalKey } from '../../../portals.config';
import { GChevron } from '../../shell/glyphs';

// One summary card per other portal the account can open, on the
// Masterminds Home. Every figure reads a table its module already reads,
// with the same filters; each card loads on its own and fails on its own.

type Figures = { main: number; mainLabel: string; subs: [string, number][]; empty: string };
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

async function rows(table: string, cols: string, f?: (q: any) => any): Promise<any[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
  let q = supabase.from(table).select(cols);
  if (f) q = f(q);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

const LOADERS: Record<Exclude<PortalKey, 'masterminds'>, () => Promise<Figures>> = {
  // Client CRM's "Active" column (active + retainer), Client Modules' open
  // tickets, and Invoicing's sent or overdue invoices.
  madeby: async () => {
    const [clients, tickets, invoices] = await Promise.all([
      rows('crm_clients', 'id, stage'),
      rows('client_tickets', 'id, status', (q) => q.eq('status', 'open')),
      rows('client_invoices', 'id, status', (q) => q.in('status', ['sent', 'overdue'])),
    ]);
    const active = clients.filter((c) => c.stage === 'active' || c.stage === 'retainer').length;
    return { main: active, mainLabel: active === 1 ? 'Active client' : 'Active clients', subs: [['Open tickets', tickets.length], ['Unpaid invoices', invoices.length]], empty: 'No active clients yet.' };
  },
  // Content's calendar (anything not posted, scheduled in the next 7 days),
  // connected accounts, and the Content workers' drafts waiting on you.
  content: async () => {
    const today = new Date(), end = new Date(); end.setDate(end.getDate() + 6);
    const [items, accounts, drafts] = await Promise.all([
      rows('content_items', 'id, status, scheduled_for', (q) => q.gte('scheduled_for', ymd(today)).lte('scheduled_for', ymd(end))),
      rows('social_accounts', 'id'),
      rows('ai_approvals', 'id', (q) => q.eq('domain', 'content').eq('status', 'pending')),
    ]);
    const week = items.filter((i) => i.status !== 'posted').length;
    return { main: week, mainLabel: week === 1 ? 'Post scheduled this week' : 'Posts scheduled this week', subs: [['Accounts', accounts.length], ['Drafts waiting', drafts.length]], empty: 'Nothing scheduled this week.' };
  },
  // E-commerce approvals queue, brands, and enabled E-commerce workers.
  ecommerce: async () => {
    const [waiting, brands, workers] = await Promise.all([
      rows('ai_approvals', 'id', (q) => q.eq('domain', 'ecom').eq('status', 'pending')),
      rows('ecom_brands', 'id'),
      rows('ai_workers', 'id', (q) => q.eq('domain', 'ecom').eq('enabled', true)),
    ]);
    return { main: waiting.length, mainLabel: 'Waiting for approval', subs: [['Brands', brands.length], ['Live workers', workers.length]], empty: 'Nothing waiting for approval.' };
  },
};

function PortalCard({ portal, onOpen }: { portal: Exclude<PortalKey, 'masterminds'>; onOpen: () => void }) {
  const [state, setState] = useState<{ f?: Figures; failed?: boolean }>({});
  useEffect(() => {
    let live = true;
    LOADERS[portal]().then((f) => live && setState({ f }), () => live && setState({ failed: true }));
    return () => { live = false; };
  }, [portal]);
  const { f, failed } = state;
  const allZero = f && f.main === 0 && f.subs.every(([, n]) => n === 0);
  return (
    <button onClick={onOpen} className="mm-dash-tr" aria-label={`Open ${portalName(portal)}`}
      style={{ textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, color: 'inherit' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="mm-pdot" data-p={portal} />
        <span style={{ flex: 1, color: 'var(--text)', fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em' }}>{portalName(portal)}</span>
        <GChevron size={14} color="var(--text-tertiary)" />
      </span>
      {failed ? <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Couldn't load</span>
        : !f ? <span style={{ height: 52, borderRadius: 8, background: 'var(--surface-3)', opacity: 0.6 }} aria-label="Loading" />
        : allZero ? <span style={{ fontSize: 14, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>{f.empty}</span>
        : (
          <>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ color: 'var(--text)', fontSize: 28, fontWeight: 700, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}>{f.main}</span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{f.mainLabel}</span>
            </span>
            <span style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-tertiary)' }}>
              {f.subs.map(([l, n]) => <span key={l}><span style={{ color: 'var(--text)', fontWeight: 600 }}>{n}</span> {l}</span>)}
            </span>
          </>
        )}
    </button>
  );
}

export default function PortalCards({ portals, phone, onOpen }: { portals: PortalKey[]; phone: boolean; onOpen: (k: PortalKey) => void }) {
  const others = portals.filter((k): k is Exclude<PortalKey, 'masterminds'> => k !== 'masterminds');
  if (!others.length) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: phone ? 'minmax(0, 1fr)' : `repeat(${Math.min(3, others.length)}, minmax(0, 1fr))`, gap: phone ? 12 : 16 }}>
      {others.map((k) => <PortalCard key={k} portal={k} onOpen={() => onOpen(k)} />)}
    </div>
  );
}
