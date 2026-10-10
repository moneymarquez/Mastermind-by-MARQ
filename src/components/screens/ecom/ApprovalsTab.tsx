import { useEffect, useRef, useState } from 'react';
import type { useApprovals, Approval } from '../../../data/useEcom';
import { decideApproval } from '../../../data/useEngine';
import Thumbs from '../../mm/Thumbs';
import { api } from '../../../lib/api';
import { api as callApi } from '../../../lib/api';
import type { ImportRow } from '../../../data/ecomProducts';
import { marginHealthy } from '../../../data/ecomProducts';
import { E, Badge, ConfidenceBadge, TeachingEmpty, btn, field, label, tint, useIsMobile } from './ecomShared';
import { ApprovalBody, APPROVE_LABEL } from './ApprovalBodies';
import RichProductCard from './RichProductCard';
import { money, ago, CHANNELS } from '../../../data/ecom';

/** §7 — one inbox for everything waiting on you, across domains. Every card
 *  shows what it is, why (principle), source, confidence, and Approve / Send
 *  back / Kill. Decisions go through the Worker: approving a Scout run
 *  writes the products into the sheet; a send-back note is read into that
 *  worker's next run (and can re-run it now). Money cards are red-bordered
 *  and never swipe-approve. On phones: swipe right = approve, left = send back. */
