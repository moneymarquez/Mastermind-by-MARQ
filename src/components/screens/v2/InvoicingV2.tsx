import { useEffect, useState } from 'react';
import { useClientDocuments } from '../../../data/useClientDocuments';
import type { ClientDocument } from '../../../data/useClientDocuments';
import { useContacts } from '../../../data/useContacts';
import { DOC_TYPE_LABELS } from '../../../data/documentSchemas';
import type { DocType } from '../../../data/documentSchemas';
import { computeInvoiceTotal } from '../../../data/invoiceAmount';
import { DocumentDetail, NewDocumentPanel, BusinessProfilePanel } from '../InvoicingScreen';
import Chip from '../../mm/Chip';
import type { ChipKind } from '../../mm/Chip';
import Stat from '../../mm/Stat';
import { Empty } from '../../mm/States';
import { Page, Sheet, useModule } from '../../mm/Page';
import { initials, shortDate, usd, ymd } from './util';

const TYPES = Object.keys(DOC_TYPE_LABELS) as DocType[];
const dueOf = (d: ClientDocument) => (typeof d.data.due_date === 'string' && d.data.due_date ? d.data.due_date : null);
const clientOf = (d: ClientDocument) => (typeof d.data.client_name === 'string' && d.data.client_name ? d.data.client_name : null);

/** Status chip for a document, invoices by money state. Pure. */
export function docChip(d: ClientDocument, today: string): { c: string; k: ChipKind } {
  if (d.doc_type !== 'invoice') return { c: DOC_TYPE_LABELS[d.doc_type] ?? 'Document', k: 'neutral' };
  if (d.status === 'paid') return { c: d.paid_at ? `Paid ${shortDate(d.paid_at.slice(0, 10))}` : 'Paid', k: 'good' };
  if (d.status === 'draft') return { c: 'Draft', k: 'neutral' };
  const due = dueOf(d);
  if (due && due < today) { const n = Math.round((Date.parse(today) - Date.parse(due)) / 86400000); return { c: `${n} ${n === 1 ? 'day' : 'days'} overdue`, k: 'bad' }; }
  return { c: due ? `Due ${shortDate(due)}` : 'Sent', k: 'warn' };
}

