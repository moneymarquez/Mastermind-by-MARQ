import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { leadMediaUrl, sendLeadToCrm } from '../../../data/useLeadflow';
import { timeToMinutes, minutesToTime } from '../../../data/time';
import type { LeadflowLead } from '../../../data/useLeadflow';
import { leadTheme, TIER_COLOR } from './leadTheme';
import type { LeadSkin, LeadTheme } from './leadTheme';
import { LEAD_CALL_OUTCOMES, LEAD_OUTCOME_LABEL } from './leadOutcomes';
import { celebrate } from '../../../lib/fxEvents';
import {
  mapsUrl, streetViewUrl, websiteUrl, registryUrl, peopleSearchUrl,
  bestOwnerGuess, staleLabel, leadImagePaths, isTouched, hasOwnerContact,
} from './leadLinks';

/** One lead, rendered identically wherever it appears.
 *
 *  This used to live inside LeadFlowPool. It moved out because the same
 *  information is needed in three places — Lead Finder (to research the
 *  owner), Lead Pool (to keep the stock), and Dialing (to actually make the
 *  call) — and three copies of a card this detailed would drift apart
 *  within a week. Everything colour-related comes from leadTheme so the
 *  Dialing copy can wear the app's own skin without forking the markup.
 */

export type PatchLead = (id: string, patch: Partial<LeadflowLead>) => Promise<boolean>;
export type LogCall = (lead: LeadflowLead, status: string) => Promise<boolean>;

/** Signed thumbnails of the storefront, menu and food.
 *
 *  Signed on expand rather than for the whole pool: the URLs expire in an
 *  hour and most leads are never opened, so signing hundreds of leads' worth
 *  up front would be wasted round-trips against a TTL that outlives nothing. */