export default function ApprovalsTab({ api, onDecided }: { api: ReturnType<typeof useApprovals>; onDecided?: () => void }) {
  const pending = api.approvals.filter((a) => a.status === 'pending');
  const decided = api.approvals.filter((a) => a.status !== 'pending').slice(0, 20);
  const [toast, setToast] = useState('');
  // Scout finds arrive without their numbers; fill them in one at a time (each call is short, so a phone connection survives it).
  const waiting = pending.filter((a) => a.type === 'product_card' && a.payload.pending_enrich === true).length;
  const [filling, setFilling] = useState(false);
  const running = useRef(false);
  const reload = api.reload;
  useEffect(() => {
    if (!waiting || running.current) return;
    running.current = true; setFilling(true);
    let on = true;
    (async () => {
      for (let i = 0; i < 25 && on; i++) {
        const r = await callApi<{ done?: boolean; error?: string }>('/api/engine/enrich-next', { body: {} });
        await reload();
        if (r.error || r.done) break;
      }
      running.current = false; if (on) setFilling(false);
    })();
    return () => { on = false; running.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting > 0]);
  return (
    <div>
      {(waiting > 0 || filling) && <div role="status" style={{ ...E.card, padding: 10, marginBottom: 10, fontSize: 'var(--text-body)', color: E.muted }}>Finding supplier costs, sellers and shipping for {waiting} new find{waiting === 1 ? '' : 's'}… cards update by themselves. Keep this tab open.</div>}
      {toast && <div style={{ ...E.card, padding: 10, marginBottom: 10, borderColor: E.green, color: E.text, fontSize: 'var(--text-body)' }}>{toast}</div>}
      {!api.loading && pending.length === 0 && (
        <TeachingEmpty what="Nothing waiting on you." worker="every worker — Scout runs, drafts, brand options, supplier picks and store previews all land here" />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {pending.map((a) => <ApprovalCard key={a.id} a={a} onDone={async (msg) => { setToast(msg); await api.reload(); onDecided?.(); setTimeout(() => setToast(''), 5000); }} />)}
      </div>
      {decided.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ ...label, marginBottom: 6 }}>Decided</div>
          {decided.map((a) => (
            <div key={a.id} style={{ display: 'flex', gap: 10, fontSize: 'var(--text-body)', color: E.muted, padding: '6px 0', borderTop: `1px solid ${E.border}`, flexWrap: 'wrap' }}>
              <Badge color={a.status === 'approved' ? E.green : a.status === 'killed' ? E.red : E.amber}>{a.status.replace('_', ' ')}</Badge>
              <span style={{ color: E.text, flex: 1, minWidth: 120 }}>{a.title}</span>
              {a.my_note && <span style={{ color: E.faint, fontStyle: 'italic' }}>“{a.my_note}”</span>}
              <span style={{ color: E.faint }}>{ago(a.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Cards where Approve applies the option you picked. */
const CHOOSES = new Set(['brand_options', 'supplier_pick']);
/** Types whose worker can be re-run straight from a send-back. */
const RERUNNABLE = new Set(['analysis', 'teardown', 'lead_tags', 'scripts', 'campaign_plan', 'inspiration', 'content_plan', 'content_audit', 'content_grades', 'post_plan', 'clip_edit', 'inbound_tags', 'supplier_pick', 'brand_options', 'store_draft', 'brand_read']);
function appliedMessage(type: string, a: Record<string, number> | null | undefined): string {
  if (!a) return 'Approved.';
  if (type === 'scout_products') return `Approved — ${a.inserted} new, ${a.updated} refreshed in Product Sheets.`;
  if (type === 'analysis') return 'Approved — the product drawer is filled in.';
  if (type === 'teardown') return `Approved — ${a.competitors} dossiers and ${a.angles} angles saved on the product.`;
  if (type === 'lead_tags') return `Approved — ${a.tagged} leads tagged (${a.chains ?? 0} chains, ${a.duplicates ?? 0} duplicates).`;
  if (type === 'scripts') return `Approved — ${a.added} new scripts, ${a.versioned} new versions in Scripts.`;
  if (type === 'campaign_plan') return 'Approved — the campaign is in Campaigns as planned.';
  if (type === 'grades') return `Approved — ${a.graded} campaigns graded.`;
  if (type === 'inspiration') return `Approved — ${a.saved} saved to Inspiration.`;
  if (type === 'content_plan') return `Approved — ${a.added} posts added to the Plan as scripts.`;
  if (type === 'content_audit') return 'Approved — the audit is saved on the account; Idea & Script reads it next run.';
  if (type === 'content_grades') return `Approved — ${a.graded} posts graded.`;
  if (type === 'post_plan') return `Approved — ${a.scheduled} posts timed and captioned on the Plan${a.queued ? `; ${a.queued} will post on their own at their times (Publisher)` : ''}.`;
  if (type === 'supplier_pick') return `Approved — ${a.supplier} is on step 4. The sample is a red card in Approvals: buy it yourself, then tap "I bought it".`;
  if (type === 'brand_options') return `Approved — ${a.name} fills step 5. The domain is waiting as a red card: buy it yourself.`;
  if (type === 'sample_purchase') return 'Marked ordered on step 4.';
  if (type === 'domain_purchase') return `${a.domain} marked bought on step 5.`;
  if (type === 'store_draft') return 'Approved — the Launcher is taking the page live.';
  if (type === 'product_card') return 'Approved — the brand is set up and the pipeline is running.';
  if (type === 'product_pitch') return 'Approved — the brand is set up. Brand Lab is drafting three directions and Supplier Finder the shipping plan; both land here.';
  if (type === 'brand_read') return `Saved on steps 9 and 10 — ${a.diagnosis}, recommend ${a.recommendation}.`;
  if (type === 'inbound_tags') return `Approved — ${a.tagged} sources set on Inbound.`;
  if (type === 'clip_edit') return 'Approved — the edit is saved on the clip in Studio.';
  return 'Approved.';
}

/** A Scout find: the rich product card with its own decision row (approve to test / watch / reject with a reason). */
function ProductApprovalCard({ a, onDone }: { a: Approval; onDone: (msg: string) => void }) {
  const row = a.payload.row as ImportRow | undefined;
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  if (!row) return <div style={{ ...E.card, padding: 14, color: E.muted }}>{a.title}: this find has no product data. Kill it from the sheet.</div>;
  const finish = (m: string) => { setBusy(''); setMsg(m); onDone(m); };
  const lookingUp = a.payload.pending_enrich === true;
  const approve = async () => {
    setBusy('approve'); setMsg('');
    const r = await decideApproval(a.id, 'approved');
    if (!r.ok) { setBusy(''); setMsg(r.error ?? 'Could not approve that.'); return; }
    finish(`Approved. ${(r.applied as { note?: string } | undefined)?.note ?? ''} Brand Lab and Supplier Finder are drafting next.`.trim());
  };
  const reject = async (reason: string) => { setBusy('reject'); const r = await decideApproval(a.id, 'sent_back', `Rejected: ${reason}`, false); if (!r.ok) { setBusy(''); setMsg(r.error ?? 'Could not save that.'); return; } finish(`Rejected: ${reason}. Scout will read that next run.`); };
  const watch = async () => { setBusy('watch'); const r = await api<{ ok?: boolean; error?: string; detail?: string }>('/api/engine/watch-card', { body: { approval_id: a.id } }); if (r.error) { setBusy(''); setMsg(r.error); return; } finish(r.detail ?? 'Watching.'); };
  const enrich = async () => { setBusy('enrich'); setMsg('Looking up the missing numbers… (1–2 min)'); const r = await api<{ ok?: boolean; error?: string; summary?: string }>('/api/engine/enrich', { body: { approval_id: a.id } }); finish(r.error ?? r.summary ?? 'Done.'); };
  return (
    <RichProductCard p={{ ...row, source_url: row.source_url ?? null } as never} busy={lookingUp ? 'enrich' : busy} message={lookingUp && !msg ? 'Finding supplier costs, sellers and shipping…' : msg}
      onApprove={() => void approve()} onReject={(r) => void reject(r)} onWatch={() => void watch()} onEnrich={() => void enrich()} />
  );
}

export function ApprovalCard(props: { a: Approval; onDone: (msg: string) => void }) {
  return props.a.type === 'product_card' ? <ProductApprovalCard {...props} /> : <GenericApprovalCard {...props} />;
}

function GenericApprovalCard({ a, onDone }: { a: Approval; onDone: (msg: string) => void }) {
  const mobile = useIsMobile();
  const [note, setNote] = useState('');
  const [rerun, setRerun] = useState(true);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [dx, setDx] = useState(0);
  // Cards that offer options (Brand Lab, suppliers): which one Approve applies.
  const [choice, setChoice] = useState<number>(typeof a.payload.pick === 'number' ? a.payload.pick : 0);
  const start = useRef<number | null>(null);
  const noteRef = useRef<HTMLInputElement>(null);
  const rows = a.type === 'scout_products' ? ((a.payload.rows ?? []) as ImportRow[]) : [];
  const channel = CHANNELS.find((c) => c.id === a.payload.channel)?.label;

  const go = async (status: 'approved' | 'sent_back' | 'killed') => {
    if (status === 'sent_back' && !note.trim()) { setErr('Write what to change first — that note is what the worker learns from.'); noteRef.current?.focus(); return; }
    setBusy(status); setErr('');
    const r = await decideApproval(a.id, status, note.trim() || null, status === 'sent_back' && rerun, CHOOSES.has(a.type) ? choice : undefined);
    setBusy('');
    if (!r.ok) { setErr(r.error ?? 'Could not save that decision.'); return; }
    const launch = (r as { launch?: { ok: boolean; summary?: string; error?: string } }).launch;
    if (launch && !launch.ok) { onDone(`Approved, but the store didn't launch: ${launch.error ?? 'unknown error'} Fix it, then press Launch again on the brand's Store build step.`); return; }
    onDone(launch?.ok ? `Approved — ${launch.summary}` : status === 'approved' ? appliedMessage(a.type, r.applied as Record<string, number> | null | undefined)
      : status === 'sent_back' ? (r.rerun ? (r.rerun.ok ? `Sent back. Re-ran with your note — the new version is waiting.` : `Sent back. Re-run failed: ${r.rerun.error}`) : 'Sent back. Your note goes into the next run.')
      : 'Killed.');
  };

  const onTouchStart = (e: React.TouchEvent) => { if (mobile) start.current = e.touches[0].clientX; };
  const onTouchMove = (e: React.TouchEvent) => { if (start.current != null) setDx(Math.max(-120, Math.min(120, e.touches[0].clientX - start.current))); };
  const onTouchEnd = () => {
    if (start.current == null) return;
    start.current = null;
    if (dx > 90 && !a.is_money) go('approved');
    else if (dx < -90) { noteRef.current?.focus(); setErr('Swiped to send back — write what to change, then tap Send back.'); }
    setDx(0);
  };

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      style={{ ...E.card, padding: 14, border: a.is_money ? `2px solid ${E.red}` : `1px solid ${dx > 40 ? E.green : dx < -40 ? E.amber : E.border}`, transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? 'none' : 'transform 160ms ease' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <Badge color={E.faint}>{a.domain}</Badge>
        <Badge color={E.blue}>{a.type.replace(/_/g, ' ')}</Badge>
        {channel && <Badge color={E.violet}>{channel}</Badge>}
        {a.is_money && <Badge color={E.red}>💲 Money · {money(a.amount_usd)}</Badge>}
        {a.confidence && <ConfidenceBadge c={a.confidence} />}
        <span style={{ fontSize: 'var(--text-caption)', color: E.faint, marginLeft: 'auto' }}>{ago(a.created_at)}</span>
      </div>
      <div style={{ fontWeight: 700, color: E.text, fontSize: 'var(--text-subhead)', marginTop: 8 }}>{a.title}</div>
      {typeof a.payload.summary === 'string' && a.payload.summary && <div style={{ fontSize: 'var(--text-body)', color: E.muted, marginTop: 4 }}>{a.payload.summary}</div>}
      {a.principle && <div style={{ fontSize: 'var(--text-body)', color: E.muted, marginTop: 4 }}><span style={label}>Why</span> {a.principle}</div>}
      {a.source_url && <a href={a.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 'var(--text-caption)', color: E.blue }}>Source ↗</a>}

      {rows.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 8, borderRadius: 'var(--radius-sm)', background: E.sunk, border: `1px solid ${E.border}` }}>
              {r.images[0] ? <img src={r.images[0]} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} /> : <div style={{ width: 48, height: 48, borderRadius: 6, background: tint(E.accent, 10), display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', color: E.accent, flexShrink: 0 }}>#{r.rank ?? i + 1}</div>}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: E.text }}>{r.name}</span>
                  {r.score != null && <Badge color={r.score >= 7 ? E.green : r.score >= 5 ? E.amber : E.faint}>{r.score.toFixed(0)}/10</Badge>}
                  <ConfidenceBadge c={r.confidence} />
                </div>
                <div style={{ fontSize: 'var(--text-caption)', color: E.muted, fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                  {money(r.sell_price)} sell · {r.landed_cost != null ? <span style={{ color: marginHealthy(r.sell_price, r.landed_cost) ? E.green : E.amber }}>{money(r.landed_cost)} landed</span> : 'landed ?'}{r.velocity ? ` · ${r.velocity}` : ''}{r.content_difficulty ? ` · ${r.content_difficulty} to film` : ''}
                </div>
                {r.detail.buyer && <div style={{ fontSize: 'var(--text-caption)', color: E.muted, marginTop: 2 }}><span style={label}>Buyer</span> {r.detail.buyer}</div>}
                {r.detail.principle && <div style={{ fontSize: 'var(--text-caption)', color: E.muted }}><span style={label}>Principle</span> {r.detail.principle}</div>}
                {r.source_url && <a href={r.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 'var(--text-caption)', color: E.blue }}>source ↗</a>}
              </div>
            </div>
          ))}
          {Array.isArray(a.payload.dropped) && (a.payload.dropped as string[]).length > 0 && <div style={{ fontSize: 'var(--text-caption)', color: E.amber }}>Dropped by the rules: {(a.payload.dropped as string[]).join('; ')}</div>}
        </div>
      ) : APPROVE_LABEL[a.type] ? <ApprovalBody type={a.type} payload={a.payload} choice={choice} onChoice={setChoice} approvalId={a.id} /> : Object.keys(a.payload).length > 0 && (
        <pre style={{ fontSize: 12, color: E.text, background: E.sunk, border: `1px solid ${E.border}`, borderRadius: 6, padding: 10, marginTop: 8, whiteSpace: 'pre-wrap', maxHeight: 220, overflow: 'auto' }}>{JSON.stringify(a.payload, null, 2)}</pre>
      )}

      <input ref={noteRef} style={{ ...field, marginTop: 10 }} placeholder='Note to the worker — e.g. "nothing under $15, and skip anything with bad reviews"' value={note} onChange={(e) => { setNote(e.target.value); setErr(''); }} />
      {(a.type === 'scout_products' || RERUNNABLE.has(a.type)) && <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 'var(--text-caption)', color: E.muted, marginTop: 6 }}><input type="checkbox" checked={rerun} onChange={(e) => setRerun(e.target.checked)} /> On send back, re-run the worker now with this note</label>}
      {err && <div style={{ fontSize: 'var(--text-caption)', color: E.amber, marginTop: 6 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <button style={btn('primary')} disabled={!!busy} onClick={() => go('approved')}>{busy === 'approved' ? 'Saving…' : a.type === 'sample_purchase' || a.type === 'domain_purchase' ? '✓ I bought it' : a.is_money ? 'Approve · spend' : rows.length ? `Approve · add ${rows.length} to sheet` : APPROVE_LABEL[a.type]?.(a.payload) ?? 'Approve'}</button>
        <button style={btn('ghost')} disabled={!!busy} onClick={() => go('sent_back')}>{busy === 'sent_back' ? (rerun && (a.type === 'scout_products' || RERUNNABLE.has(a.type)) ? 'Re-running…' : 'Saving…') : 'Send back'}</button>
        {a.type === 'product_pitch' && <button style={btn('ghost')} disabled={!!busy} onClick={async () => { setBusy('another'); const r = await api<{ ok?: boolean; summary?: string; error?: string }>('/api/engine/pitch', { body: { another_of: a.id } }); setBusy(''); onDone(r.error ? `Couldn't find another: ${r.error}` : `Replaced. ${r.summary ?? ''}`); }}>{busy === 'another' ? 'Looking…' : 'Find me another'}</button>}
        <button style={btn('danger')} disabled={!!busy} onClick={() => go('killed')}>Kill</button>
        <span style={{ marginLeft: 'auto' }}><Thumbs entityType="approval" entityId={a.id} domain={a.domain} workerId={a.worker_id ?? null} compact /></span>
      </div>
      {mobile && !a.is_money && <div style={{ fontSize: 10.5, color: E.faint, marginTop: 6 }}>Swipe right to approve · left to send back</div>}
    </div>
  );
}