export default function InvoicingV2() {
  const { device } = useModule();
  const phone = device === 'phone';
  const D = useClientDocuments();
  const { contacts } = useContacts();
  const [sel, setSel] = useState<string | null>(null);
  const [fresh, setFresh] = useState(false);
  const [type, setType] = useState<DocType | 'all'>('all');
  const [q, setQ] = useState('');
  const [view, setView] = useState<'new' | 'profile' | null>(null);
  const today = ymd(new Date());
  const who = (d: ClientDocument) => clientOf(d) ?? (d.contact_id ? contacts.find((c) => c.id === d.contact_id)?.name ?? null : null);

  const list = D.documents.filter((d) => (type === 'all' || d.doc_type === type) && (!q || `${d.label} ${who(d) ?? ''}`.toLowerCase().includes(q.toLowerCase())));
  useEffect(() => { if (!phone && !sel && list[0]) setSel(list[0].id); }, [phone, sel, list]);
  const cur = D.documents.find((d) => d.id === sel) ?? null;
  const menu = [{ t: 'New document', onClick: () => setView('new') }, { t: 'Business profile', onClick: () => setView('profile') }];
  const sheets = (
    <>
      {view === 'new' && <Sheet title="New document" onClose={() => setView(null)} full><NewDocumentPanel onCreated={async (id) => { await D.reload(); setView(null); setFresh(true); setSel(id); }} /></Sheet>}
      {view === 'profile' && <Sheet title="Business profile" onClose={() => setView(null)}><BusinessProfilePanel /></Sheet>}
    </>
  );

  if (!D.loading && D.documents.length === 0) {
    return <Page title="Invoicing" sub="Invoices and client documents" menu={menu}><Empty text="No documents yet. Start an invoice or any of the client documents, already filled in from a contact." cta="New document" onCta={() => setView('new')} />{sheets}</Page>;
  }

  const inv = D.documents.filter((d) => d.doc_type === 'invoice');
  const sent = inv.filter((d) => d.status === 'sent');
  const overdue = sent.filter((d) => { const due = dueOf(d); return due && due < today; });
  const month = today.slice(0, 7);
  const paidM = inv.filter((d) => d.status === 'paid' && (d.paid_at ?? d.updated_at).slice(0, 7) === month);
  const sum = (a: ClientDocument[]) => a.reduce((s, d) => s + computeInvoiceTotal(d.data), 0);

  const listPane = (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, borderRight: phone ? 'none' : '1px solid var(--grid)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', flex: 'none' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search documents" aria-label="Search documents" style={{ flex: 1, minWidth: 0, height: 36, padding: '0 10px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }} />
          {!phone && <button className="mm-btn mm-btn--primary" style={{ height: 36, fontSize: 13 }} onClick={() => setView('new')}>Invoice</button>}
        </div>
        <select value={type} onChange={(e) => setType(e.target.value as DocType | 'all')} aria-label="Document type" style={{ height: 34, padding: '0 8px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }}>
          <option value="all">All documents ({D.documents.length})</option>
          {TYPES.map((t) => <option key={t} value={t}>{DOC_TYPE_LABELS[t]} ({D.documents.filter((d) => d.doc_type === t).length})</option>)}
        </select>
      </div>
      <div className="mm-scroll-y" style={{ flex: 1, minHeight: 0 }}>
        {list.map((d) => { const ch = docChip(d, today); const name = who(d) ?? d.label; return (
          <button key={d.id} onClick={() => { setFresh(false); setSel(d.id); }} className="mm-dash-tr" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', width: '100%', textAlign: 'left', border: 0, borderTop: '1px solid var(--grid)', background: cur?.id === d.id && !phone ? 'var(--surface-3)' : 'transparent', cursor: 'pointer', fontFamily: 'inherit', minHeight: 60 }}>
            <div style={{ width: 32, height: 32, flex: 'none', borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', fontSize: 11.5, fontWeight: 600 }}>{initials(name)}</div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span><span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{d.doc_type === 'invoice' ? usd(computeInvoiceTotal(d.data), 2) : shortDate(d.updated_at.slice(0, 10))}</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}><Chip k={ch.k}>{ch.c}</Chip><span style={{ fontSize: 12.5, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.label}</span></div>
            </div>
          </button>
        ); })}
        {list.length === 0 && <div style={{ padding: '18px 14px', fontSize: 14, color: 'var(--text-tertiary)' }}>No matches.</div>}
      </div>
    </div>
  );
  const detail = cur ? (
    <div className="mm-scroll-y" style={{ minWidth: 0, minHeight: 0 }}>
      <div style={{ padding: phone ? 16 : '22px 26px' }}>
        <DocumentDetail key={cur.id} doc={cur} onBack={() => { setSel(null); void D.reload(); }} startTab={fresh ? 'edit' : 'preview'} />
      </div>
    </div>
  ) : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 14 }}>Pick a document on the left.</div>;

  return (
    <Page title="Invoicing" sub="Invoices and client documents" menu={menu} fab={phone && !cur ? { t: 'Invoice', onClick: () => setView('new') } : undefined}>
      {phone ? <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>{cur ? detail : listPane}</section> : (
        <>
          <section style={{ display: 'grid', gridTemplateColumns: device === 'desktop' ? '380px minmax(0,1fr)' : '320px minmax(0,1fr)', height: 'calc(100vh - 330px)', minHeight: 560, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', minWidth: 0 }}>
            {listPane}{detail}
          </section>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>
            <Stat label="Outstanding" value={usd(sum(sent))} pill={`${sent.length} ${sent.length === 1 ? 'invoice' : 'invoices'}`} />
            <Stat label="Overdue" value={usd(sum(overdue))} pill={overdue.length ? `${overdue.length} ${overdue.length === 1 ? 'invoice' : 'invoices'}` : 'None'} k={overdue.length ? 'bad' : 'neutral'} />
            <Stat label="Paid this month" value={usd(sum(paidM))} pill={`${paidM.length} paid`} k={paidM.length ? 'good' : 'neutral'} />
            <Stat label="Drafts" value={String(inv.filter((d) => d.status === 'draft').length)} pill="Not sent yet" />
          </div>
        </>
      )}
      {sheets}
    </Page>
  );
}
