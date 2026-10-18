import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import type { Brand } from '../../../../data/ecom';
import { useOrders } from '../../../../data/useEcomOctober';
import Card from '../../../mm/Card';

/** Inbox: mail to the stores' own domains (the support-inbox pipeline, per
 *  store domain) and orders with a problem. Approvals have their own tab. */
export default function InboxSection({ brands }: { brands: Brand[] }) {
  const [mail, setMail] = useState<{ id: string; from_email: string | null; subject: string | null; to_email: string | null; created_at: string; status: string }[]>([]);
  const orders = useOrders(30);
  const domains = brands.map((b) => (b.domain ?? '').replace(/\s*\(bought\)$/, '').trim().toLowerCase()).filter(Boolean);
  useEffect(() => {
    if (!domains.length) { setMail([]); return; }
    supabase.from('support_inbox').select('id,from_email,subject,to_email,created_at,status').order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => setMail(((data ?? []) as typeof mail).filter((m) => domains.some((d) => (m.to_email ?? '').toLowerCase().endsWith(`@${d}`)))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domains.join(',')]);
  const problems = orders.rows.filter((o) => o.problem || o.supplier_status === 'problem');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card title="Customer email" meta={domains.length ? `to ${domains.join(', ')}` : 'store domains'} flush>
        {mail.length === 0 ? <div style={{ padding: '4px 0 12px', fontSize: 14, color: 'var(--text-secondary)' }}>{domains.length ? 'No customer email yet.' : 'Once a store has its own domain (Brand Lab → step 5) and the domain routes mail to Masterminds, customer email lands here.'}</div> : mail.map((m, i) => (
          <div key={m.id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderTop: i ? '1px solid var(--grid)' : 'none', fontSize: 14 }}><span style={{ flex: 1, minWidth: 0 }}><span style={{ color: 'var(--text)' }}>{m.subject ?? '(no subject)'}</span><span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-tertiary)' }}>{m.from_email} → {m.to_email}</span></span><span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></div>
        ))}
      </Card>
      <Card title="Order problems" meta="last 30 days" flush>
        {problems.length === 0 ? <div style={{ padding: '4px 0 12px', fontSize: 14, color: 'var(--text-secondary)' }}>No order problems.</div> : problems.map((o, i) => <div key={o.id} style={{ padding: '10px 0', borderTop: i ? '1px solid var(--grid)' : 'none', fontSize: 14 }}><span style={{ color: 'var(--text)' }}>{o.order_number ?? o.external_id} · ${Number(o.total).toFixed(2)}</span><span style={{ display: 'block', color: 'var(--warning)', fontSize: 13 }}>{o.problem}</span></div>)}
      </Card>
    </div>
  );
}
