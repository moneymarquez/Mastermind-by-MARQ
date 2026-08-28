import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { useClientCRM, CrmClientWithChildren } from '../../data/useClientCRM';
import type { ClientStage, PricingCadence } from '../../data/types';
import { AiError } from '../../lib/ai';
import { STAGES, cardStyle, inputStyle, selectStyle, primaryBtn, ghostBtn, tabStyle } from './ClientCRMScreen';
import ClientReportsTab from './ClientReportsTab';
import LiveCaptureView from './LiveCaptureView';
import type { AnswerConfidence } from '../../data/types';

interface Props {
  client: CrmClientWithChildren;
  crm: ReturnType<typeof useClientCRM>;
  onBack: () => void;
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

type Tab = 'audit' | 'analysis' | 'pricing' | 'invoices' | 'reports';

const textareaStyle: CSSProperties = {
  width: '100%', minHeight: 70, background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)',
  padding: '10px 13px', color: 'var(--text)', fontSize: 'var(--text-body)', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box',
};

function money(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** A null amount is TBD — undecided, not merely hidden. Rendered as the
 *  word rather than a placeholder number so nothing implies a commitment
 *  that hasn't been made. */
function amountLabel(amount: number | null): string {
  return amount === null ? 'TBD' : money(amount);
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
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogCategory, setCatalogCategory] = useState('');
  const [tbdDraft, setTbdDraft] = useState<Record<string, string>>({});
  const [liveCapture, setLiveCapture] = useState(false);
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState('');
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
  const confidence = client.audit?.answer_confidence ?? {};
  const suggestions = client.audit?.suggested_services ?? [];

  const startAudit = async () => {
    await crm.ensureAudit(client.id);
  };

  const saveAnswer = async (key: string, value: string) => {
    if (!client.audit) return;
    await crm.saveAnswer(client.audit.id, key, value, answers);
  };

  // Analysis and the service match are the two branches of the same fork
  // in the system flow, so they run together off one click rather than
  // making him remember to trigger the matcher separately. A matcher
  // failure never blocks the analysis — the written plan is the thing
  // that has to land.
  const runGenerate = async () => {
    setGenerating(true);
    setGenError('');
    try {
      if (!client.audit) return;
      if (client.audit.status === 'complete') {
        await crm.regenerateAnalysis(client.audit.id, client.business_name, answers, confidence);
      } else {
        await crm.completeAudit(client.id, client.audit.id, client.business_name, answers, confidence);
      }
      setTab('analysis');
      try {
        await crm.runServiceMatch(client.audit.id, client.business_name, answers, confidence);
      } catch {
        setMatchError('Analysis is ready, but the service match failed — retry it from the Pricing tab.');
      }
    } catch (err) {
      setGenError(err instanceof AiError ? err.message : 'Could not generate the analysis — try again.');
    } finally {
      setGenerating(false);
    }
  };

  const runMatch = async () => {
    if (!client.audit) return;
    setMatching(true);
    setMatchError('');
    try {
      await crm.runServiceMatch(client.audit.id, client.business_name, answers, confidence);
    } catch (err) {
      setMatchError(err instanceof AiError ? err.message : 'Could not match services — try again.');
    } finally {
      setMatching(false);
    }
  };

  const setTag = (key: string, tag: AnswerConfidence) => {
    if (!client.audit) return;
    const next = { ...confidence };
    if (next[key] === tag) delete next[key];
    else next[key] = tag;
    crm.setAnswerConfidence(client.audit.id, next);
  };

  const saveAnalysisEdit = async () => {
    if (!client.audit) return;
    await crm.editAnalysisText(client.audit.id, analysisDraft);
  };

  // A blank amount is allowed and means TBD — that's the whole point of
  // being able to send Month 1 without committing to Months 2-4 in writing.
  const addPricingItem = async () => {
    if (!newItemLabel.trim()) return;
    const raw = newItemAmount.trim();
    const amount = raw === '' ? null : Number(raw);
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) return;
    await crm.addPricingItem(client.id, {
      label: newItemLabel.trim(),
      amount,
      cadence: newItemCadence,
      repeat_count: newItemCadence === 'monthly' ? Number(newItemRepeat) || 1 : 1,
    });
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

  if (liveCapture && client.audit) {
    return (
      <LiveCaptureView
        businessName={client.business_name}
        questions={activeQuestions}
        auditId={client.audit.id}
        initialAnswers={answers}
        initialConfidence={confidence}
        saveAnswers={crm.saveAnswerQuiet}
        saveConfidence={crm.setAnswerConfidence}
        onExit={() => { setLiveCapture(false); crm.reload(); }}
      />
    );
  }

  return (
    <div>
      <div style={{ display: 'inline-flex', alignItems: 'center', fontSize: 'var(--text-body)', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: 14 }} onClick={onBack}>
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
        <div style={tabStyle(tab === 'reports')} onClick={() => setTab('reports')}>Reports</div>
      </div>

      {tab === 'reports' && <ClientReportsTab clientId={client.id} publicToken={client.public_token} />}

      {tab === 'audit' && (
        <div style={{ marginTop: 18, maxWidth: 640 }}>
          {!client.audit ? (
            <div style={cardStyle}>
              <div style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)', marginBottom: 12 }}>No discovery answers yet for this client.</div>
              <div style={primaryBtn} onClick={startAudit}>Start audit</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>On a call right now?</div>
                  <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 3 }}>
                    One question at a time, big fields, autosaves as you type.
                  </div>
                </div>
                <div style={primaryBtn} onClick={() => setLiveCapture(true)}>Live capture</div>
              </div>

              {activeQuestions.map((q) => (
                <div key={q.id} style={cardStyle}>
                  <div style={{ fontSize: 'var(--text-micro)', fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>{q.category}</div>
                  <div style={{ fontSize: 'var(--text-body-lg)', fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>{q.prompt}</div>
                  <textarea
                    key={`${q.key}-${answers[q.key] ?? ''}`}
                    style={textareaStyle}
                    defaultValue={answers[q.key] ?? ''}
                    onBlur={(e) => saveAnswer(q.key, e.target.value)}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)' }}>Confidence:</span>
                    {(['confirmed', 'estimated'] as AnswerConfidence[]).map((tag) => (
                      <div
                        key={tag}
                        onClick={() => setTag(q.key, tag)}
                        style={{
                          padding: '4px 11px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-tiny)', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                          border: `1px solid ${confidence[q.key] === tag ? 'transparent' : 'var(--border-2)'}`,
                          background: confidence[q.key] === tag ? (tag === 'confirmed' ? 'var(--success)' : 'var(--warning)') : 'transparent',
                          color: confidence[q.key] === tag ? '#0A0B0D' : 'var(--text-tertiary)',
                        }}
                      >
                        {tag}
                      </div>
                    ))}
                    {!confidence[q.key] && <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-quaternary)' }}>untagged — treated as estimated</span>}
                  </div>
                  {q.helper_text && <div style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)', marginTop: 8, fontStyle: 'italic' }}>{q.helper_text}</div>}
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ ...primaryBtn, pointerEvents: generating ? 'none' : 'auto', opacity: generating ? 0.6 : 1 }} onClick={runGenerate}>
                  {generating ? 'Generating…' : client.audit.status === 'complete' ? 'Regenerate analysis' : 'Generate analysis'}
                </div>
                {genError && <span style={{ fontSize: 'var(--text-body-sm)', color: 'var(--danger)' }}>{genError}</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'analysis' && (
        <div style={{ marginTop: 18, maxWidth: 680 }}>
          {!client.audit?.analysis_text ? (
            <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>No analysis generated yet — fill out the Audit tab and click Generate.</div>
          ) : (
            <>
              <textarea
                style={{ ...textareaStyle, minHeight: 420, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-body-lg)', lineHeight: 1.7 }}
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
                {genError && <span style={{ fontSize: 'var(--text-body-sm)', color: 'var(--danger)' }}>{genError}</span>}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'pricing' && (
        <div style={{ marginTop: 18, maxWidth: 680 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div
              style={{ display: 'inline-flex', alignItems: 'center', width: 40, height: 22, borderRadius: 'var(--radius-pill)', background: client.reveal_full_schedule ? 'var(--text)' : 'var(--border-2)', cursor: 'pointer', padding: 2 }}
              onClick={() => crm.setRevealSchedule(client.id, !client.reveal_full_schedule)}
            >
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--bg)', transform: client.reveal_full_schedule ? 'translateX(18px)' : 'translateX(0)', transition: 'transform 150ms ease' }} />
            </div>
            <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)' }}>
              Reveal full payment schedule to client — {client.reveal_full_schedule ? 'ON, they see every future payment' : 'OFF, they only see what\'s currently due'}
            </div>
          </div>

          {client.pricingItems.length === 0 && (
            <div style={{ ...cardStyle, marginBottom: 16 }}>
              <div style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)', marginBottom: 12 }}>No pricing plan yet for this client.</div>
              <div style={primaryBtn} onClick={() => crm.applyTemplateToClient(client.id)}>Use default template</div>
            </div>
          )}

          {/* Service Matcher output — the branch that runs alongside the
              written analysis, flagging what this business actually needs. */}
          <div style={{ ...cardStyle, marginBottom: 16, borderColor: suggestions.length ? 'var(--warning)' : 'var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>
                ✨ Nova's suggested services{suggestions.length ? ` (${suggestions.length})` : ''}
              </div>
              <div
                style={{ ...ghostBtn, pointerEvents: matching || !client.audit ? 'none' : 'auto', opacity: matching || !client.audit ? 0.5 : 1 }}
                onClick={runMatch}
              >
                {matching ? 'Matching…' : suggestions.length ? 'Re-match' : 'Match services'}
              </div>
            </div>
            {matchError && <div style={{ fontSize: 'var(--text-small)', color: 'var(--danger)', marginTop: 8 }}>{matchError}</div>}
            {!client.audit && <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 8 }}>Fill out the audit first — the match reads from those answers.</div>}
            {suggestions.length === 0 && client.audit && !matchError && (
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 8 }}>
                Nothing flagged yet. Runs automatically when you generate the analysis.
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: suggestions.length ? 12 : 0 }}>
              {suggestions.map((s) => {
                const svc = crm.services.find((x) => x.name === s.name);
                const alreadyAdded = client.pricingItems.some((p) => p.service_id && svc && p.service_id === svc.id);
                return (
                  <div key={s.name} style={{ padding: '11px 13px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-4)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--text-body-sm)', fontWeight: 600, color: 'var(--text)' }}>{s.name}</div>
                        <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                          {s.category}{svc ? ` · ${money(svc.default_price)}${svc.price_type === 'monthly' ? '/mo' : ''}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                        {alreadyAdded ? (
                          <span style={{ fontSize: 'var(--text-tiny)', color: 'var(--success)', fontWeight: 600 }}>Added</span>
                        ) : svc ? (
                          <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text)', cursor: 'pointer', fontWeight: 600 }} onClick={() => crm.addServiceToClient(client.id, svc)}>Add</span>
                        ) : null}
                        <span
                          style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)', cursor: 'pointer' }}
                          onClick={() => client.audit && crm.dismissSuggestion(client.audit.id, s.name, suggestions)}
                        >
                          Dismiss
                        </span>
                      </div>
                    </div>
                    {s.reason && <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>{s.reason}</div>}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {client.pricingItems.map((item) => {
              const isTbd = item.amount === null;
              return (
                <div key={item.id} style={{ ...cardStyle, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>{item.label}</div>
                    <div style={{ fontSize: 'var(--text-caption)', color: isTbd ? 'var(--warning)' : 'var(--text-secondary)', marginTop: 2 }}>
                      {amountLabel(item.amount)} {item.cadence === 'monthly' ? `/mo × ${item.repeat_count}` : 'one-time'}
                      {isTbd && ' — not shown to the client, not invoiceable'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {/* Quick-switch for the launch fee — $1,000 standard,
                        $500 a deliberate tight-budget override. */}
                    {item.is_upfront && !isTbd && (
                      <div style={{ display: 'inline-flex', background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-pill)', padding: 2 }}>
                        {[1000, 500].map((amt) => (
                          <div
                            key={amt}
                            onClick={() => crm.setItemAmount(item.id, amt)}
                            style={{
                              padding: '4px 11px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-caption)', fontWeight: 600, cursor: 'pointer',
                              background: Number(item.amount) === amt ? 'var(--text)' : 'transparent',
                              color: Number(item.amount) === amt ? 'var(--bg)' : 'var(--text-secondary)',
                            }}
                          >
                            ${amt.toLocaleString()}
                          </div>
                        ))}
                      </div>
                    )}
                    {isTbd ? (
                      <>
                        <input
                          style={{ ...inputStyle, width: 90 }}
                          placeholder="Set $"
                          value={tbdDraft[item.id] ?? ''}
                          onChange={(e) => setTbdDraft((d) => ({ ...d, [item.id]: e.target.value }))}
                        />
                        <div
                          style={ghostBtn}
                          onClick={() => {
                            const n = Number(tbdDraft[item.id]);
                            if (!Number.isFinite(n) || n < 0) return;
                            crm.setItemAmount(item.id, n);
                            setTbdDraft((d) => ({ ...d, [item.id]: '' }));
                          }}
                        >
                          Confirm
                        </div>
                      </>
                    ) : (
                      <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={() => crm.setItemAmount(item.id, null)}>Mark TBD</span>
                    )}
                    <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={() => crm.removePricingItem(item.id)}>Remove</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ ...cardStyle, marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>Add from service catalog</div>
              <div style={ghostBtn} onClick={() => setCatalogOpen((o) => !o)}>{catalogOpen ? 'Hide' : 'Browse'}</div>
            </div>
            {catalogOpen && (
              <div style={{ marginTop: 12 }}>
                <select style={selectStyle} value={catalogCategory} onChange={(e) => setCatalogCategory(e.target.value)}>
                  <option value="">— all categories —</option>
                  {[...new Set(crm.services.filter((s) => s.active).map((s) => s.category))].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
                  {crm.services
                    .filter((s) => s.active && (!catalogCategory || s.category === catalogCategory))
                    .map((s) => (
                      <div
                        key={s.id}
                        onClick={() => crm.addServiceToClient(client.id, s)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-4)', cursor: 'pointer' }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text)' }}>{s.name}</div>
                          <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                            {s.category}{s.notes ? ` · ${s.notes}` : ''}
                          </div>
                        </div>
                        <div style={{ fontSize: 'var(--text-small)', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {money(s.default_price)}{s.price_type === 'monthly' ? '/mo' : ''}
                        </div>
                      </div>
                    ))}
                  {crm.services.length === 0 && (
                    <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)' }}>Catalog is empty — seed it by running schema_040.</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={{ ...cardStyle, marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input style={{ ...inputStyle, flex: '2 1 160px' }} placeholder="Custom line item label" value={newItemLabel} onChange={(e) => setNewItemLabel(e.target.value)} />
            <input style={{ ...inputStyle, flex: '1 1 90px' }} placeholder="Amount (blank = TBD)" value={newItemAmount} onChange={(e) => setNewItemAmount(e.target.value)} />
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
            {client.invoices.length === 0 && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>No invoices sent yet.</div>}
            {client.invoices.map((inv) => (
              <div key={inv.id} style={{ ...cardStyle, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>{inv.description}</div>
                  <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: 2 }}>
                    {money(inv.amount)} {inv.due_date ? `· due ${inv.due_date}` : ''} {inv.stripe_invoice_url && (
                      <a href={inv.stripe_invoice_url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)' }}> · View invoice ↗</a>
                    )}
                  </div>
                </div>
                <span style={{
                  fontSize: 'var(--text-micro)', fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', borderRadius: 'var(--radius-pill)', padding: '3px 9px',
                  color: inv.status === 'paid' ? 'var(--success)' : inv.status === 'overdue' ? 'var(--danger)' : 'var(--text-tertiary)',
                  border: `1px solid ${inv.status === 'paid' ? 'color-mix(in srgb, var(--success) 40%, transparent)' : inv.status === 'overdue' ? 'color-mix(in srgb, var(--danger) 40%, transparent)' : 'var(--border)'}`,
                }}>
                  {inv.status}
                </span>
              </div>
            ))}
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Send a new invoice</div>
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
                {/* TBD items are excluded rather than shown disabled —
                    there's no amount to invoice, and listing them invites
                    sending a number that was never agreed. Confirm the
                    amount on the Pricing tab first. */}
                {client.pricingItems.filter((p) => p.amount !== null).map((item) => (
                  <option key={item.id} value={item.id}>{item.label} ({money(item.amount as number)})</option>
                ))}
              </select>
              {client.pricingItems.some((p) => p.amount === null) && (
                <div style={{ fontSize: 'var(--text-tiny)', color: 'var(--warning)' }}>
                  {client.pricingItems.filter((p) => p.amount === null).length} TBD line item(s) hidden — set an amount on the Pricing tab to invoice them.
                </div>
              )}
              <input style={inputStyle} placeholder="Description" value={invoiceDesc} onChange={(e) => setInvoiceDesc(e.target.value)} />
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={inputStyle} placeholder="Amount" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} />
                <input style={inputStyle} type="date" value={invoiceDue} onChange={(e) => setInvoiceDue(e.target.value)} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ ...primaryBtn, pointerEvents: sendingInvoice ? 'none' : 'auto', opacity: sendingInvoice ? 0.6 : 1 }} onClick={sendInvoice}>
                  {sendingInvoice ? 'Sending…' : 'Send invoice'}
                </div>
                {invoiceError && <span style={{ fontSize: 'var(--text-body-sm)', color: 'var(--danger)' }}>{invoiceError}</span>}
              </div>
              <div style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)' }}>Generates a real Stripe invoice and emails it to the client's contact email — nothing auto-charges.</div>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={() => { crm.removeClient(client.id); onBack(); }}>
          Delete client
        </span>
      </div>
    </div>
  );
}