function LeadGallery({ paths, t }: { paths: string[]; t: LeadTheme }) {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const signed = await Promise.all(paths.map((p) => leadMediaUrl(p)));
      if (!cancelled) setUrls(signed.filter((u): u is string => !!u));
    })();
    return () => { cancelled = true; };
  }, [paths]);

  if (paths.length === 0) return null;
  return (
    <div>
      <div style={{ ...labelStyle(t), marginBottom: 6 }}>Photos</div>
      {urls.length === 0 ? (
        <div style={{ fontSize: 'var(--text-body)', color: t.faint }}>Loading photos…</div>
      ) : (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {urls.map((u) => (
            <a key={u} href={u} target="_blank" rel="noopener noreferrer" style={{ flex: '0 0 auto' }}>
              <img src={u} alt="" loading="lazy" style={{ height: 120, borderRadius: 'var(--radius-sm)', border: `1px solid ${t.border}`, display: 'block' }} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/** Copies text, with visible confirmation.
 *
 *  Exists because the Utah registry search is a form POST behind a Cloudflare
 *  bot check — there's no query parameter to prefill a business name into, so
 *  the name has to travel by clipboard and get pasted. Reports failure rather
 *  than silently doing nothing: clipboard writes can be refused outright
 *  (permissions, a non-secure context), and a button that looks like it
 *  worked but didn't is worse than one that admits it. */
function CopyButton({ text, label, t }: { text: string; label: string; t: LeadTheme }) {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const timer = setTimeout(() => setState('idle'), 1600);
    return () => clearTimeout(timer);
  }, [state]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState('ok');
    } catch {
      setState('fail');
    }
  };

  const face = state === 'ok' ? '✓ Copied' : state === 'fail' ? '✕ Copy blocked' : `📋 ${label}`;
  return (
    <button
      onClick={copy}
      disabled={!text}
      style={{
        padding: '7px 12px', borderRadius: 'var(--radius-sm)', cursor: text ? 'pointer' : 'default',
        border: `1px solid ${state === 'ok' ? '#16a34a' : t.border}`,
        background: state === 'ok' ? 'rgba(22,163,74,0.10)' : t.buttonBg,
        color: state === 'ok' ? '#16a34a' : state === 'fail' ? '#ef4444' : t.text,
        fontSize: 'var(--text-body)', fontWeight: 600,
      }}
    >
      {face}
    </button>
  );
}

const linkBtnStyle = (t: LeadTheme): CSSProperties => ({
  padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: `1px solid ${t.border}`,
  background: t.buttonBg, color: t.text, fontSize: 'var(--text-body)', fontWeight: 600,
  textDecoration: 'none', display: 'inline-block',
});

const labelStyle = (t: LeadTheme): CSSProperties => ({
  fontSize: 'var(--text-caption)', color: t.faint, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: 0.3,
});

const fieldStyle = (t: LeadTheme): CSSProperties => ({
  padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: `1px solid ${t.border}`,
  background: t.fieldBg, color: t.text,
  fontSize: 'var(--text-body)', fontFamily: 'inherit',
});

/** Log an attempt and keep notes on it. */
function CallLogSection({ lead, onLogCall, onPatch, t }: {
  lead: LeadflowLead; onLogCall: LogCall; onPatch: PatchLead; t: LeadTheme;
}) {
  const [notes, setNotes] = useState(lead.call_notes ?? '');
  const [saving, setSaving] = useState('');

  const log = async (status: string) => {
    setSaving(status);
    await onLogCall(lead, status);
    setSaving('');
  };

  const lastCalled = lead.last_called_at ? new Date(lead.last_called_at).toLocaleDateString() : null;
  const current = lead.status && lead.status !== 'new' ? lead.status : '';

  return (
    <div>
      <div style={{ ...labelStyle(t), marginBottom: 6 }}>Call outcome</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {LEAD_CALL_OUTCOMES.map((o) => {
          const active = current === o.value;
          return (
            <button
              key={o.value}
              onClick={() => log(o.value)}
              disabled={!!saving}
              style={{
                padding: '6px 12px', borderRadius: 'var(--radius-pill)', cursor: saving ? 'default' : 'pointer',
                border: `1px solid ${active ? o.color : t.border}`,
                background: active ? o.color : t.buttonBg,
                color: active ? '#fff' : o.color,
                fontSize: 'var(--text-body)', fontWeight: 600, opacity: saving && saving !== o.value ? 0.5 : 1,
              }}
            >
              {saving === o.value ? '…' : o.label}
            </button>
          );
        })}
      </div>

      {(current || lead.call_count) && (
        <div style={{ fontSize: 'var(--text-caption)', color: t.faint, marginTop: 6 }}>
          {current ? LEAD_OUTCOME_LABEL[current] ?? current : 'Logged'}
          {lead.call_count ? ` · ${lead.call_count} attempt${lead.call_count === 1 ? '' : 's'}` : ''}
          {lastCalled ? ` · last ${lastCalled}` : ''}
        </div>
      )}

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => notes !== (lead.call_notes ?? '') && onPatch(lead.id, { call_notes: notes.trim() || null })}
        placeholder="Call notes — who you spoke to, what they said, when to try again…"
        style={{
          ...fieldStyle(t), width: '100%', boxSizing: 'border-box', marginTop: 8,
          minHeight: 70, resize: 'vertical',
        }}
      />
    </div>
  );
}

/** The owner's real name and direct line, typed in by hand.
 *
 *  This is the payoff of the registry and people-search links above it: the
 *  scraper can't get owner details, so the answer arrives through those and
 *  lands here. Saving a name and a direct number lights the OWNER ✓ marker
 *  on the card — which stays alongside GO TIME, because knowing who to ask
 *  for is not the same as having called them. */
function OwnerSection({ lead, onPatch, t }: { lead: LeadflowLead; onPatch: PatchLead; t: LeadTheme }) {
  const [name, setName] = useState(lead.owner_name ?? '');
  const [phone, setPhone] = useState(lead.owner_phone ?? '');
  const [email, setEmail] = useState(lead.owner_email ?? '');
  const guess = bestOwnerGuess(lead);
  const people = peopleSearchUrl(name, lead);
  const known = hasOwnerContact({ owner_name: name, owner_phone: phone });

  const save = (patch: Partial<LeadflowLead>) => onPatch(lead.id, patch);

  return (
    <div>
      <div style={{ ...labelStyle(t), marginBottom: 6 }}>
        Owner contact {known && <span style={{ color: '#7c3aed' }}>· ✓ on file</span>}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== (lead.owner_name ?? '') && save({ owner_name: name.trim() || null })}
          placeholder="Owner name"
          style={{ ...fieldStyle(t), flex: '1 1 200px' }}
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onBlur={() => phone !== (lead.owner_phone ?? '') && save({ owner_phone: phone.trim() || null })}
          placeholder="Direct number"
          style={{ ...fieldStyle(t), flex: '1 1 150px' }}
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => email !== (lead.owner_email ?? '') && save({ owner_email: email.trim() || null })}
          placeholder="Email (optional)"
          style={{ ...fieldStyle(t), flex: '1 1 180px' }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
        {phone.trim() && (
          <a href={`tel:${phone.trim()}`} style={{ ...linkBtnStyle(t), color: '#7c3aed', borderColor: '#ddd6fe', background: 'rgba(124,58,237,0.08)' }}>
            📞 Call owner direct
          </a>
        )}
        <a
          href={people ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!people}
          style={{
            ...linkBtnStyle(t),
            background: people ? t.accent : t.buttonBg,
            color: people ? t.accentText : t.faint,
            borderColor: people ? t.accent : t.border,
            pointerEvents: people ? 'auto' : 'none',
          }}
        >
          🔎 TruePeopleSearch
        </a>
      </div>

      {!name && (guess || lead.registry_note) && (
        <div style={{ fontSize: 'var(--text-caption)', color: t.faint, marginTop: 6 }}>
          {guess ? `Registry suggested: ${guess}${lead.owner_is_agent_only ? ' (registered agent — may not be the owner)' : ''}` : lead.registry_note}
        </div>
      )}
    </div>
  );
}

/** A manual "look at this one carefully" marker, with an optional reason. */
function FlagSection({ lead, onPatch, t }: { lead: LeadflowLead; onPatch: PatchLead; t: LeadTheme }) {
  const flagged = !!lead.flagged;
  const [note, setNote] = useState(lead.flag_note ?? '');

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <button
        onClick={() => onPatch(lead.id, { flagged: !flagged })}
        style={{
          padding: '7px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
          border: `1px solid ${flagged ? '#fbbf24' : t.border}`,
          background: flagged ? 'rgba(251,191,36,0.16)' : t.buttonBg,
          color: flagged ? '#b45309' : t.text,
          fontSize: 'var(--text-body)', fontWeight: 600,
        }}
      >
        {flagged ? '🚩 Flagged' : '🏳 Flag this lead'}
      </button>
      {flagged && (
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note !== (lead.flag_note ?? '') && onPatch(lead.id, { flag_note: note.trim() || null })}
          placeholder="Why? e.g. gone quiet 4 yrs, check before calling"
          style={{ ...fieldStyle(t), flex: '1 1 240px' }}
        />
      )}
    </div>
  );
}

