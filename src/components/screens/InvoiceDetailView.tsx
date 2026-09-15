import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { useClientCRM } from '../../data/useClientCRM';
import type { ClientInvoice } from '../../data/types';
import { cardStyle, inputStyle, primaryBtn, ghostBtn } from './ClientCRMScreen';
import InvoiceDocument from '../InvoiceDocument';
import ProductSheetDocument from '../ProductSheetDocument';
import RecurringPlanDocument from '../RecurringPlanDocument';
import { useBusinessProfile } from '../../data/useBusinessProfile';

interface Props {
  invoice: ClientInvoice;
  clientBusinessName: string;
  crm: ReturnType<typeof useClientCRM>;
  onClose: () => void;
}

function money(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// Strips the "(ongoing $X/mo after this)" suffix createBundledDraftInvoice
// adds to a monthly item's label when this invoice charges something
// other than its stored rate — redundant on the Recurring Plan doc,
// which IS that disclosure, spelled out with its own $/mo column.
function stripOngoingSuffix(label: string): string {
  return label.replace(/\s*\(ongoing \$[\d,.]+\/mo after this\)$/, '');
}

function statusColor(status: ClientInvoice['status']): string {
  if (status === 'paid') return 'var(--success)';
  if (status === 'draft') return 'var(--text-tertiary)';
  return 'var(--danger)'; // sent / overdue / void — treated as unpaid-red except void gets its own copy below
}

/** The single detail surface for one invoice, shared by ClientDetailView's
 *  per-client tab and ClientCRMScreen's cross-client All Invoices list —
 *  same component, same actions, regardless of entry point. Behavior
 *  branches entirely on invoice.status, per the build prompt:
 *  draft -> edit/delete/send, sent/overdue -> edit(warns)/void/mark
 *  paid/copy link, paid -> read-only, void -> read-only with the reason. */
export default function InvoiceDetailView({ invoice, clientBusinessName, crm, onClose }: Props) {
  const { profile: business } = useBusinessProfile();
  const [desc, setDesc] = useState(invoice.description);
  const [amount, setAmount] = useState(String(invoice.amount));
  const [dueDate, setDueDate] = useState(invoice.due_date ?? '');
  const [editingSent, setEditingSent] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [sendProductSheet, setSendProductSheet] = useState(true);
  const [generatingNarrative, setGeneratingNarrative] = useState(false);
  const [narrativeError, setNarrativeError] = useState('');
  const [editingWriteup, setEditingWriteup] = useState(false);
  const [introDraft, setIntroDraft] = useState('');
  const [narrativeDrafts, setNarrativeDrafts] = useState<Record<number, string>>({});
  const [outroDraft, setOutroDraft] = useState('');
  const [savingWriteup, setSavingWriteup] = useState(false);
  const hasLineItems = !!invoice.line_items && invoice.line_items.length > 0;
  const hasNarrative = !!invoice.product_sheet_intro || !!invoice.line_items?.some((li) => li.narrative);
  // The Product Sheet explains the one-time/upfront work only — a monthly
  // item gets explained on the Recurring Plan instead (alongside its real
  // price), so nothing's ever explained twice across the two documents.
  const productSheetItems = (invoice.line_items ?? []).filter((li) => li.cadence !== 'monthly');
  const hasProductSheetItems = productSheetItems.length > 0;
  const recurringItems = (invoice.line_items ?? []).filter((li) => li.cadence === 'monthly' && li.ongoing_amount);
  const hasRecurring = recurringItems.length > 0;
  // Shown by default for a bundled invoice — reviewing what's about to go
  // out (invoice + the value comparison) is the point of landing here
  // right after creating one, not something to click for. Still
  // collapsible for anyone who doesn't want it taking up space on an old
  // invoice they're just glancing at.
  const [showProductSheet, setShowProductSheet] = useState(hasProductSheetItems);
  const [showRecurringPlan, setShowRecurringPlan] = useState(hasRecurring);

  const isDraft = invoice.status === 'draft';
  const isVoid = invoice.status === 'void';
  const isPaid = invoice.status === 'paid';
  const isUnpaidSent = invoice.status === 'sent' || invoice.status === 'overdue';

  const saveDraftField = async (patch: Partial<Pick<ClientInvoice, 'description' | 'amount' | 'due_date'>>) => {
    await crm.updateDraftInvoice(invoice.id, patch);
  };

  const send = async () => {
    setBusy(true);
    setError('');
    try {
      const sequenceIndex = invoice.pricing_item_id
        ? crm.clients.flatMap((c) => c.invoices).filter((i) => i.pricing_item_id === invoice.pricing_item_id && i.status !== 'draft').length + 1
        : 1;
      await crm.sendInvoice({
        clientId: invoice.client_id,
        pricingItemId: invoice.pricing_item_id,
        sequenceIndex,
        description: desc,
        amount: Number(amount) || invoice.amount,
        dueDate: dueDate || null,
        invoiceId: invoice.id,
        lineItems: invoice.line_items,
        productSheetIntro: invoice.product_sheet_intro,
        recurringPlanOutro: invoice.recurring_plan_outro,
        sendProductSheet: hasLineItems && sendProductSheet,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the invoice.');
    } finally {
      setBusy(false);
    }
  };

  const generateNarrative = async () => {
    setGeneratingNarrative(true);
    setNarrativeError('');
    try {
      const ok = await crm.generateInvoiceNarrative(invoice.id);
      if (!ok) setNarrativeError('Could not generate a write-up — try again.');
      else setShowProductSheet(true);
    } catch {
      setNarrativeError('Could not generate a write-up — try again.');
    } finally {
      setGeneratingNarrative(false);
    }
  };

  const openWriteupEditor = () => {
    setIntroDraft(invoice.product_sheet_intro ?? '');
    const drafts: Record<number, string> = {};
    (invoice.line_items ?? []).forEach((li, i) => { drafts[i] = li.narrative || li.description || ''; });
    setNarrativeDrafts(drafts);
    setOutroDraft(invoice.recurring_plan_outro ?? '');
    setEditingWriteup(true);
  };

  const saveWriteup = async () => {
    setSavingWriteup(true);
    setNarrativeError('');
    try {
      const narratives: Record<number, string | null> = {};
      for (const [i, text] of Object.entries(narrativeDrafts)) narratives[Number(i)] = text.trim() || null;
      const ok = await crm.saveInvoiceWriteup(invoice.id, introDraft.trim() || null, narratives, outroDraft.trim() || null);
      if (!ok) { setNarrativeError('Could not save — try again.'); return; }
      setEditingWriteup(false);
    } catch {
      setNarrativeError('Could not save — try again.');
    } finally {
      setSavingWriteup(false);
    }
  };

  const del = async () => {
    setBusy(true);
    await crm.removeDraftInvoice(invoice.id);
    onClose();
  };

  const duplicate = async () => {
    setBusy(true);
    await crm.duplicateInvoice(invoice);
    setBusy(false);
    onClose();
  };

  const confirmEditSent = () => {
    setEditingSent(true);
  };

  const reopenAsDraft = async () => {
    setBusy(true);
    setError('');
    try {
      await crm.voidInvoice(invoice.id, { revertToDraft: true });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reopen this invoice.');
      setBusy(false);
    }
  };

  const doVoid = async () => {
    if (!voidReason.trim()) return;
    setBusy(true);
    setError('');
    try {
      await crm.voidInvoice(invoice.id, { reason: voidReason.trim() });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not void this invoice.');
      setBusy(false);
    }
  };

  const markPaid = async () => {
    setBusy(true);
    await crm.markInvoicePaidManually(invoice.id);
    onClose();
  };

  const copyLink = async () => {
    if (!invoice.stripe_invoice_url) return;
    try {
      await navigator.clipboard.writeText(invoice.stripe_invoice_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be blocked — the link is still shown as a normal anchor either way.
    }
  };

  const rowStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 'var(--text-body-sm)', padding: '8px 0', borderBottom: '1px solid var(--surface-3)' };

  return (
    <div>
      <span style={{ ...ghostBtn, display: 'inline-flex', alignItems: 'center', marginBottom: 14 }} onClick={onClose}>
        ← Back
      </span>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 'var(--text-head)', fontWeight: 700, color: 'var(--text)' }}>Invoice #{invoice.invoice_number}</div>
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginTop: 3 }}>{clientBusinessName}</div>
        </div>
        <span style={{
          fontSize: 'var(--text-micro)', fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', borderRadius: 'var(--radius-pill)', padding: '4px 11px',
          color: isVoid ? 'var(--text-tertiary)' : statusColor(invoice.status),
          border: `1px solid ${isVoid ? 'var(--border)' : `color-mix(in srgb, ${statusColor(invoice.status)} 40%, transparent)`}`,
        }}>
          {invoice.status}
        </span>
      </div>

      {/* The invoice as a document, not just a row of metadata fields —
          the same view whether it's still a draft (what's about to go
          out) or long since sent/paid (what actually did). Draft/editing
          shows the live-edited values; everything else shows the invoice
          exactly as it was sent. */}
      <InvoiceDocument
        from={business.business_name || undefined}
        businessAddress={business.business_address || undefined}
        businessEmail={business.business_email || undefined}
        businessPhone={business.business_phone || undefined}
        businessWebsite={business.website || undefined}
        billTo={clientBusinessName}
        description={isDraft || editingSent ? desc : invoice.description}
        amount={isDraft || editingSent ? (Number(amount) > 0 ? Number(amount) : null) : invoice.amount}
        lineItems={invoice.line_items}
        dueDate={isDraft || editingSent ? (dueDate || null) : invoice.due_date}
        invoiceNumber={invoice.invoice_number}
        status={isDraft || editingSent ? undefined : invoice.status}
        paidAt={invoice.paid_at}
        style={{ marginTop: 20, maxWidth: 560 }}
      />

      {hasLineItems && (
        <div style={{ marginTop: 10, maxWidth: 560 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            {hasProductSheetItems && !editingWriteup && (
              <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }} onClick={() => setShowProductSheet((v) => !v)}>
                {showProductSheet ? 'Hide product sheet' : 'View product sheet'}
              </span>
            )}
            {isDraft && !editingWriteup && (
              <>
                <span
                  style={{ fontSize: 'var(--text-small)', color: generatingNarrative ? 'var(--text-tertiary)' : 'var(--text-secondary)', cursor: generatingNarrative ? 'default' : 'pointer' }}
                  onClick={() => !generatingNarrative && generateNarrative()}
                >
                  {generatingNarrative ? 'Writing…' : hasNarrative ? '✨ Regenerate personalized write-up' : '✨ Generate personalized write-up'}
                </span>
                <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={openWriteupEditor}>
                  Edit write-up
                </span>
              </>
            )}
          </div>
          {narrativeError && <div style={{ fontSize: 'var(--text-small)', color: 'var(--danger)', marginTop: 6 }}>{narrativeError}</div>}

          {editingWriteup ? (
            <div style={{ ...cardStyle, marginTop: 12 }}>
              <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Edit write-up</div>
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginBottom: 14 }}>
                Fix anything Nova got wrong or that's changed since the discovery call — this is what actually shows on the product sheet and recurring plan.
              </div>
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginBottom: 5 }}>Opening paragraph</div>
              <textarea
                style={{ ...inputStyle, width: '100%', minHeight: 90, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                value={introDraft}
                onChange={(e) => setIntroDraft(e.target.value)}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
                {(invoice.line_items ?? []).map((li, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginBottom: 5 }}>{stripOngoingSuffix(li.label)}</div>
                    <textarea
                      style={{ ...inputStyle, width: '100%', minHeight: 70, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                      value={narrativeDrafts[i] ?? ''}
                      onChange={(e) => setNarrativeDrafts((d) => ({ ...d, [i]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              {hasRecurring && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginBottom: 5 }}>
                    Recurring plan closing note — how this winds down (optional)
                  </div>
                  <textarea
                    style={{ ...inputStyle, width: '100%', minHeight: 70, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    placeholder="e.g. After month 4 you'll have everything you need to run this yourself — call me any time something comes up and I'll jump back in."
                    value={outroDraft}
                    onChange={(e) => setOutroDraft(e.target.value)}
                  />
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <div style={{ ...primaryBtn, opacity: savingWriteup ? 0.6 : 1, pointerEvents: savingWriteup ? 'none' : 'auto' }} onClick={saveWriteup}>
                  {savingWriteup ? 'Saving…' : 'Save'}
                </div>
                <div style={ghostBtn} onClick={() => !savingWriteup && setEditingWriteup(false)}>Cancel</div>
              </div>
            </div>
          ) : (
            hasProductSheetItems && showProductSheet && (
              <ProductSheetDocument
                from={business.business_name || undefined}
                clientName={clientBusinessName}
                intro={invoice.product_sheet_intro}
                items={productSheetItems.map((li) => ({ label: li.label, description: li.description, narrative: li.narrative }))}
                teachingPhilosophy={business.teaching_philosophy}
                style={{ marginTop: 12 }}
              />
            )
          )}
        </div>
      )}

      {hasRecurring && !editingWriteup && (
        <div style={{ marginTop: 10, maxWidth: 560 }}>
          <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }} onClick={() => setShowRecurringPlan((v) => !v)}>
            {showRecurringPlan ? 'Hide recurring plan' : 'View recurring plan'}
          </span>
          {showRecurringPlan && (
            <RecurringPlanDocument
              clientName={clientBusinessName}
              items={recurringItems.map((li) => ({
                label: stripOngoingSuffix(li.label),
                ongoingAmount: li.ongoing_amount as number,
                description: li.description,
                narrative: li.narrative,
              }))}
              outro={invoice.recurring_plan_outro}
              style={{ marginTop: 12 }}
            />
          )}
        </div>
      )}

      <div style={{ ...cardStyle, marginTop: 16, maxWidth: 560 }}>
        {isDraft || editingSent ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {editingSent && (
              <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--warning)', lineHeight: 1.5 }}>
                Editing voids the current Stripe invoice and reopens this as a draft — you'll need to hit Send again once you're done, which generates a new payment link.
              </div>
            )}
            <input style={inputStyle} value={desc} onChange={(e) => setDesc(e.target.value)} onBlur={() => isDraft && saveDraftField({ description: desc })} placeholder="Description" />
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={inputStyle} value={amount} onChange={(e) => setAmount(e.target.value)} onBlur={() => { const n = Number(amount); if (isDraft && Number.isFinite(n) && n > 0) saveDraftField({ amount: n }); }} placeholder="Amount" />
              <input style={inputStyle} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} onBlur={() => isDraft && saveDraftField({ due_date: dueDate || null })} />
            </div>
            {isDraft && <div style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)' }}>Autosaved as you edit — nothing is sent to Stripe until you hit Send.</div>}

            {hasLineItems && isDraft && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={sendProductSheet} onChange={(e) => setSendProductSheet(e.target.checked)} />
                Also email {hasRecurring ? 'the product sheet & recurring plan' : 'the product sheet'} to {clientBusinessName}
              </label>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
              <div style={{ ...primaryBtn, pointerEvents: busy ? 'none' : 'auto', opacity: busy ? 0.6 : 1 }} onClick={editingSent ? reopenAsDraft : send}>
                {busy ? 'Working…' : editingSent ? 'Reopen as draft' : 'Send invoice'}
              </div>
              {isDraft && <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={del}>Delete</span>}
              {editingSent && <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={() => setEditingSent(false)}>Never mind</span>}
              <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={duplicate}>Duplicate</span>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={rowStyle}><span style={{ color: 'var(--text-tertiary)' }}>Description</span><span style={{ color: 'var(--text)', textAlign: 'right' }}>{invoice.description}</span></div>
            <div style={rowStyle}><span style={{ color: 'var(--text-tertiary)' }}>Amount</span><span style={{ color: 'var(--text)', fontWeight: 600 }}>{money(invoice.amount)}</span></div>
            {invoice.due_date && <div style={rowStyle}><span style={{ color: 'var(--text-tertiary)' }}>Due</span><span style={{ color: 'var(--text)' }}>{invoice.due_date}</span></div>}
            {invoice.sent_at && <div style={rowStyle}><span style={{ color: 'var(--text-tertiary)' }}>Sent</span><span style={{ color: 'var(--text)' }}>{new Date(invoice.sent_at).toLocaleString()}</span></div>}
            {isPaid && invoice.paid_at && (
              <div style={rowStyle}><span style={{ color: 'var(--text-tertiary)' }}>Paid</span><span style={{ color: 'var(--success)', fontWeight: 600 }}>{new Date(invoice.paid_at).toLocaleString()}</span></div>
            )}
            {(isPaid || isUnpaidSent) && (
              <div style={rowStyle}>
                <span style={{ color: 'var(--text-tertiary)' }}>Payment reference</span>
                <span style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-caption)' }}>{invoice.stripe_invoice_id ?? 'Marked paid manually'}</span>
              </div>
            )}
            {isVoid && invoice.void_reason && (
              <div style={{ ...rowStyle, borderBottom: 'none' }}><span style={{ color: 'var(--text-tertiary)' }}>Void reason</span><span style={{ color: 'var(--text)', textAlign: 'right' }}>{invoice.void_reason}</span></div>
            )}

            {isUnpaidSent && !voiding && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 16, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }} onClick={confirmEditSent}>Edit</span>
                {invoice.stripe_invoice_url && (
                  <>
                    <a href={invoice.stripe_invoice_url} target="_blank" rel="noreferrer" style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)' }}>View invoice ↗</a>
                    <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={copyLink}>{copied ? 'Copied' : 'Copy payment link'}</span>
                  </>
                )}
                <div style={{ ...ghostBtn, pointerEvents: busy ? 'none' : 'auto', opacity: busy ? 0.6 : 1 }} onClick={markPaid}>Mark paid manually</div>
                <span style={{ fontSize: 'var(--text-small)', color: 'var(--danger)', cursor: 'pointer' }} onClick={() => setVoiding(true)}>Void</span>
              </div>
            )}

            {isUnpaidSent && voiding && (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input style={inputStyle} placeholder="Reason for voiding (required)" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} autoFocus />
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div
                    style={{ ...primaryBtn, background: 'var(--danger)', pointerEvents: busy || !voidReason.trim() ? 'none' : 'auto', opacity: busy || !voidReason.trim() ? 0.6 : 1 }}
                    onClick={doVoid}
                  >
                    Confirm void
                  </div>
                  <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={() => { setVoiding(false); setVoidReason(''); }}>Cancel</span>
                </div>
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={duplicate}>Duplicate</span>
            </div>
          </div>
        )}
        {error && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--danger)', marginTop: 10 }}>{error}</div>}
      </div>
    </div>
  );
}
