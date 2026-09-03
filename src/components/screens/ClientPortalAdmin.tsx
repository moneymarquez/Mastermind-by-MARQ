import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useClientPortalAdmin } from '../../data/useClientPortalAdmin';
import type { BriefForPortal } from '../../data/useClientPortalAdmin';
import type { CrmClientWithChildren } from '../../data/useClientCRM';
import type { ClientDeliverable, DeliverableKind, DeliverableStatus, PortalModule, PortalTimelineItem } from '../../data/types';
import { DELIVERABLE_KINDS } from '../../data/types';
import { cardStyle, inputStyle, selectStyle, primaryBtn, ghostBtn } from './ClientCRMScreen';

interface Props {
  client: CrmClientWithChildren;
}

const textareaStyle: CSSProperties = { ...inputStyle, minHeight: 80, resize: 'vertical', lineHeight: 1.5, fontFamily: 'inherit', fontSize: 16 };
const label: CSSProperties = { fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginBottom: 6, marginTop: 12 };
const h2: CSSProperties = { fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' };
const hint: CSSProperties = { fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 4, lineHeight: 1.5 };
const STATUSES: { key: DeliverableStatus; label: string }[] = [
  { key: 'in_progress', label: 'In progress' },
  { key: 'review', label: 'In review' },
  { key: 'live', label: 'Live' },
];

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

function DeliverableRow({ d, onSave, onRemove }: { d: ClientDeliverable; onSave: (patch: Partial<ClientDeliverable>) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(d.title);
  const [what, setWhat] = useState(d.what_it_is ?? '');
  const [why, setWhy] = useState(d.why_it_matters ?? '');
  const [link, setLink] = useState(d.link_url ?? '');
  const color = d.status === 'live' ? 'var(--success)' : d.status === 'review' ? 'var(--warning)' : 'var(--text-tertiary)';
  return (
    <div style={{ ...cardStyle, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setOpen((v) => !v)}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>{d.title}</div>
          <div style={hint}>{DELIVERABLE_KINDS.find((k) => k.key === d.kind)?.label} · <span style={{ color }}>{STATUSES.find((s) => s.key === d.status)?.label}</span>{!d.why_it_matters ? ' · no “why” yet' : ''}</div>
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
          <div style={label}>Link (live site, profile, folder)</div>
          <input style={inputStyle} inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={link} onChange={(e) => setLink(e.target.value)} onBlur={() => link !== (d.link_url ?? '') && onSave({ link_url: link.trim() || null })} placeholder="https://" />
          <div style={{ marginTop: 10 }}>
            <span style={{ ...ghostBtn, color: 'var(--text-tertiary)' }} onClick={onRemove}>Remove</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClientPortalAdmin({ client }: Props) {
  const portal = useClientPortalAdmin(client.id);
  const { settings, deliverables, modules, assignments, messages, briefs } = portal;

  const [welcome, setWelcome] = useState('');
  const [logo, setLogo] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [newTimeline, setNewTimeline] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newKind, setNewKind] = useState<DeliverableKind>('website');
  const [prefillBrief, setPrefillBrief] = useState('');
  const [showAllModules, setShowAllModules] = useState(false);
  const [msgDraft, setMsgDraft] = useState('');
  const [checkin, setCheckin] = useState('');
  const [autoNote, setAutoNote] = useState('');

  useEffect(() => {
    setWelcome(settings?.welcome_text ?? '');
    setLogo(settings?.logo_url ?? '');
    setNextSteps(settings?.next_steps ?? '');
    setCheckin(settings?.handoff_checkin_on ?? '');
  }, [settings]);

  useEffect(() => {
    if (messages.some((m) => m.sender === 'client' && !m.read_at)) portal.markClientMessagesRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  const timeline: PortalTimelineItem[] = settings?.timeline ?? [];
  const saveTimeline = (next: PortalTimelineItem[]) => portal.saveSettings({ timeline: next });

  const relevant = portal.relevantModules();
  const assignedIds = new Set(assignments.map((a) => a.module_id));
  const assignedModules = modules.filter((m) => assignedIds.has(m.id));
  const doneCount = assignments.filter((a) => a.completed_at).length;
  const openedCount = assignments.filter((a) => a.opened_at).length;

  const addDeliverable = async () => {
    const b = briefs.find((x) => x.id === prefillBrief) ?? null;
    const pre = b ? prefillFromBrief(b) : null;
    const title = newTitle.trim() || pre?.title || '';
    if (!title) return;
    await portal.addDeliverable({ kind: newKind, title, what_it_is: pre?.what_it_is || null, why_it_matters: pre?.why_it_matters || null, brief_id: b?.id ?? null });
    setNewTitle('');
    setPrefillBrief('');
  };

  const moduleRow = (m: PortalModule) => {
    const a = assignments.find((x) => x.module_id === m.id);
    return (
      <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid var(--border)' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text)', fontWeight: 600 }}>{m.title}</div>
          <div style={hint}>
            {m.applies_to.length ? m.applies_to.map((k) => DELIVERABLE_KINDS.find((x) => x.key === k)?.label ?? k).join(', ') : 'Every client'}
            {a ? ` · ${a.completed_at ? 'done ✓' : a.opened_at ? 'opened' : 'not opened yet'}` : ''}
            {!m.video_url ? ' · no video yet' : ''}
          </div>
        </div>
        <span style={a ? { ...ghostBtn, borderColor: 'var(--success)', color: 'var(--success)' } : ghostBtn} onClick={() => (a ? portal.unassignModule(m.id) : portal.assignModule(m.id))}>
          {a ? 'Assigned ✓' : 'Assign'}
        </span>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 640, marginTop: 16 }}>
      <div style={{ ...cardStyle, fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
        This is what {client.business_name} sees when they sign in through “Client login” on the homepage. Everything here is theirs only; they never see the Masterminds tool. Nothing on their side is generated — if you leave it blank, they see an honest “not written yet”.
      </div>

      {/* A. Welcome */}
      <div style={cardStyle}>
        <div style={h2}>Welcome</div>
        <div style={hint}>One paragraph on what was built and why. The timeline and “what happens next” sit under it.</div>
        <div style={label}>Welcome note</div>
        <textarea style={textareaStyle} value={welcome} onChange={(e) => setWelcome(e.target.value)} onBlur={() => welcome !== (settings?.welcome_text ?? '') && portal.saveSettings({ welcome_text: welcome.trim() || null })} placeholder={`Hey ${client.contact_name?.split(' ')[0] || 'there'} — here's what we built for ${client.business_name} and why…`} />
        <div style={label}>Logo URL (optional)</div>
        <input style={inputStyle} inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={logo} onChange={(e) => setLogo(e.target.value)} onBlur={() => logo !== (settings?.logo_url ?? '') && portal.saveSettings({ logo_url: logo.trim() || null })} placeholder="https://…/logo.png" />
        <div style={label}>Timeline</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {timeline.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ cursor: 'pointer', fontWeight: 700, color: t.done ? 'var(--success)' : 'var(--text-tertiary)', width: 18 }} onClick={() => saveTimeline(timeline.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}>{t.done ? '✓' : '○'}</span>
              <span style={{ flex: 1, fontSize: 'var(--text-body-sm)', color: 'var(--text)' }}>{t.label}</span>
              <input type="date" style={{ ...inputStyle, width: 150 }} value={t.date ?? ''} onChange={(e) => saveTimeline(timeline.map((x, j) => (j === i ? { ...x, date: e.target.value || null } : x)))} />
              <span style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={() => saveTimeline(timeline.filter((_, j) => j !== i))}>✕</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={inputStyle} placeholder="Add a step — e.g. Discovery call, Design approved, Site live" value={newTimeline} onChange={(e) => setNewTimeline(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newTimeline.trim()) { saveTimeline([...timeline, { label: newTimeline.trim(), date: null, done: false }]); setNewTimeline(''); } }} />
            <span style={ghostBtn} onClick={() => { if (newTimeline.trim()) { saveTimeline([...timeline, { label: newTimeline.trim(), date: null, done: false }]); setNewTimeline(''); } }}>Add</span>
          </div>
        </div>
        <div style={label}>What happens next</div>
        <textarea style={textareaStyle} value={nextSteps} onChange={(e) => setNextSteps(e.target.value)} onBlur={() => nextSteps !== (settings?.next_steps ?? '') && portal.saveSettings({ next_steps: nextSteps.trim() || null })} />
      </div>

      {/* B. What we built */}
      <div style={cardStyle}>
        <div style={h2}>What we built ({deliverables.length})</div>
        <div style={hint}>One card per deliverable. The “why it matters” is the part they read — pull it from the Brand Lab brief where the reasoning is already written, then make it theirs.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {deliverables.map((d) => (
            <DeliverableRow key={d.id} d={d} onSave={(patch) => portal.updateDeliverable(d.id, patch)} onRemove={() => portal.removeDeliverable(d.id)} />
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

      {/* D. Operating modules */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={h2}>Guides — how to run it ({assignedModules.length} assigned)</div>
            <div style={hint}>Matched to what was actually delivered: a client without a website never sees website guides. {assignments.length ? `${openedCount} opened · ${doneCount} done.` : ''}</div>
          </div>
          <span style={ghostBtn} onClick={async () => { const n = await portal.autoAssign(); setAutoNote(n ? `Assigned ${n} guide${n === 1 ? '' : 's'}.` : 'Nothing new to assign.'); }}>Assign all relevant</span>
        </div>
        {autoNote && <div style={{ ...hint, color: 'var(--success)' }}>{autoNote}</div>}
        {deliverables.length === 0 && <div style={{ ...hint, marginTop: 8 }}>Add a deliverable first — relevance is decided by its kind.</div>}
        <div style={{ marginTop: 8 }}>
          {relevant.map(moduleRow)}
        </div>
        {modules.filter((m) => !relevant.includes(m)).length > 0 && (
          <div style={{ marginTop: 10 }}>
            <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={() => setShowAllModules((v) => !v)}>{showAllModules ? 'Hide' : 'Show'} guides that don't match this client's deliverables</span>
            {showAllModules && modules.filter((m) => !relevant.includes(m)).map(moduleRow)}
          </div>
        )}
      </div>

      {/* F. Messages */}
      <div style={cardStyle}>
        <div style={h2}>Messages</div>
        <div style={hint}>Their thread with you. Replies here show up in their portal; nothing scatters to text or DMs.</div>
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
          <span style={{ ...primaryBtn, opacity: msgDraft.trim() ? 1 : 0.6, pointerEvents: msgDraft.trim() ? 'auto' : 'none' }} onClick={async () => { await portal.sendMessage(msgDraft); setMsgDraft(''); }}>Send</span>
        </div>
      </div>

      {/* 2.4 Handoff mode */}
      <div style={{ ...cardStyle, borderColor: settings?.handoff_mode ? 'color-mix(in srgb, var(--success) 45%, var(--border))' : 'var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={h2}>Handoff mode {settings?.handoff_mode ? <span style={{ color: 'var(--success)' }}>· on</span> : ''}</div>
            <div style={hint}>When on: their portal leads with the guides, shows a completion checklist, tracks what they've opened, and a check-in lands in your reminders. Only credible once the numbers section has real results.</div>
          </div>
        </div>
        {settings?.handoff_mode ? (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text)' }}>
              Since {settings.handoff_started_at ? new Date(settings.handoff_started_at).toLocaleDateString() : '—'} · {doneCount}/{assignments.length} guides done · {openedCount} opened{settings.handoff_checkin_on ? ` · check-in ${settings.handoff_checkin_on}` : ''}
            </div>
            <span style={{ ...ghostBtn, marginTop: 10 }} onClick={() => portal.setHandoff(false, null, client.business_name)}>Turn off</span>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="date" style={{ ...inputStyle, width: 170 }} value={checkin} onChange={(e) => setCheckin(e.target.value)} />
            <span style={{ ...primaryBtn, opacity: assignments.length ? 1 : 0.6, pointerEvents: assignments.length ? 'auto' : 'none' }} onClick={() => portal.setHandoff(true, checkin || null, client.business_name)}>Start handoff</span>
            {!assignments.length && <span style={hint}>Assign at least one guide first.</span>}
          </div>
        )}
      </div>

      {/* 2.3 Onboarding email — sent automatically on first paid invoice, not from here. */}
      <div style={{ ...cardStyle, fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
        The login itself is sent automatically the moment a client's first invoice is paid (<code>sendClientLoginEmail</code> in <code>worker/handlers/billing.ts</code>, via mastermindsbymarq.com). If Resend isn't configured when that happens, it falls back to an owner reminder with the temp password so you can relay it yourself. Use “Give this client a login” above for a manual/early login instead.
      </div>
    </div>
  );
}
