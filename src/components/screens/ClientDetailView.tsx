import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { useClientCRM, CrmClientWithChildren } from '../../data/useClientCRM';
import type { ClientStage, PricingCadence } from '../../data/types';
import { AiError } from '../../lib/ai';
import { STAGES, cardStyle, inputStyle, selectStyle, primaryBtn, ghostBtn, tabStyle } from './ClientCRMScreen';

interface Props {
  client: CrmClientWithChildren;
  crm: ReturnType<typeof useClientCRM>;
  onBack: () => void;
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

type Tab = 'audit' | 'analysis' | 'pricing' | 'invoices';

const textareaStyle: CSSProperties = {
  width: '100%', minHeight: 70, background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 8,
  padding: '10px 13px', color: 'var(--text)', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box',
};

function money(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default function ClientDetailView({ client, crm, onBack, homeHeadStyle, homeSubStyle }: Props) {
  const [tab, setTab] = useState<Tab>(client.audit?.status === 'complete' ? 'analysis' : 'audit');
  const [nameDraft, setNameDraft] = useState(client.business_name);
  const [emailDraft, setEmailDraft] = useState(client.contact_email ?? '');
  const [phoneDraft, setPhoneDraft] = useState(client.contact_phone ?? '');
  const [notesDraft, setNotesDraft] = useState(client.notes ?? '');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [analysisDraft, setAnalysisDraft] = useState(client.audit?.analysis_text ?? '');
  const [newItemLabel, setNewItemLabel] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('');
  const [newItemCadence, setNewItemCadence] = useState<PricingCadence>('one_time');
  const [newItemRepeat, setNewItemRepeat] = useState('1');
  const [invoiceItemId, setInvoiceItemId] = useState('');
  const [invoiceDesc, setInvoiceDesc] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceDue, setInvoiceDue] = useState('');
  const [sendingInvoice, setSendingInvoice] = useState(false);
  const [invoiceError, setInvoiceError] = useState('');

  useEffect(() => {
    setAnalysisDraft(client.audit?.analysis_text ?? '');
  }, [client.audit?.analysis_text]);

  const activeQuestions = crm.questions.filter((q) => q.active).sort((a, b) => a.sort_order - b.sort_order);
  const answers = client.audit?.answers ?? {};

  const startAudit = async () => {
    await crm.ensureAudit(client.id);
  };

  const saveAnswer = async (key: string, value: string) => {
    if (!client.audit) return;
    await crm.saveAnswer(client.audit.id, key, value, answers);
  };

  const runGenerate = async () => {
    setGenerating(true);
    setGenError('');
    try {
      if (!client.audit) return;
      if (client.audit.status === 'complete') {
        await crm.regenerateAnalysis(client.audit.id, client.business_name, answers);
      } else {
        await crm.completeAudit(client.id, client.audit.id, client.business_name, answers);
      }
      setTab('analysis');
    } catch (err) {
      setGenError(err instanceof AiError ? err.message : 'Could not generate the analysis — try again.');
    } finally {
      setGenerating(false);
    }
  };

  const saveAnalysisEdit = async () => {
    if (!client.audit) return;
    await crm.editAnalysisText(client.audit.id, analysisDraft);
  };

  const addPricingItem = async () => {
    const amount = Number(newItemAmount);
    if (!newItemLabel.trim() || !amount || amount <= 0) return;
    await crm.addPricingItem(client.id, { label: newItemLabel.trim(), amount, cadence: newItemCadence, repeat_count: newItemCadence === 'monthly' ? Number(newItemRepeat) || 1 : 1 });
    setNewItemLabel('');
    setNewItemAmount('');
    setNewItemRepeat('1');
  };

  const sendInvoice = async () => {
    const item = client.pricingItems.find((p) => p.id === invoiceItemId);
    const description = invoiceDesc.trim() || item?.label || '';
    const amount = Number(invoiceAmount) || item?.amount || 0;
    if (!description || amount <= 0) return;
    setSendingInvoice(true);
    setInvoiceError('');
    try {
      const sequenceIndex = item ? client.invoices.filter((i) => i.pricing_item_id === item.id).length + 1 : 1;
      await crm.createInvoice({ clientId: client.id, pricingItemId: item?.id ?? null, sequenceIndex, description, amount, dueDate: invoiceDue || null });
      setInvoiceDesc('');
      setInvoiceAmount('');
      setInvoiceDue('');
      setInvoiceItemId('');
    } catch (err) {
      setInvoiceError(err instanceof Error ? err.message : 'Could not send the invoice.');
    } finally {
      setSendingInvoice(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'inline-flex', alignItems: 'center', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: 14 }} onClick={onBack}>
        ← All clients
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <input
            style={{ ...homeHeadStyle, background: 'transparent', border: 'none', outline: 'none', padding: 0, fontFamily: 'inherit' } as CSSProperties}
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => nameDraft.trim() && nameDraft !== client.business_name && crm.updateClient(client.id, { business_name: nameDraft.trim() })}
          />
          <div style={homeSubStyle}>Stage: {STAGES.find((s) => s.key === client.stage)?.label}</div>
        </div>
        <select style={{ ...selectStyle, width: 'auto' }} value={client.stage} onChange={(e) => crm.setStage(client.id, e.target.value as ClientStage)}>
          {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap', maxWidth: 640 }}>
        <input style={inputStyle} placeholder="Contact email" value={emailDraft} onChange={(e) => setEmailDraft(e.target.value)} onBlur={() => emailDraft !== (client.contact_email ?? '') && crm.updateClient(client.id, { contact_email: emailDraft.trim() || null })} />
        <input style={inputStyle} placeholder="Contact phone" value={phoneDraft} onChange={(e) => setPhoneDraft(e.target.value)} onBlur={() => phoneDraft !== (client.contact_phone ?? '') && crm.updateClient(client.id, { contact_phone: phoneDraft.trim() || null })} />
      </div>
      <textarea
        style={{ ...textareaStyle, marginTop: 10, maxWidth: 640, minHeight: 50 }}
        placeholder="Notes…"
        value={notesDraft}
        onChange={(e) => setNotesDraft(e.target.value)}
        onBlur={() => notesDraft !== (client.notes ?? '') && crm.updateClient(client.id, { notes: notesDraft.trim() || null })}
      />

      <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
        <div style={tabStyle(tab === 'audit')} onClick={() => setTab('audit')}>Audit</div>
        <div style={tabStyle(tab === 'analysis')} onClick={() => setTab('analysis')}>Analysis</div>
        <div style={tabStyle(tab === 'pricing')} onClick={() => setTab('pricing')}>Pricing</div>
        <div style={tabStyle(tab === 'invoices')} onClick={() => setTab('invoices')}>Invoices ({client.invoices.length})</div>
      </div>

      {tab === 'audit' && (
        <div style={{ marginTop: 18, maxWidth: 640 }}>
          {!client.audit ? (
            <div style={cardStyle}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>No discovery answers yet for this client.</div>
              <div style={primaryBtn} onClick={startAudit}>Start audit</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {activeQuestions.map((q) => (
                <div key={q.id} style={cardStyle}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>{q.category}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>{q.prompt}</div>
                  <textarea
                    style={textareaStyle}
                    defaultValue={answers[q.key] ?? ''}
                    onBlur={(e) => saveAnswer(q.key, e.target.value)}
                  />
                  {q.helper_text && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8, fontStyle: 'italic' }}>{q.helper_text}</div>}
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ ...primaryBtn, pointerEvents: generating ? 'none' : 'auto', opacity: generating ? 0.6 : 1 }} onClick={runGenerate}>
                  {generating ? 'Generating…' : client.audit.status === 'complete' ? 'Regenerate analysis' : 'Generate analysis'}
                </div>
                {genError && <span style={{ fontSize: 12.5, color: '#c47a7a' }}>{genError}</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'analysis' && (
        <div style={{ marginTop: 18, maxWidth: 680 }}>
          {!client.audit?.analysis_text ? (
            <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>No analysis generated yet — fill out the Audit tab and click Generate.</div>
          ) : (
            <>
              <textarea
                style={{ ...textareaStyle, minHeight: 420, fontFamily: "'JetBrains Mono', monospace", fontSize: 13.5, lineHeight: 1.7 }}
                value={analysisDraft}
                onChange={(e) => setAnalysisDraft(e.target.value)}
                onBlur={saveAnalysisEdit}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ ...ghostBtn, pointerEvents: generating ? 'none' : 'auto', opacity: generating ? 0.6 : 1 }} onClick={runGenerate}>
                  {generating ? 'Regenerating…' : 'Regenerate from current answers'}
                </div>
                {client.stage !== 'analysis_sent' && client.stage !== 'invoice_sent' && client.stage !== 'active' && client.stage !== 'retainer' && (
                  <div style={primaryBtn} onClick={() => crm.markAnalysisSent(client.id)}>Mark analysis sent</div>
                )}
                {genError && <span style={{ fontSize: 12.5, color: '#c47a7a' }}>{genError}</span>}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'pricing' && (
        <div style={{ marginTop: 18, maxWidth: 680 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div
              style={{ display: 'inline-flex', alignItems: 'center', width: 40, height: 22, borderRadius: 999, background: client.reveal_full_schedule ? 'var(--text)' : 'var(--border-2)', cursor: 'pointer', padding: 2 }}
              onClick={() => crm.setRevealSchedule(client.id, !client.reveal_full_schedule)}
            >
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--bg)', transform: client.reveal_full_schedule ? 'translateX(18px)' : 'translateX(0)', transition: 'transform 150ms ease' }} />
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              Reveal full payment schedule to client — {client.reveal_full_schedule ? 'ON, they see every future payment' : 'OFF, they only see what\'s currently due'}
            </div>
          </div>

          {client.pricingItems.length === 0 && (
            <div style={{ ...cardStyle, marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>No pricing plan yet for this client.</div>
              <div style={primaryBtn} onClick={() => crm.applyTemplateToClient(client.id)}>Use default template</div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {client.pricingItems.map((item) => (
              <div key={item.id} style={{ ...cardStyle, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{item.label}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {money(item.amount)} {item.cadence === 'monthly' ? `/mo × ${item.repeat_count}` : 'one-time'}
                  </div>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={() => crm.removePricingItem(item.id)}>Remove</span>
              </div>
            ))}
          </div>

          <div style={{ ...cardStyle, marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input style={{ ...inputStyle, flex: '2 1 160px' }} placeholder="Line item label" value={newItemLabel} onChange={(e) => setNewItemLabel(e.target.value)} />
            <input style={{ ...inputStyle, flex: '1 1 90px' }} placeholder="Amount" value={newItemAmount} onChange={(e) => setNewItemAmount(e.target.value)} />
            <select style={{ ...selectStyle, flex: '1 1 100px' }} value={newItemCadence} onChange={(e) => setNewItemCadence(e.target.value as PricingCadence)}>
              <option value="one_time">One-time</option>
              <option value="monthly">Monthly</option>
            </select>
            {newItemCadence === 'monthly' && (
              <input style={{ ...inputStyle, flex: '0 1 70px' }} placeholder="× months" value={newItemRepeat} onChange={(e) => setNewItemRepeat(e.target.value)} />
            )}
            <div style={primaryBtn} onClick={addPricingItem}>Add</div>
          </div>
        </div>
      )}

      {tab === 'invoices' && (
        <div style={{ marginTop: 18, maxWidth: 680 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {client.invoices.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>No invoices sent yet.</div>}
            {client.invoices.map((inv) => (
              <div key={inv.id} style={{ ...cardStyle, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{inv.description}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {money(inv.amount)} {inv.due_date ? `· due ${inv.due_date}` : ''} {inv.stripe_invoice_url && (
                      <a href={inv.stripe_invoice_url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)' }}> · View invoice ↗</a>
                    )}
                  </div>
                </div>
                <span style={{
                  fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', borderRadius: 999, padding: '3px 9px',
                  color: inv.status === 'paid' ? '#4a9a5a' : inv.status === 'overdue' ? '#c47a7a' : 'var(--text-tertiary)',
                  border: `1px solid ${inv.status === 'paid' ? '#4a9a5a66' : inv.status === 'overdue' ? '#c47a7a66' : 'var(--border)'}`,
                }}>
                  {inv.status}
                </span>
              </div>
            ))}
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Send a new invoice</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <select
                style={selectStyle}
                value={invoiceItemId}
                onChange={(e) => {
                  setInvoiceItemId(e.target.value);
                  const item = client.pricingItems.find((p) => p.id === e.target.value);
                  if (item) { setInvoiceDesc(item.label); setInvoiceAmount(String(item.amount)); }
                }}
              >
                <option value="">— free-form / custom —</option>
                {client.pricingItems.map((item) => <option key={item.id} value={item.id}>{item.label} ({money(item.amount)})</option>)}
              </select>
              <input style={inputStyle} placeholder="Description" value={invoiceDesc} onChange={(e) => setInvoiceDesc(e.target.value)} />
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={inputStyle} placeholder="Amount" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} />
                <input style={inputStyle} type="date" value={invoiceDue} onChange={(e) => setInvoiceDue(e.target.value)} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ ...primaryBtn, pointerEvents: sendingInvoice ? 'none' : 'auto', opacity: sendingInvoice ? 0.6 : 1 }} onClick={sendInvoice}>
                  {sendingInvoice ? 'Sending…' : 'Send invoice'}
                </div>
                {invoiceError && <span style={{ fontSize: 12.5, color: '#c47a7a' }}>{invoiceError}</span>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Generates a real Stripe invoice and emails it to the client's contact email — nothing auto-charges.</div>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={() => { crm.removeClient(client.id); onBack(); }}>
          Delete client
        </span>
      </div>
    </div>
  );
}
