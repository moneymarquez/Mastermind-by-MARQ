import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useClientPortalAdmin } from '../../data/useClientPortalAdmin';
import type { BriefForPortal } from '../../data/useClientPortalAdmin';
import type { TicketWithOptions } from '../../data/useClientPortalData';
import type { ClientChangelogEntry, ClientDeliverable, CrmClient, DeliverableKind, DeliverableStatus, PortalModule } from '../../data/types';
import { DELIVERABLE_KINDS, TICKET_KINDS } from '../../data/types';
import { cardStyle, inputStyle, selectStyle, primaryBtn, ghostBtn } from './ClientCRMScreen';
import ProgressSpine from '../ProgressSpine';
import ClientPortal from '../../client-portal/ClientPortal';

interface Props {
  client: Pick<CrmClient, 'id' | 'business_name' | 'contact_name'>;
  /** Fired after any write so a parent list (Client Modules overview, the
   *  Inbox widget) can refresh its counts. */
  onChanged?: () => void;
}

const textareaStyle: CSSProperties = { ...inputStyle, minHeight: 80, resize: 'vertical', lineHeight: 1.5, fontFamily: 'inherit', fontSize: 16 };
const label: CSSProperties = { fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginBottom: 6, marginTop: 12 };
const h2: CSSProperties = { fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' };
const hint: CSSProperties = { fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 4, lineHeight: 1.5 };
const pill = (color: string): CSSProperties => ({ fontSize: 'var(--text-micro)', fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', borderRadius: 'var(--radius-pill)', padding: '2px 8px', color, border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`, whiteSpace: 'nowrap' });
const STATUSES: { key: DeliverableStatus; label: string }[] = [
  { key: 'in_progress', label: 'In progress' },
  { key: 'review', label: 'In review — client approves' },
  { key: 'live', label: 'Live' },
];

function fmt(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Pulls "what / why" for a deliverable out of a Brand Lab brief that
 *  already has the reasoning written — the spec summary and the client's
 *  own bottleneck. Only real text from the brief; nothing invented. */
function prefillFromBrief(b: BriefForPortal): { title: string; what_it_is: string; why_it_matters: string } {
  const pages = b.functional_spec?.pages.filter((p) => p.enabled).map((p) => p.name) ?? [];
  const what = [b.functional_spec?.summary ?? '', pages.length ? `Pages: ${pages.join(', ')}.` : ''].filter(Boolean).join(' ');
  const why = b.bottleneck_verbatim
    ? `You told us the thing holding you back was: “${b.bottleneck_verbatim}”. This was built to fix that — every page and section was decided against that before any design was made${b.rounds_to_approval ? `, and the design went through ${b.rounds_to_approval} scored round${b.rounds_to_approval === 1 ? '' : 's'} before it was approved` : ''}.`
    : '';
  return { title: `${b.business || b.direction} website`, what_it_is: what, why_it_matters: why };
}

function DeliverableRow({ d, onSave, onShip, onRemove }: { d: ClientDeliverable; onSave: (patch: Partial<ClientDeliverable>) => void; onShip: () => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(d.title);
  const [what, setWhat] = useState(d.what_it_is ?? '');
  const [why, setWhy] = useState(d.why_it_matters ?? '');
  const [link, setLink] = useState(d.link_url ?? '');
  const color = d.status === 'live' ? 'var(--success)' : d.status === 'review' ? 'var(--warning)' : 'var(--text-tertiary)';
  const approval = d.status === 'review' ? (d.approved_at ? `approved by client ${fmt(d.approved_at)}` : `waiting on client since ${fmt(d.approval_requested_at)}`) : '';
  return (
    <div style={{ ...cardStyle, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setOpen((v) => !v)}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>{d.title}</div>
          <div style={hint}>{DELIVERABLE_KINDS.find((k) => k.key === d.kind)?.label} · <span style={{ color }}>{STATUSES.find((s) => s.key === d.status)?.label.split(' — ')[0]}</span>{approval ? ` · ${approval}` : ''}{!d.why_it_matters ? ' · no “why” yet' : ''}</div>
        </div>
        <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)' }}>{open ? '▴' : '▾'}</span>
      </div>
      {open && (
        <div style={{ marginTop: 10 }}>
          <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim() && title !== d.title && onSave({ title: title.trim() })} placeholder="Title" />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <select style={{ ...selectStyle, flex: 1 }} value={d.kind} onChange={(e) => onSave({ kind: e.target.value as DeliverableKind })}>
              {DELIVERABLE_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
            </select>
            <select style={{ ...selectStyle, flex: 1 }} value={d.status} onChange={(e) => onSave({ status: e.target.value as DeliverableStatus })}>
              {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div style={label}>What it is</div>
          <textarea style={textareaStyle} value={what} onChange={(e) => setWhat(e.target.value)} onBlur={() => what !== (d.what_it_is ?? '') && onSave({ what_it_is: what.trim() || null })} />
          <div style={label}>Why it matters for them specifically</div>
          <textarea style={textareaStyle} value={why} onChange={(e) => setWhy(e.target.value)} onBlur={() => why !== (d.why_it_matters ?? '') && onSave({ why_it_matters: why.trim() || null })} placeholder="Their words, their bottleneck, what this changes for them — not a feature list." />
          <div style={label}>Link (live site, profile, folder, screenshot)</div>
          <input style={inputStyle} inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={link} onChange={(e) => setLink(e.target.value)} onBlur={() => link !== (d.link_url ?? '') && onSave({ link_url: link.trim() || null })} placeholder="https://" />
          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {d.status !== 'live' && <span style={primaryBtn} onClick={onShip}>Ship it — go live + log it</span>}
            <span style={{ ...ghostBtn, color: 'var(--text-tertiary)' }} onClick={onRemove}>Remove</span>
          </div>
        </div>
      )}
    </div>
  );
}

function TicketCard({ t, businessName, onAnswer, onResolve, onReopen }: { t: TicketWithOptions; businessName: string; onAnswer: (options: { body: string; link_url: string }[], note: string) => Promise<string | null>; onResolve: () => void; onReopen: () => void }) {
  const [opts, setOpts] = useState([{ body: '', link_url: '' }, { body: '', link_url: '' }, { body: '', link_url: '' }]);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const color = t.status === 'resolved' ? 'var(--success)' : t.status === 'options_sent' ? 'var(--warning)' : 'var(--danger)';
  const filled = opts.filter((o) => o.body.trim()).length;
  const chosen = t.options.find((o) => o.chosen_at);
  return (
    <div style={{ ...cardStyle, padding: 14, borderColor: t.status === 'open' ? 'color-mix(in srgb, var(--danger) 40%, var(--border))' : 'var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', overflowWrap: 'anywhere' }}>{t.title}</div>
          <div style={hint}>{TICKET_KINDS.find((k) => k.key === t.kind)?.label} · {new Date(t.created_at).toLocaleString()}</div>
        </div>
        <span style={pill(color)}>{t.status === 'open' ? 'Needs you' : t.status === 'options_sent' ? `Waiting on ${businessName}` : 'Resolved'}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
        <div style={{ padding: 10, borderRadius: 'var(--radius-md)', background: 'color-mix(in srgb, var(--danger) 7%, transparent)' }}>
          <div style={{ ...hint, marginTop: 0, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>Avoid</div>
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginTop: 4 }}>{t.avoid}</div>
        </div>
        <div style={{ padding: 10, borderRadius: 'var(--radius-md)', background: 'color-mix(in srgb, var(--success) 7%, transparent)' }}>
          <div style={{ ...hint, marginTop: 0, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>Prefer</div>
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginTop: 4 }}>{t.prefer}</div>
        </div>
      </div>

      {t.status === 'open' && (
        <div style={{ marginTop: 12 }}>
          <div style={hint}>Answer with two or three options — never an open redo. They pick one; that closes it.</div>
          {opts.map((o, i) => (
            <div key={i} style={{ marginTop: 8 }}>
              <textarea style={{ ...textareaStyle, minHeight: 56 }} placeholder={`Option ${i + 1}${i === 2 ? ' (optional)' : ''}`} value={o.body} onChange={(e) => setOpts(opts.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} />
              <input style={{ ...inputStyle, marginTop: 4 }} inputMode="url" autoCapitalize="none" spellCheck={false} placeholder="Link to see it (optional)" value={o.link_url} onChange={(e) => setOpts(opts.map((x, j) => (j === i ? { ...x, link_url: e.target.value } : x)))} />
            </div>
          ))}
          <textarea style={{ ...textareaStyle, minHeight: 48, marginTop: 8 }} placeholder="A line to them (optional) — what you heard, why these three" value={note} onChange={(e) => setNote(e.target.value)} />
          {error && <div style={{ ...hint, color: 'var(--danger)' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ ...primaryBtn, opacity: filled >= 2 && !busy ? 1 : 0.6, pointerEvents: filled >= 2 && !busy ? 'auto' : 'none' }} onClick={async () => { setBusy(true); setError(await onAnswer(opts, note)); setBusy(false); }}>{busy ? 'Sending…' : `Send ${filled} option${filled === 1 ? '' : 's'}`}</span>
            <span style={{ ...ghostBtn, color: 'var(--text-tertiary)' }} onClick={onResolve}>Close without options</span>
          </div>
        </div>
      )}

      {t.options.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {t.owner_note && <div style={{ ...hint, marginBottom: 6 }}>You said: {t.owner_note}</div>}
          {t.options.map((o, i) => (
            <div key={o.id} style={{ padding: '8px 0', borderTop: '1px solid var(--border)', fontSize: 'var(--text-body-sm)', color: o.chosen_at ? 'var(--success)' : 'var(--text-secondary)' }}>
              <strong>Option {i + 1}{o.chosen_at ? ' — chosen' : ''}:</strong> {o.body}{o.link_url ? <> · <a href={o.link_url} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>link</a></> : null}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
            {t.status === 'options_sent' && <span style={{ ...ghostBtn, color: 'var(--text-tertiary)' }} onClick={onResolve}>Mark resolved</span>}
            {t.status === 'resolved' && <span style={{ ...ghostBtn, color: 'var(--text-tertiary)' }} onClick={onReopen}>Reopen</span>}
          </div>
          {t.status === 'resolved' && chosen && <div style={hint}>Resolved {fmt(t.resolved_at)} — they went with option {t.options.indexOf(chosen) + 1}.</div>}
        </div>
      )}
    </div>
  );
}

export default function ClientPortalAdmin({ client, onChanged }: Props) {
  const portal = useClientPortalAdmin(client.id);
  const { settings, deliverables, modules, assignments, messages, briefs, tickets, changelog, spine } = portal;

  const [welcome, setWelcome] = useState('');
  const [logo, setLogo] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newKind, setNewKind] = useState<DeliverableKind>('website');
  const [prefillBrief, setPrefillBrief] = useState('');
  const [showAllModules, setShowAllModules] = useState(false);
  const [msgDraft, setMsgDraft] = useState('');
  const [checkin, setCheckin] = useState('');
  const [autoNote, setAutoNote] = useState('');
  const [logWhat, setLogWhat] = useState('');
  const [logWhy, setLogWhy] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [showResolved, setShowResolved] = useState(false);
  const [preview, setPreview] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  useEffect(() => {
    setWelcome(settings?.welcome_text ?? '');
    setLogo(settings?.logo_url ?? '');
    setNextSteps(settings?.next_steps ?? '');
    setCheckin(settings?.handoff_checkin_on ?? '');
  }, [settings]);

  useEffect(() => {
    if (messages.some((m) => m.sender === 'client' && !m.read_at)) portal.markClientMessagesRead().then(() => onChanged?.());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // Every write goes through here so the parent refreshes and the
  // preview (its own data hook) re-mounts on fresh rows.
  const after = () => { onChanged?.(); setPreviewKey((k) => k + 1); };

  const relevant = portal.relevantModules();
  const assignedSorted = [...assignments].sort((a, b) => a.sort_order - b.sort_order);
  const moduleById = new Map(modules.map((m) => [m.id, m]));
  const doneCount = assignments.filter((a) => a.completed_at).length;
  const openedCount = assignments.filter((a) => a.opened_at).length;
  const openTickets = tickets.filter((t) => t.status !== 'resolved');
  const resolvedTickets = tickets.filter((t) => t.status === 'resolved');

  const addDeliverable = async () => {
    const b = briefs.find((x) => x.id === prefillBrief) ?? null;
    const pre = b ? prefillFromBrief(b) : null;
    const title = newTitle.trim() || pre?.title || '';
    if (!title) return;
    await portal.addDeliverable({ kind: newKind, title, what_it_is: pre?.what_it_is || null, why_it_matters: pre?.why_it_matters || null, brief_id: b?.id ?? null });
    setNewTitle('');
    setPrefillBrief('');
    after();
  };

  const move = async (index: number, dir: -1 | 1) => {
    const ids = assignedSorted.map((a) => a.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    await portal.reorderAssignments(ids);
    after();
  };

  const moduleRow = (m: PortalModule) => {
    const a = assignments.find((x) => x.module_id === m.id);
    return (
      <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid var(--border)' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text)', fontWeight: 600 }}>{m.title}</div>
          <div style={hint}>
            {m.applies_to.length ? m.applies_to.map((k) => DELIVERABLE_KINDS.find((x) => x.key === k)?.label ?? k).join(', ') : 'Every client'}
            {!m.video_url ? ' · no video yet' : ''}
          </div>
        </div>
        <span style={a ? { ...ghostBtn, borderColor: 'var(--success)', color: 'var(--success)' } : ghostBtn} onClick={async () => { if (a) await portal.unassignModule(m.id); else await portal.assignModule(m.id); after(); }}>
          {a ? 'Assigned ✓' : 'Assign'}
        </span>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 640, marginTop: 16 }}>
      <div style={{ ...cardStyle, fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', lineHeight: 1.55, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span>This is what {client.business_name} sees when they sign in. Everything here is theirs only; they never see the Masterminds tool. If you leave something blank, they see an honest “not written yet”.</span>
        <span style={preview ? primaryBtn : ghostBtn} onClick={() => { setPreview((v) => !v); setPreviewKey((k) => k + 1); }}>{preview ? 'Hide preview' : 'Preview as them'}</span>
      </div>

      {preview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          <div style={{ width: '100%', maxWidth: 390, height: 720, border: '1px solid var(--border-2)', borderRadius: 28, overflow: 'hidden', background: 'var(--bg)', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
            <ClientPortal key={previewKey} previewClientId={client.id} />
          </div>
          <span style={{ ...hint, cursor: 'pointer' }} onClick={() => setPreviewKey((k) => k + 1)}>Refresh preview</span>
        </div>
      )}

      {/* Spine */}
      <div style={cardStyle}>
        <div style={h2}>Where things stand</div>
        <div style={hint}>Derived from their record — audit, Brand Lab brief, deliverables, published reports, guides, handoff. The chips force a station when the data can't see something (a call that happened, no audit typed). “Let the data decide” clears it.</div>
        <div style={{ marginTop: 14 }}>
          <ProgressSpine stations={spine} onOverride={async (key, state) => { await portal.setSpineOverride(key, state); after(); }} />
        </div>
      </div>

      {/* Tickets */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={h2}>Requests ({openTickets.length} open)</div>
            <div style={hint}>Every ticket carries what to avoid and what they'd prefer — the form won't send without both. You answer with 2–3 options; they pick one.</div>
          </div>
          {resolvedTickets.length > 0 && <span style={{ ...hint, cursor: 'pointer' }} onClick={() => setShowResolved((v) => !v)}>{showResolved ? 'Hide' : 'Show'} {resolvedTickets.length} resolved</span>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          {openTickets.length === 0 && <div style={hint}>Nothing open.</div>}
          {[...openTickets, ...(showResolved ? resolvedTickets : [])].map((t) => (
            <TicketCard
              key={t.id}
              t={t}
              businessName={client.business_name}
              onAnswer={async (options, note) => { const err = await portal.answerTicket(t.id, options, note); if (!err) after(); return err; }}
              onResolve={async () => { await portal.resolveTicket(t.id); after(); }}
              onReopen={async () => { await portal.reopenTicket(t.id); after(); }}
            />
          ))}
        </div>
      </div>

      {/* Welcome */}
      <div style={cardStyle}>
        <div style={h2}>Welcome</div>
        <div style={hint}>One paragraph on what was built and why. The teach-back frame is stated automatically under it.</div>
        <div style={label}>Welcome note</div>
        <textarea style={textareaStyle} value={welcome} onChange={(e) => setWelcome(e.target.value)} onBlur={async () => { if (welcome !== (settings?.welcome_text ?? '')) { await portal.saveSettings({ welcome_text: welcome.trim() || null }); after(); } }} placeholder={`Hey ${client.contact_name?.split(' ')[0] || 'there'} — here's what we built for ${client.business_name} and why…`} />
        <div style={label}>Logo URL (optional)</div>
        <input style={inputStyle} inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={logo} onChange={(e) => setLogo(e.target.value)} onBlur={async () => { if (logo !== (settings?.logo_url ?? '')) { await portal.saveSettings({ logo_url: logo.trim() || null }); after(); } }} placeholder="https://…/logo.png" />
        <div style={label}>What happens next</div>
        <textarea style={textareaStyle} value={nextSteps} onChange={(e) => setNextSteps(e.target.value)} onBlur={async () => { if (nextSteps !== (settings?.next_steps ?? '')) { await portal.saveSettings({ next_steps: nextSteps.trim() || null }); after(); } }} />
      </div>

      {/* What we built */}
      <div style={cardStyle}>
        <div style={h2}>What we built ({deliverables.length})</div>
        <div style={hint}>One card per deliverable. Put it “In review” to get their approval before it goes live; “Ship it” flips it live and writes the change-log line in one move.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {deliverables.map((d) => (
            <DeliverableRow
              key={d.id}
              d={d}
              onSave={async (patch) => { await portal.updateDeliverable(d.id, patch); after(); }}
              onShip={async () => { await portal.shipDeliverable(d.id, null); after(); }}
              onRemove={async () => { await portal.removeDeliverable(d.id); after(); }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <input style={{ ...inputStyle, flex: '2 1 200px' }} placeholder="Title (e.g. New website)" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          <select style={{ ...selectStyle, flex: '1 1 140px' }} value={newKind} onChange={(e) => setNewKind(e.target.value as DeliverableKind)}>
            {DELIVERABLE_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
        </div>
        {briefs.length > 0 && (
          <select style={{ ...selectStyle, marginTop: 8 }} value={prefillBrief} onChange={(e) => setPrefillBrief(e.target.value)}>
            <option value="">— prefill what/why from a Brand Lab brief (optional) —</option>
            {briefs.map((b) => <option key={b.id} value={b.id}>{b.business || b.direction}{b.design_locked_at ? ' · design locked' : ''}</option>)}
          </select>
        )}
        <div style={{ ...primaryBtn, marginTop: 10, opacity: newTitle.trim() || prefillBrief ? 1 : 0.6, pointerEvents: newTitle.trim() || prefillBrief ? 'auto' : 'none' }} onClick={addDeliverable}>Add deliverable</div>
      </div>

      {/* Change log */}
      <div style={cardStyle}>
        <div style={h2}>Change log ({changelog.length})</div>
        <div style={hint}>The running proof of work — one line per thing that shipped, with the why. Hidden lines are drafts only you see.</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <input style={{ ...inputStyle, flex: '2 1 220px' }} placeholder="What changed" value={logWhat} onChange={(e) => setLogWhat(e.target.value)} />
          <input type="date" style={{ ...inputStyle, flex: '1 1 140px' }} value={logDate} onChange={(e) => setLogDate(e.target.value)} />
        </div>
        <input style={{ ...inputStyle, marginTop: 8 }} placeholder="Why (one line, optional)" value={logWhy} onChange={(e) => setLogWhy(e.target.value)} />
        <div style={{ ...primaryBtn, marginTop: 10, opacity: logWhat.trim() ? 1 : 0.6, pointerEvents: logWhat.trim() ? 'auto' : 'none' }} onClick={async () => { await portal.addChangelog({ what: logWhat, why: logWhy || null, happened_on: logDate }); setLogWhat(''); setLogWhy(''); after(); }}>Log it</div>
        <div style={{ marginTop: 12 }}>
          {changelog.map((e: ClientChangelogEntry) => (
            <div key={e.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderTop: '1px solid var(--border)', opacity: e.visible_to_client ? 1 : 0.55 }}>
              <div style={{ ...hint, marginTop: 2, width: 48, flexShrink: 0 }}>{fmt(e.happened_on)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text)', fontWeight: 600, overflowWrap: 'anywhere' }}>{e.what}</div>
                {e.why && <div style={{ ...hint, marginTop: 2, overflowWrap: 'anywhere' }}>{e.why}</div>}
              </div>
              <span style={{ ...hint, marginTop: 2, cursor: 'pointer', flexShrink: 0 }} onClick={async () => { await portal.updateChangelog(e.id, { visible_to_client: !e.visible_to_client }); after(); }}>{e.visible_to_client ? 'visible' : 'hidden'}</span>
              <span style={{ ...hint, marginTop: 2, cursor: 'pointer', flexShrink: 0 }} onClick={async () => { await portal.removeChangelog(e.id); after(); }}>✕</span>
            </div>
          ))}
        </div>
      </div>

      {/* Guides */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={h2}>Guides — how to run it ({assignedSorted.length} assigned)</div>
            <div style={hint}>Matched to what was actually delivered: a client without a website never sees website guides. {assignments.length ? `${openedCount} opened · ${doneCount} done.` : ''}</div>
          </div>
          <span style={ghostBtn} onClick={async () => { const n = await portal.autoAssign(); setAutoNote(n ? `Assigned ${n} guide${n === 1 ? '' : 's'}.` : 'Nothing new to assign.'); after(); }}>Assign all relevant</span>
        </div>
        {autoNote && <div style={{ ...hint, color: 'var(--success)' }}>{autoNote}</div>}
        {assignedSorted.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ ...hint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>Their order</div>
            {assignedSorted.map((a, i) => {
              const m = moduleById.get(a.module_id);
              if (!m) return null;
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                  <span style={{ ...hint, marginTop: 0, width: 18 }}>{i + 1}.</span>
                  <span style={{ flex: 1, fontSize: 'var(--text-body-sm)', color: 'var(--text)', minWidth: 0 }}>{m.title}<span style={{ color: 'var(--text-tertiary)' }}>{a.completed_at ? ' · done ✓' : a.opened_at ? ' · opened' : ''}</span></span>
                  <span style={{ ...ghostBtn, padding: '4px 9px', opacity: i === 0 ? 0.35 : 1 }} onClick={() => move(i, -1)}>▲</span>
                  <span style={{ ...ghostBtn, padding: '4px 9px', opacity: i === assignedSorted.length - 1 ? 0.35 : 1 }} onClick={() => move(i, 1)}>▼</span>
                </div>
              );
            })}
          </div>
        )}
        {deliverables.length === 0 && <div style={{ ...hint, marginTop: 8 }}>Add a deliverable first — relevance is decided by its kind.</div>}
        <div style={{ marginTop: 8 }}>
          <div style={{ ...hint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>Library</div>
          {relevant.map(moduleRow)}
        </div>
        {modules.filter((m) => !relevant.includes(m)).length > 0 && (
          <div style={{ marginTop: 10 }}>
            <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={() => setShowAllModules((v) => !v)}>{showAllModules ? 'Hide' : 'Show'} guides that don't match this client's deliverables</span>
            {showAllModules && modules.filter((m) => !relevant.includes(m)).map(moduleRow)}
          </div>
        )}
      </div>

      {/* Messages */}
      <div style={cardStyle}>
        <div style={h2}>Messages</div>
        <div style={hint}>Their quick-question thread. Replies here show up in their portal; nothing scatters to text or DMs.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {messages.length === 0 && <div style={hint}>No messages yet.</div>}
          {messages.map((m) => {
            const mine = m.sender === 'owner';
            return (
              <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '85%', padding: '9px 13px', borderRadius: 14, background: mine ? 'var(--text)' : 'var(--surface-4)', color: mine ? 'var(--bg)' : 'var(--text)' }}>
                <div style={{ fontSize: 'var(--text-body-sm)', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.body}</div>
                <div style={{ fontSize: 'var(--text-tiny)', opacity: 0.6, marginTop: 3 }}>{mine ? 'You' : client.contact_name || client.business_name} · {new Date(m.created_at).toLocaleString()}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'flex-end' }}>
          <textarea style={{ ...textareaStyle, minHeight: 44, flex: 1 }} placeholder="Reply…" value={msgDraft} onChange={(e) => setMsgDraft(e.target.value)} />
          <span style={{ ...primaryBtn, opacity: msgDraft.trim() ? 1 : 0.6, pointerEvents: msgDraft.trim() ? 'auto' : 'none' }} onClick={async () => { await portal.sendMessage(msgDraft); setMsgDraft(''); after(); }}>Send</span>
        </div>
      </div>

      {/* Handoff */}
      <div style={{ ...cardStyle, borderColor: settings?.handoff_mode ? 'color-mix(in srgb, var(--success) 45%, var(--border))' : 'var(--border)' }}>
        <div>
          <div style={h2}>Handoff mode {settings?.handoff_mode ? <span style={{ color: 'var(--success)' }}>· on</span> : ''}</div>
          <div style={hint}>When on: their portal leads with the guides, shows a completion checklist, tracks what they've opened, and a check-in lands in your reminders. Only credible once the numbers section has real results.</div>
        </div>
        {settings?.handoff_mode ? (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text)' }}>
              Since {settings.handoff_started_at ? new Date(settings.handoff_started_at).toLocaleDateString() : '—'} · {doneCount}/{assignments.length} guides done · {openedCount} opened{settings.handoff_checkin_on ? ` · check-in ${settings.handoff_checkin_on}` : ''}
            </div>
            <span style={{ ...ghostBtn, marginTop: 10 }} onClick={async () => { await portal.setHandoff(false, null, client.business_name); after(); }}>Turn off</span>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="date" style={{ ...inputStyle, width: 170 }} value={checkin} onChange={(e) => setCheckin(e.target.value)} />
            <span style={{ ...primaryBtn, opacity: assignments.length ? 1 : 0.6, pointerEvents: assignments.length ? 'auto' : 'none' }} onClick={async () => { await portal.setHandoff(true, checkin || null, client.business_name); after(); }}>Start handoff</span>
            {!assignments.length && <span style={hint}>Assign at least one guide first.</span>}
          </div>
        )}
      </div>

      <div style={{ ...cardStyle, fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
        Their login is sent automatically the moment their first invoice is paid (<code>sendClientLoginEmail</code> in <code>worker/handlers/billing.ts</code>, via mastermindsbymarq.com). If Resend isn't configured at that moment, it falls back to an owner reminder with the temp password so you can relay it yourself. Use “Give this client a login” on the client's CRM page for a manual/early login.
      </div>
    </div>
  );
}