/** Books the kickoff call and hands the lead to Client CRM in one step.
 *
 *  Pick a slot, press once: a crm_clients row is created carrying the lead's
 *  context, and a 'scalez' calendar event is booked — the same event type and
 *  details shape the Event Adder writes, so it renders identically on the
 *  Schedule and in Daily Plan. The transcript gets pasted into the CRM after
 *  the call; this only has to get the client and the meeting to exist. */
function HandoffSection({ lead, t }: { lead: LeadflowLead; t: LeadTheme }) {
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const [date, setDate] = useState(tomorrow);
  const [time, setTime] = useState('10:00');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(lead.status === 'client');
  const [err, setErr] = useState('');

  const send = async () => {
    if (busy || !date || !time) return;
    setBusy(true);
    setErr('');
    try {
      // 30 minutes, matching what EventAdderModal books for an undragged
      // scalez appointment.
      await sendLeadToCrm(lead, date, time, minutesToTime(timeToMinutes(time) + 30));
      setDone(true);
      celebrate();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send to CRM.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div style={{ background: 'rgba(22,163,74,0.10)', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: 'var(--text-body)', color: '#16a34a' }}>
        ✓ Sent to Client CRM, kickoff call booked. Drop the transcript on the client's CRM page after the call.
      </div>
    );
  }

  return (
    <div>
      <div style={{ ...labelStyle(t), marginBottom: 6 }}>Send to Client CRM</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={fieldStyle(t)} />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={fieldStyle(t)} />
        <button
          onClick={send}
          disabled={busy || !date || !time}
          style={{
            padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: busy || !date || !time ? t.border : t.accent,
            color: busy || !date || !time ? t.faint : t.accentText,
            fontSize: 'var(--text-body)', fontWeight: 700,
            cursor: busy || !date || !time ? 'default' : 'pointer',
          }}
        >
          {busy ? 'Sending…' : '→ Create client + book call'}
        </button>
      </div>
      <div style={{ fontSize: 'var(--text-caption)', color: t.faint, marginTop: 6 }}>
        Creates the client at stage “new lead” with this lead's details and notes, and books a 30-minute call on your schedule.
      </div>
      {err && <div style={{ fontSize: 'var(--text-body)', color: '#ef4444', marginTop: 6 }}>{err}</div>}
    </div>
  );
}

