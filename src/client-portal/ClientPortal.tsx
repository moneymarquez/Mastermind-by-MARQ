import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { supabase } from '../lib/supabase';
import type { AuditQuestion, ClientAudit, ClientInvoice, CrmClient } from '../data/types';

interface Props {
  onSignOut: () => void;
}

const shell: CSSProperties = { minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', padding: '28px 20px 60px' };
const container: CSSProperties = { maxWidth: 720, margin: '0 auto' };
const cardStyle: CSSProperties = {
  background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 18,
};
const sectionTitle: CSSProperties = { fontSize: 'var(--text-label)', fontWeight: 700, color: 'var(--text)', margin: '32px 0 12px' };

function money(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function statusColor(status: ClientInvoice['status']): string {
  if (status === 'paid') return 'var(--success)';
  if (status === 'draft') return 'var(--text-tertiary)';
  return 'var(--danger)'; // sent / overdue — unpaid reads as red, per spec
}

/** The client-role dashboard (Step 1 of the client-login build) — a real,
 *  separate login scoped to exactly one crm_clients row via RLS
 *  (schema_045_client_login.sql). Every query below is unfiltered on
 *  purpose: RLS's `client_id = my_client_id()` policies do the scoping,
 *  so there is no client-side id to get wrong. Read-only — a client never
 *  writes here, matching the "their own dashboard, not their own edit
 *  surface" scope from the build prompt. */
export default function ClientPortal({ onSignOut }: Props) {
  const [client, setClient] = useState<CrmClient | null>(null);
  const [audit, setAudit] = useState<ClientAudit | null>(null);
  const [questions, setQuestions] = useState<AuditQuestion[]>([]);
  const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [clientRes, auditsRes, questionsRes, invoicesRes] = await Promise.all([
        supabase.from('crm_clients').select('*').maybeSingle(),
        supabase.from('client_audits').select('*').order('created_at', { ascending: false }),
        supabase.from('audit_questions').select('*').order('sort_order'),
        supabase.from('client_invoices').select('*').order('created_at', { ascending: true }),
      ]);
      setClient((clientRes.data as CrmClient) ?? null);
      setAudit(((auditsRes.data ?? [])[0] as ClientAudit) ?? null);
      setQuestions((questionsRes.data ?? []) as AuditQuestion[]);
      setInvoices((invoicesRes.data ?? []) as ClientInvoice[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div style={shell} />;

  if (!client) {
    return (
      <div style={shell}>
        <div style={container}>
          <div style={cardStyle}>Nothing set up for this login yet — check back soon, or reach out to Marq.</div>
          <div style={{ marginTop: 20, fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={onSignOut}>Sign out</div>
        </div>
      </div>
    );
  }

  const answers = audit?.answers ?? {};
  const answeredQuestions = questions.filter((q) => (answers[q.key] ?? '').trim().length > 0);

  return (
    <div style={shell}>
      <div style={container}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)' }}>Welcome back</div>
            <div style={{ fontSize: 'var(--text-head)', fontWeight: 700, marginTop: 2 }}>{client.business_name}</div>
          </div>
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)', cursor: 'pointer', flexShrink: 0 }} onClick={onSignOut}>Sign out</div>
        </div>

        {audit?.analysis_text && (
          <>
            <div style={sectionTitle}>Your plan</div>
            <div style={{ ...cardStyle, whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 'var(--text-body)' }}>{audit.analysis_text}</div>
          </>
        )}

        <div style={sectionTitle}>Invoices</div>
        {invoices.length === 0 && (
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>Nothing sent yet.</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {invoices.map((inv) => (
            <div key={inv.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 'var(--text-body)', fontWeight: 600 }}>{inv.description}</div>
                <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: 3 }}>
                  {money(inv.amount)}{inv.due_date ? ` · due ${inv.due_date}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <span style={{
                  fontSize: 'var(--text-micro)', fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', borderRadius: 'var(--radius-pill)', padding: '3px 9px',
                  color: statusColor(inv.status), border: `1px solid color-mix(in srgb, ${statusColor(inv.status)} 40%, transparent)`,
                }}>
                  {inv.status}
                </span>
                {inv.status !== 'paid' && inv.stripe_invoice_url && (
                  <a
                    href={inv.stripe_invoice_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ padding: '8px 16px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--text)', color: 'var(--bg)', fontSize: 'var(--text-body-sm)', fontWeight: 600, textDecoration: 'none' }}
                  >
                    Pay now
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {answeredQuestions.length > 0 && (
          <>
            <div style={sectionTitle}>Your audit</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {answeredQuestions.map((q) => (
                <div key={q.id} style={cardStyle}>
                  <div style={{ fontSize: 'var(--text-micro)', fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>{q.category}</div>
                  <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginBottom: 8 }}>{q.prompt}</div>
                  <div style={{ fontSize: 'var(--text-body)', whiteSpace: 'pre-wrap' }}>{answers[q.key]}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
