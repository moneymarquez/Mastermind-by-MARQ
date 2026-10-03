import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useClientCRM } from '../../../data/useClientCRM';
import type { ClientStage } from '../../../data/types';
import ClientDetailView from '../ClientDetailView';
import AllInvoicesView from '../AllInvoicesView';
import { AuditQuestionsAdmin, PricingTemplateAdmin, ServiceCatalogAdmin } from '../ClientCRMAdmin';
import { STAGES } from '../clientStyles';
import Chip from '../../mm/Chip';
import type { ChipKind } from '../../mm/Chip';
import Stat from '../../mm/Stat';
import { Empty } from '../../mm/States';
import { Page, Sheet, Field, field, useModule } from '../../mm/Page';
import { initials, usd } from './util';

type Props = {
  focusClientId?: string | null; onClearFocus?: () => void; selectedClientId?: string | null; onSelectClient?: (id: string | null) => void;
  onPushToMarketing?: (id: string) => void; onOpenCampaign?: (id: string) => void; onStartCampaign?: (id: string) => void;
};
type Client = ReturnType<typeof useClientCRM>['clients'][number];

const STAGE_K: Record<ClientStage, ChipKind> = { new_lead: 'neutral', discovery_complete: 'neutral', analysis_sent: 'accent', invoice_sent: 'warn', active: 'good', retainer: 'good' };
const stageLabel = (s: ClientStage) => STAGES.find((x) => x.key === s)?.label ?? s;
const billed = (c: Client) => c.invoices.filter((i) => i.status !== 'void').reduce((s, i) => s + i.amount, 0);
const owed = (c: Client) => c.invoices.filter((i) => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.amount, 0);
const head: CSSProperties = { color: 'var(--text)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.2 };
const sub: CSSProperties = { fontSize: 13, fontWeight: 500, color: 'var(--text-tertiary)', marginTop: 4 };

export default function ClientCRMV2({ focusClientId, onClearFocus, selectedClientId, onSelectClient, onPushToMarketing, onOpenCampaign, onStartCampaign }: Props) {
  const { device } = useModule();
  const phone = device === 'phone';
  const crm = useClientCRM();
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [stage, setStage] = useState<ClientStage | 'all'>('all');
  const [view, setView] = useState<'invoices' | 'questions' | 'template' | 'catalog' | null>(null);
  const [adding, setAdding] = useState(false);
  const pick = (id: string | null) => { setSel(id); onSelectClient?.(id); };
  useEffect(() => {
    if (focusClientId) { pick(focusClientId); onClearFocus?.(); return; }
    if (selectedClientId && selectedClientId !== sel) setSel(selectedClientId);
  }, [focusClientId, selectedClientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const menu = [
    { t: 'All invoices', onClick: () => setView('invoices') },
    { t: 'Service catalog', onClick: () => setView('catalog') },
    { t: 'Default pricing template', onClick: () => setView('template') },
    { t: 'Audit questions', onClick: () => setView('questions') },
  ];
  const sheets = (
    <>
      {adding && <NewDeal onClose={() => setAdding(false)} create={crm.createClient} onMade={(id) => pick(id)} />}
      {view === 'invoices' && <Sheet title="All invoices" onClose={() => setView(null)} full><AllInvoicesView crm={crm} homeHeadStyle={head} homeSubStyle={sub} /></Sheet>}
      {view === 'questions' && <Sheet title="Audit questions" onClose={() => setView(null)} full><AuditQuestionsAdmin crm={crm} onClose={() => setView(null)} homeHeadStyle={head} homeSubStyle={sub} /></Sheet>}
      {view === 'template' && <Sheet title="Default pricing template" onClose={() => setView(null)} full><PricingTemplateAdmin crm={crm} onClose={() => setView(null)} homeHeadStyle={head} homeSubStyle={sub} /></Sheet>}
      {view === 'catalog' && <Sheet title="Service catalog" onClose={() => setView(null)} full><ServiceCatalogAdmin crm={crm} onClose={() => setView(null)} homeHeadStyle={head} homeSubStyle={sub} /></Sheet>}
    </>
  );

  if (crm.loading) return <Page title="Client CRM" sub="Loading…"><span /></Page>;
  if (crm.clients.length === 0) {
    return <Page title="Client CRM" sub="Discovery → pricing → invoice → active" menu={menu}><Empty text="No deals yet. Add a lead and walk it from discovery to an active client." cta="New deal" onCta={() => setAdding(true)} />{sheets}</Page>;
  }

  const list = crm.clients.filter((c) => (stage === 'all' || c.stage === stage) && (!q || `${c.business_name} ${c.contact_name ?? ''}`.toLowerCase().includes(q.toLowerCase())));
  const cur = crm.clients.find((c) => c.id === sel) ?? null;
  const group = (keys: ClientStage[]) => crm.clients.filter((c) => keys.includes(c.stage));
  const kfmt = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(n % 1000 ? 1 : 0)}k` : usd(n));
  const disc = group(['new_lead', 'discovery_complete']), pricing = group(['analysis_sent']), inv = group(['invoice_sent']), act = group(['active', 'retainer']);

  const listPane = (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, borderRight: phone ? 'none' : '1px solid var(--grid)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', flex: 'none' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search deals" aria-label="Search deals" style={{ flex: 1, minWidth: 0, height: 36, padding: '0 10px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }} />
          {!phone && <button className="mm-btn mm-btn--primary" style={{ height: 36, fontSize: 13 }} onClick={() => setAdding(true)}>New deal</button>}
        </div>
        <select value={stage} onChange={(e) => setStage(e.target.value as ClientStage | 'all')} aria-label="Stage" style={{ height: 34, padding: '0 8px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }}>
          <option value="all">All stages ({crm.clients.length})</option>
          {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label} ({crm.clients.filter((c) => c.stage === s.key).length})</option>)}
        </select>
      </div>
      <div className="mm-scroll-y" style={{ flex: 1, minHeight: 0 }}>
        {list.map((c) => (
          <button key={c.id} onClick={() => pick(c.id)} className="mm-dash-tr" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', width: '100%', textAlign: 'left', border: 0, borderTop: '1px solid var(--grid)', background: cur?.id === c.id && !phone ? 'var(--surface-3)' : 'transparent', cursor: 'pointer', fontFamily: 'inherit', minHeight: 60 }}>
            <div style={{ width: 32, height: 32, flex: 'none', borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', fontSize: 11.5, fontWeight: 600 }}>{initials(c.business_name)}</div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.business_name}</span><span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{billed(c) ? usd(billed(c)) : ''}</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}><Chip k={owed(c) && c.invoices.some((i) => i.status === 'overdue') ? 'bad' : STAGE_K[c.stage]}>{c.invoices.some((i) => i.status === 'overdue') ? 'Overdue' : stageLabel(c.stage)}</Chip><span style={{ fontSize: 12.5, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.contact_name ?? (c.source === 'public' ? 'Public audit' : '')}</span></div>
            </div>
          </button>
        ))}
        {list.length === 0 && <div style={{ padding: '18px 14px', fontSize: 14, color: 'var(--text-tertiary)' }}>No deals here.</div>}
      </div>
    </div>
  );
  const detail = cur ? (
    <div className="mm-scroll-y" style={{ minWidth: 0, minHeight: 0 }}>
      <div style={{ padding: phone ? 16 : '22px 26px' }}>
        <ClientDetailView key={cur.id} client={cur} crm={crm} onBack={() => pick(null)} homeHeadStyle={head} homeSubStyle={sub} onPushToMarketing={onPushToMarketing} onOpenCampaign={onOpenCampaign} onStartCampaign={onStartCampaign} />
      </div>
    </div>
  ) : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 14 }}>Pick a deal on the left.</div>;

  return (
    <Page title="Client CRM" sub="Discovery → pricing → invoice → active" menu={menu} fab={phone && !cur ? { t: 'New deal', onClick: () => setAdding(true) } : undefined}>
      {phone ? (
        <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>{cur ? detail : listPane}</section>
      ) : (
        <>
          <section style={{ display: 'grid', gridTemplateColumns: device === 'desktop' ? '380px minmax(0,1fr)' : '320px minmax(0,1fr)', height: 'calc(100vh - 330px)', minHeight: 560, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', minWidth: 0 }}>
            {listPane}{detail}
          </section>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>
            <Stat label="Discovery" value={String(disc.length)} pill="New + discovery done" />
            <Stat label="Pricing" value={String(pricing.length)} pill="Analysis sent" />
            <Stat label="Invoice" value={String(inv.length)} pill={`${kfmt(inv.reduce((s, c) => s + owed(c), 0))} owed`} k={inv.length ? 'warn' : 'neutral'} />
            <Stat label="Active" value={String(act.length)} pill={`${kfmt(act.reduce((s, c) => s + billed(c), 0))} billed`} k={act.some((c) => billed(c) > 0) ? 'good' : 'neutral'} />
          </div>
        </>
      )}
      {sheets}
    </Page>
  );
}

function NewDeal({ onClose, create, onMade }: { onClose: () => void; create: ReturnType<typeof useClientCRM>['createClient']; onMade: (id: string) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [tel, setTel] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title="New deal" onClose={onClose}>
      <Field l="Business name"><input value={name} onChange={(e) => setName(e.target.value)} style={field} autoFocus /></Field>
      <Field l="Contact email (optional)"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={field} /></Field>
      <Field l="Contact phone (optional)"><input type="tel" value={tel} onChange={(e) => setTel(e.target.value)} style={field} /></Field>
      <button className="mm-btn mm-btn--primary" style={{ height: 48, fontSize: 15 }} disabled={busy || !name.trim()} onClick={async () => { setBusy(true); const c = await create({ business_name: name.trim(), contact_email: email.trim() || null, contact_phone: tel.trim() || null }); onClose(); if (c) onMade(c.id); }}>{busy ? 'Creating…' : 'Create'}</button>
    </Sheet>
  );
}