/** Everything known about a lead, and every field you can fill in on it. */
export function LeadDetail({ lead, onLogCall, onPatch, skin = 'leadflow' }: {
  lead: LeadflowLead; onLogCall: LogCall; onPatch: PatchLead; skin?: LeadSkin;
}) {
  const t = leadTheme(skin);
  // Memoised because LeadGallery's effect keys off this array's identity:
  // rebuilt inline it would be a new array on every render, so every
  // keystroke in the name field below would re-sign every image.
  const imagePaths = useMemo(() => leadImagePaths(lead), [lead]);

  const sv = streetViewUrl(lead);
  const site = websiteUrl(lead.website);
  const reg = registryUrl(lead);
  const stale = staleLabel(lead.days_since_last_review);
  const label = labelStyle(t);
  const linkBtn = linkBtnStyle(t);

  return (
    <div style={{ borderTop: `1px solid ${t.detailBorder}`, marginTop: 12, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <LeadGallery paths={imagePaths} t={t} />
      {lead.summary && <div style={{ fontSize: 'var(--text-body)', color: t.muted, lineHeight: 1.5 }}>{lead.summary}</div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 24px', fontSize: 'var(--text-body)', color: t.text }}>
        {lead.address && <div><div style={label}>Address</div>{lead.address}</div>}
        {(lead.city || lead.state) && <div><div style={label}>City</div>{[lead.city, lead.state].filter(Boolean).join(', ')}</div>}
        {lead.category && <div><div style={label}>Category</div>{lead.category}</div>}
        {lead.fizzle_score != null && <div><div style={label}>Fizzle score</div>{lead.fizzle_score}{lead.tier ? ` · tier ${lead.tier}` : ''}</div>}
        {stale && <div><div style={label}>Last review</div>{stale} ago</div>}
        {lead.rating != null && <div><div style={label}>Rating</div>⭐ {lead.rating}{lead.review_count ? ` (${lead.review_count})` : ''}</div>}
      </div>

      {/* Why the scraper flagged this one — the actual talking points for the call. */}
      {lead.fizzle_reasons && lead.fizzle_reasons.length > 0 && (
        <div>
          <div style={{ ...label, marginBottom: 4 }}>Why this lead</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 'var(--text-body)', color: t.muted, lineHeight: 1.6 }}>
            {lead.fizzle_reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <a href={mapsUrl(lead)} target="_blank" rel="noopener noreferrer" style={linkBtn}>📍 Maps</a>
        {sv && <a href={sv} target="_blank" rel="noopener noreferrer" style={linkBtn}>👁 Street View</a>}
        {site && <a href={site} target="_blank" rel="noopener noreferrer" style={linkBtn}>🌐 Website</a>}
        <CopyButton text={lead.business_name} label="Copy name" t={t} />
        {reg && (
          // Copies on the way out too, so the single tap that opens the
          // registry also leaves the name ready to paste into its form.
          <a
            href={reg}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => { navigator.clipboard?.writeText(lead.business_name).catch(() => {}); }}
            style={linkBtn}
          >
            🏛 State registry
          </a>
        )}
      </div>
      {reg && (
        <div style={{ fontSize: 'var(--text-caption)', color: t.faint, marginTop: -6 }}>
          Opening the registry copies “{lead.business_name}” — paste it into Name, or use Principal Name to search an owner directly.
        </div>
      )}

      <OwnerSection lead={lead} onPatch={onPatch} t={t} />
      <FlagSection lead={lead} onPatch={onPatch} t={t} />
      <CallLogSection lead={lead} onLogCall={onLogCall} onPatch={onPatch} t={t} />
      <HandoffSection lead={lead} t={t} />
    </div>
  );
}

const badge = (bg: string, fg: string, bd: string): CSSProperties => ({
  padding: '3px 9px', borderRadius: 'var(--radius-pill)',
  background: bg, color: fg, border: `1px solid ${bd}`,
  fontSize: 'var(--text-caption)', fontWeight: 800, letterSpacing: 0.3, whiteSpace: 'nowrap',
});

/** The collapsed row plus, when open, the full detail beneath it. */
export default function LeadCard({ lead, open, onToggle, onPatch, onLogCall, skin = 'leadflow', actions }: {
  lead: LeadflowLead;
  open: boolean;
  onToggle: () => void;
  onPatch: PatchLead;
  onLogCall: LogCall;
  skin?: LeadSkin;
  actions?: ReactNode;
}) {
  const t = leadTheme(skin);
  const touched = isTouched(lead);
  const ownerKnown = hasOwnerContact(lead);
  const stale = staleLabel(lead.days_since_last_review);

  return (
    <div style={{ ...t.card, borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ flex: '1 1 240px', cursor: 'pointer', minWidth: 0 }} onClick={onToggle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {lead.tier && (
              <span style={{ fontSize: 'var(--text-caption)', fontWeight: 800, color: '#fff', background: TIER_COLOR[lead.tier] || '#9ca3af', borderRadius: 4, padding: '1px 6px' }}>{lead.tier}</span>
            )}
            <span style={{ fontWeight: 600, fontSize: 'var(--text-subhead)', color: t.text }}>{lead.business_name}</span>
            {lead.fizzle_score != null && <span style={{ fontSize: 'var(--text-caption)', color: t.faint }}>{lead.fizzle_score}</span>}
            {/* Sits on the title line, after the name and score: green when
                nobody has touched this lead, blue once it's been worked. */}
            <span style={touched
              ? badge('rgba(37,99,235,0.14)', '#2563eb', '#93c5fd')
              : badge('rgba(22,163,74,0.14)', '#15803d', '#86efac')}>
              {touched ? 'RECYCLED' : 'GO TIME'}
            </span>
            {/* Sits alongside GO TIME rather than replacing it — having the
                owner's number is research done, not a call made, so the lead
                is still up for grabs. */}
            {ownerKnown && (
              <span title={lead.owner_phone ?? ''} style={badge('rgba(124,58,237,0.12)', '#7c3aed', '#ddd6fe')}>✓ OWNER</span>
            )}
            {lead.flagged && (
              <span title={lead.flag_note ?? 'Flagged'} style={badge('rgba(251,191,36,0.18)', '#b45309', '#fbbf24')}>🚩 FLAGGED</span>
            )}
            {lead.dialing_queued && (
              <span style={badge('rgba(124,58,237,0.10)', '#7c3aed', '#c4b5fd')}>☎ IN DIALING</span>
            )}
          </div>

          <div style={{ fontSize: 'var(--text-body)', color: t.faint, marginTop: 2 }}>
            {/* City before state, both shown — "Sandy · UT" is what tells you
                whether this lead belongs in today's session. */}
            {[lead.category || lead.industry, [lead.city, lead.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
            {lead.review_count ? ` · ⭐ ${lead.review_count}` : ''}
            {stale ? ` · last review ${stale} ago` : ''}
          </div>

          {ownerKnown && lead.owner_phone && (
            <a href={`tel:${lead.owner_phone}`} onClick={(e) => e.stopPropagation()} style={{ fontSize: 'var(--text-body)', color: '#7c3aed', fontWeight: 700, textDecoration: 'none', marginTop: 4, display: 'block' }}>
              📞 {lead.owner_name}: {lead.owner_phone}
            </a>
          )}
          {lead.phone && (
            <a href={`tel:${lead.phone}`} onClick={(e) => e.stopPropagation()} style={{ fontSize: 'var(--text-body)', color: t.accent === 'var(--text)' ? t.text : t.accent, fontWeight: 600, textDecoration: 'none', marginTop: 4, display: 'inline-block' }}>
              📞 {lead.phone}
            </a>
          )}
          {touched && (
            <div style={{ fontSize: 'var(--text-caption)', color: '#2563eb', marginTop: 4, fontWeight: 600 }}>
              {lead.status && lead.status !== 'new' ? (LEAD_OUTCOME_LABEL[lead.status] ?? lead.status) : 'Worked'}
              {lead.call_count ? ` · ${lead.call_count} attempt${lead.call_count === 1 ? '' : 's'}` : ''}
              {lead.last_called_at ? ` · ${new Date(lead.last_called_at).toLocaleDateString()}` : ''}
            </div>
          )}
          {touched && lead.call_notes && (
            <div style={{ fontSize: 'var(--text-caption)', color: t.faint, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 420 }}>
              {lead.call_notes}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={onToggle} style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: `1px solid ${t.border}`, background: t.buttonBg, color: t.text, cursor: 'pointer', fontSize: 'var(--text-body)', fontWeight: 500 }}>
            {open ? 'Less' : 'Details'}
          </button>
          {actions}
        </div>
      </div>
      {open && <LeadDetail lead={lead} onLogCall={onLogCall} onPatch={onPatch} skin={skin} />}
    </div>
  );
}
