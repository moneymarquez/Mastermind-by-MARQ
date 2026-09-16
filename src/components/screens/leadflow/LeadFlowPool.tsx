import { useEffect, useMemo, useState } from 'react';
import { useLeadflowPool, leadMediaUrl, sendLeadToCrm } from '../../../data/useLeadflow';
import { timeToMinutes, minutesToTime } from '../../../data/time';
import type { LeadflowLead } from '../../../data/useLeadflow';
import { GREEN } from './shared';
import NotConnectedBanner from './NotConnectedBanner';
import { mapsUrl, streetViewUrl, websiteUrl, registryUrl, peopleSearchUrl, bestOwnerGuess, staleLabel, leadImagePaths, isTouched, hasOwnerContact } from './leadLinks';

/** Signed thumbnails of the storefront, menu and food.
 *
 *  Signed on expand rather than for the whole pool: the URLs expire in an
 *  hour and most leads are never opened, so signing 353 leads' worth up
 *  front would be wasted round-trips against a TTL that outlives nothing. */
function LeadGallery({ paths }: { paths: string[] }) {
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
      <div style={{ fontSize: 'var(--text-caption)', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6 }}>Photos</div>
      {urls.length === 0 ? (
        <div style={{ fontSize: 'var(--text-body)', color: '#9ca3af' }}>Loading photos…</div>
      ) : (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {urls.map((u) => (
            <a key={u} href={u} target="_blank" rel="noopener noreferrer" style={{ flex: '0 0 auto' }}>
              <img src={u} alt="" loading="lazy" style={{ height: 120, borderRadius: 'var(--radius-sm)', border: '1px solid #e5e7eb', display: 'block' }} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

const TIER_COLOR: Record<string, string> = { A: '#16a34a', B: '#ca8a04', C: '#9ca3af' };

/** Copies text, with visible confirmation.
 *
 *  Exists because the Utah registry search is a form POST behind a Cloudflare
 *  bot check — there's no query parameter to prefill a business name into, so
 *  the name has to travel by clipboard and get pasted. Reports failure rather
 *  than silently doing nothing: clipboard writes can be refused outright
 *  (permissions, a non-secure context), and a button that looks like it
 *  worked but didn't is worse than one that admits it. */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const t = setTimeout(() => setState('idle'), 1600);
    return () => clearTimeout(t);
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
        border: `1px solid ${state === 'ok' ? '#16a34a' : '#e5e7eb'}`,
        background: state === 'ok' ? '#f0fdf4' : '#fff',
        color: state === 'ok' ? '#16a34a' : state === 'fail' ? '#ef4444' : '#374151',
        fontSize: 'var(--text-body)', fontWeight: 600,
      }}
    >
      {face}
    </button>
  );
}

const linkBtn: React.CSSProperties = {
  padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid #e5e7eb',
  background: '#fff', color: '#374151', fontSize: 'var(--text-body)', fontWeight: 600,
  textDecoration: 'none', display: 'inline-block',
};
const label: React.CSSProperties = { fontSize: 'var(--text-caption)', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 };

/** What happened on an attempt. Kept as plain statuses on the lead rather
 *  than a call-log table: the useful question here is "where does this one
 *  stand right now", and the attempt count plus last-called date answers the
 *  rest without another table to join. */
// Values must match the leads_status_check constraint (schema_090) — a value
// outside it is rejected outright by Postgres, not quietly ignored.
const CALL_OUTCOMES: { value: string; label: string; color: string }[] = [
  { value: 'no_answer', label: 'No answer', color: '#6b7280' },
  { value: 'voicemail', label: 'Left voicemail', color: '#6b7280' },
  { value: 'gatekeeper', label: "Couldn't reach owner", color: '#ca8a04' },
  { value: 'callback', label: 'Callback later', color: '#2563eb' },
  { value: 'interested', label: 'Interested', color: '#16a34a' },
  { value: 'not_interested', label: 'Not interested', color: '#ef4444' },
];

const OUTCOME_LABEL: Record<string, string> = Object.fromEntries(
  CALL_OUTCOMES.map((o) => [o.value, o.label]),
);

/** Log an attempt and keep notes on it. */
function CallLogSection({
  lead,
  onLogCall,
  onPatch,
}: {
  lead: LeadflowLead;
  onLogCall: (lead: LeadflowLead, status: string) => Promise<boolean>;
  onPatch: (id: string, patch: Partial<LeadflowLead>) => Promise<boolean>;
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
      <div style={{ ...label, marginBottom: 6 }}>Call outcome</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {CALL_OUTCOMES.map((o) => {
          const active = current === o.value;
          return (
            <button
              key={o.value}
              onClick={() => log(o.value)}
              disabled={!!saving}
              style={{
                padding: '6px 12px', borderRadius: 'var(--radius-pill)', cursor: saving ? 'default' : 'pointer',
                border: `1px solid ${active ? o.color : '#e5e7eb'}`,
                background: active ? o.color : '#fff',
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
        <div style={{ fontSize: 'var(--text-caption)', color: '#9ca3af', marginTop: 6 }}>
          {current ? OUTCOME_LABEL[current] ?? current : 'Logged'}
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
          width: '100%', boxSizing: 'border-box', marginTop: 8, minHeight: 70, padding: '8px 12px',
          borderRadius: 'var(--radius-sm)', border: '1px solid #e5e7eb', fontSize: 'var(--text-body)',
          fontFamily: 'inherit', resize: 'vertical',
        }}
      />
    </div>
  );
}


const fieldStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid #e5e7eb',
  fontSize: 'var(--text-body)', fontFamily: 'inherit',
};

/** The owner's real name and direct line, typed in by hand.
 *
 *  This is the payoff of the registry and people-search links above it: the
 *  scraper can't get owner details, so the answer arrives through those and
 *  lands here. Saving a name and a direct number lights the OWNER ✓ marker
 *  on the card — which stays alongside GO TIME, because knowing who to ask
 *  for is not the same as having called them. */
function OwnerSection({ lead, onPatch }: {
  lead: LeadflowLead;
  onPatch: (id: string, patch: Partial<LeadflowLead>) => Promise<boolean>;
}) {
  const [name, setName] = useState(lead.owner_name ?? '');
  const [phone, setPhone] = useState(lead.owner_phone ?? '');
  const [email, setEmail] = useState(lead.owner_email ?? '');
  const guess = bestOwnerGuess(lead);
  const people = peopleSearchUrl(name, lead);
  const known = hasOwnerContact({ owner_name: name, owner_phone: phone });

  const save = (patch: Partial<LeadflowLead>) => onPatch(lead.id, patch);

  return (
    <div>
      <div style={{ ...label, marginBottom: 6 }}>
        Owner contact {known && <span style={{ color: '#7c3aed' }}>· ✓ on file</span>}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== (lead.owner_name ?? '') && save({ owner_name: name.trim() || null })}
          placeholder="Owner name"
          style={{ ...fieldStyle, flex: '1 1 200px' }}
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onBlur={() => phone !== (lead.owner_phone ?? '') && save({ owner_phone: phone.trim() || null })}
          placeholder="Direct number"
          style={{ ...fieldStyle, flex: '1 1 150px' }}
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => email !== (lead.owner_email ?? '') && save({ owner_email: email.trim() || null })}
          placeholder="Email (optional)"
          style={{ ...fieldStyle, flex: '1 1 180px' }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
        {phone.trim() && (
          <a href={`tel:${phone.trim()}`} style={{ ...linkBtn, color: '#7c3aed', borderColor: '#ddd6fe', background: '#faf5ff' }}>
            📞 Call owner direct
          </a>
        )}
        <a
          href={people ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!people}
          style={{ ...linkBtn, background: people ? GREEN : '#f3f4f6', color: people ? '#fff' : '#9ca3af', borderColor: people ? GREEN : '#e5e7eb', pointerEvents: people ? 'auto' : 'none' }}
        >
          🔎 TruePeopleSearch
        </a>
      </div>

      {!name && (guess || lead.registry_note) && (
        <div style={{ fontSize: 'var(--text-caption)', color: '#9ca3af', marginTop: 6 }}>
          {guess ? `Registry suggested: ${guess}${lead.owner_is_agent_only ? ' (registered agent — may not be the owner)' : ''}` : lead.registry_note}
        </div>
      )}
    </div>
  );
}

/** A manual "look at this one carefully" marker, with an optional reason. */
function FlagSection({ lead, onPatch }: {
  lead: LeadflowLead;
  onPatch: (id: string, patch: Partial<LeadflowLead>) => Promise<boolean>;
}) {
  const flagged = !!lead.flagged;
  const [note, setNote] = useState(lead.flag_note ?? '');

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={() => onPatch(lead.id, { flagged: !flagged })}
          style={{
            padding: '7px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
            border: `1px solid ${flagged ? '#fbbf24' : '#e5e7eb'}`,
            background: flagged ? '#fef3c7' : '#fff',
            color: flagged ? '#92400e' : '#374151',
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
            style={{ ...fieldStyle, flex: '1 1 240px' }}
          />
        )}
      </div>
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
function HandoffSection({ lead }: { lead: LeadflowLead }) {
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
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send to CRM.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: 'var(--text-body)', color: '#166534' }}>
        ✓ Sent to Client CRM, kickoff call booked. Drop the transcript on the client's CRM page after the call.
      </div>
    );
  }

  return (
    <div>
      <div style={{ ...label, marginBottom: 6 }}>Send to Client CRM</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid #e5e7eb', fontSize: 'var(--text-body)' }} />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid #e5e7eb', fontSize: 'var(--text-body)' }} />
        <button
          onClick={send}
          disabled={busy || !date || !time}
          style={{
            padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: busy || !date || !time ? '#d1d5db' : GREEN, color: '#fff',
            fontSize: 'var(--text-body)', fontWeight: 700,
            cursor: busy || !date || !time ? 'default' : 'pointer',
          }}
        >
          {busy ? 'Sending…' : '→ Create client + book call'}
        </button>
      </div>
      <div style={{ fontSize: 'var(--text-caption)', color: '#9ca3af', marginTop: 6 }}>
        Creates the client at stage “new lead” with this lead's details and notes, and books a 30-minute call on your schedule.
      </div>
      {err && <div style={{ fontSize: 'var(--text-body)', color: '#ef4444', marginTop: 6 }}>{err}</div>}
    </div>
  );
}

function Detail({ lead, onLogCall, onPatch }: {
  lead: LeadflowLead;
  onLogCall: (lead: LeadflowLead, status: string) => Promise<boolean>;
  onPatch: (id: string, patch: Partial<LeadflowLead>) => Promise<boolean>;
}) {
  // Memoised because LeadGallery's effect keys off this array's identity:
  // rebuilt inline it would be a new array on every render, so every
  // keystroke in the name field below would re-sign every image.
  const imagePaths = useMemo(() => leadImagePaths(lead), [lead]);

  const sv = streetViewUrl(lead);
  const site = websiteUrl(lead.website);
  const reg = registryUrl(lead);
  const stale = staleLabel(lead.days_since_last_review);

  return (
    <div style={{ borderTop: '1px solid #f3f4f6', marginTop: 12, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <LeadGallery paths={imagePaths} />
      {lead.summary && <div style={{ fontSize: 'var(--text-body)', color: '#4b5563', lineHeight: 1.5 }}>{lead.summary}</div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 24px', fontSize: 'var(--text-body)' }}>
        {lead.address && <div><div style={label}>Address</div>{lead.address}</div>}
        {lead.category && <div><div style={label}>Category</div>{lead.category}</div>}
        {lead.fizzle_score != null && <div><div style={label}>Fizzle score</div>{lead.fizzle_score}{lead.tier ? ` · tier ${lead.tier}` : ''}</div>}
        {stale && <div><div style={label}>Last review</div>{stale} ago</div>}
        {lead.rating != null && <div><div style={label}>Rating</div>⭐ {lead.rating}{lead.review_count ? ` (${lead.review_count})` : ''}</div>}
      </div>

      {/* Why the scraper flagged this one — the actual talking points for the call. */}
      {lead.fizzle_reasons && lead.fizzle_reasons.length > 0 && (
        <div>
          <div style={{ ...label, marginBottom: 4 }}>Why this lead</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 'var(--text-body)', color: '#4b5563', lineHeight: 1.6 }}>
            {lead.fizzle_reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}


      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <a href={mapsUrl(lead)} target="_blank" rel="noopener noreferrer" style={linkBtn}>📍 Maps</a>
        {sv && <a href={sv} target="_blank" rel="noopener noreferrer" style={linkBtn}>👁 Street View</a>}
        {site && <a href={site} target="_blank" rel="noopener noreferrer" style={linkBtn}>🌐 Website</a>}
        <CopyButton text={lead.business_name} label="Copy name" />
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
        <div style={{ fontSize: 'var(--text-caption)', color: '#9ca3af', marginTop: -6 }}>
          Opening the registry copies “{lead.business_name}” — paste it into Name, or use Principal Name to search an owner directly.
        </div>
      )}

      <OwnerSection lead={lead} onPatch={onPatch} />

      <FlagSection lead={lead} onPatch={onPatch} />

      <CallLogSection lead={lead} onLogCall={onLogCall} onPatch={onPatch} />

      <HandoffSection lead={lead} />
    </div>
  );
}

export default function LeadFlowPool() {
  const { pool, loading, notConnected, removeFromPool, patchLead, logCall } = useLeadflowPool();
  const [sortBy, setSortBy] = useState<'industry' | 'reviews' | 'score'>('score');
  const [openId, setOpenId] = useState<string | null>(null);

  const sorted = [...pool].sort((a, b) => {
    // Worked leads sink, always — ahead of whichever sort is selected — so
    // the top of the list is only ever leads nobody has touched yet.
    const at = isTouched(a) ? 1 : 0;
    const bt = isTouched(b) ? 1 : 0;
    if (at !== bt) return at - bt;
    if (sortBy === 'industry') return (a.industry || '').localeCompare(b.industry || '');
    if (sortBy === 'score') return (b.fizzle_score || 0) - (a.fizzle_score || 0);
    return (b.review_count || 0) - (a.review_count || 0);
  });
  const freshCount = pool.filter((l) => !isTouched(l)).length;

  const sortBtn = (key: typeof sortBy, text: string) => (
    <button onClick={() => setSortBy(key)} style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid #e5e7eb', background: sortBy === key ? GREEN : '#fff', color: sortBy === key ? '#fff' : '#374151', cursor: 'pointer', fontWeight: 500 }}>{text}</button>
  );

  return (
    <div>
      {notConnected && <NotConnectedBanner />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: 4 }}>Lead Pool</h1>
          <p style={{ color: '#9ca3af', fontSize: 'var(--text-subhead)' }}>{freshCount} untouched · {pool.length - freshCount} worked</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {sortBtn('score', 'By Score')}
          {sortBtn('industry', 'By Industry')}
          {sortBtn('reviews', 'By Reviews')}
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#9ca3af' }}>Loading pool...</p>
      ) : pool.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 'var(--radius-2xl)', padding: '3rem', textAlign: 'center', border: '1px solid #f3f4f6' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🎯</div>
          <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Your pool is empty</h3>
          <p style={{ color: '#9ca3af' }}>Go to Lead Finder and click "+ Pool" on any lead to add them here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map((lead) => {
            const open = openId === lead.id;
            const touched = isTouched(lead);
            const ownerKnown = hasOwnerContact(lead);
            const stale = staleLabel(lead.days_since_last_review);
            return (
              <div key={lead.id} style={{ background: '#fff', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ flex: '1 1 240px', cursor: 'pointer' }} onClick={() => setOpenId(open ? null : lead.id)}>
                    <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {lead.tier && (
                        <span style={{ fontSize: 'var(--text-caption)', fontWeight: 800, color: '#fff', background: TIER_COLOR[lead.tier] || '#9ca3af', borderRadius: 4, padding: '1px 6px' }}>{lead.tier}</span>
                      )}
                      <span style={{ fontWeight: 600, fontSize: 'var(--text-subhead)' }}>{lead.business_name}</span>
                      {lead.fizzle_score != null && <span style={{ fontSize: 'var(--text-caption)', color: '#9ca3af' }}>{lead.fizzle_score}</span>}
                      {/* Sits on the title line, after the name and score:
                          green when nobody has touched this lead, blue once
                          it's been worked. */}
                      <span style={{
                        padding: '3px 9px', borderRadius: 'var(--radius-pill)',
                        background: touched ? '#dbeafe' : '#dcfce7',
                        color: touched ? '#1d4ed8' : '#15803d',
                        border: `1px solid ${touched ? '#93c5fd' : '#86efac'}`,
                        fontSize: 'var(--text-caption)', fontWeight: 800, letterSpacing: 0.3, whiteSpace: 'nowrap',
                      }}>
                        {touched ? 'RECYCLED' : 'GO TIME'}
                      </span>
                      {/* Sits alongside GO TIME rather than replacing it —
                          having the owner's number is research done, not a
                          call made, so the lead is still up for grabs. */}
                      {ownerKnown && (
                        <span title={lead.owner_phone ?? ''} style={{
                          padding: '3px 9px', borderRadius: 'var(--radius-pill)',
                          background: '#faf5ff', color: '#7c3aed', border: '1px solid #ddd6fe',
                          fontSize: 'var(--text-caption)', fontWeight: 800, letterSpacing: 0.3, whiteSpace: 'nowrap',
                        }}>
                          ✓ OWNER
                        </span>
                      )}
                      {lead.flagged && (
                        <span title={lead.flag_note ?? 'Flagged'} style={{
                          padding: '3px 9px', borderRadius: 'var(--radius-pill)',
                          background: '#fef3c7', color: '#92400e', border: '1px solid #fbbf24',
                          fontSize: 'var(--text-caption)', fontWeight: 800, letterSpacing: 0.3, whiteSpace: 'nowrap',
                        }}>
                          🚩 FLAGGED
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 'var(--text-body)', color: '#9ca3af', marginTop: 2 }}>
                      {[lead.category || lead.industry, lead.city || lead.state].filter(Boolean).join(' · ')}
                      {lead.review_count ? ` · ⭐ ${lead.review_count}` : ''}
                      {stale ? ` · last review ${stale} ago` : ''}
                    </div>
                    {ownerKnown && lead.owner_phone && (
                      <a href={`tel:${lead.owner_phone}`} onClick={(e) => e.stopPropagation()} style={{ fontSize: 'var(--text-body)', color: '#7c3aed', fontWeight: 700, textDecoration: 'none', marginTop: 4, display: 'block' }}>
                        📞 {lead.owner_name}: {lead.owner_phone}
                      </a>
                    )}
                    {lead.phone && <a href={`tel:${lead.phone}`} onClick={(e) => e.stopPropagation()} style={{ fontSize: 'var(--text-body)', color: GREEN, fontWeight: 600, textDecoration: 'none', marginTop: 4, display: 'inline-block' }}>📞 {lead.phone}</a>}
                    {touched && (
                      <div style={{ fontSize: 'var(--text-caption)', color: '#1d4ed8', marginTop: 4, fontWeight: 600 }}>
                        {lead.status && lead.status !== 'new' ? (OUTCOME_LABEL[lead.status] ?? lead.status) : 'Worked'}
                        {lead.call_count ? ` · ${lead.call_count} attempt${lead.call_count === 1 ? '' : 's'}` : ''}
                        {lead.last_called_at ? ` · ${new Date(lead.last_called_at).toLocaleDateString()}` : ''}
                      </div>
                    )}
                    {touched && lead.call_notes && (
                      <div style={{ fontSize: 'var(--text-caption)', color: '#9ca3af', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 420 }}>
                        {lead.call_notes}
                      </div>
                    )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setOpenId(open ? null : lead.id)} style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid #e5e7eb', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 'var(--text-body)', fontWeight: 500 }}>{open ? 'Less' : 'Details'}</button>
                    <button onClick={() => removeFromPool(lead.id)} style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid #fee2e2', background: '#fff', color: '#ef4444', cursor: 'pointer', fontSize: 'var(--text-body)', fontWeight: 500 }}>Remove</button>
                  </div>
                </div>
                {open && <Detail lead={lead} onLogCall={logCall} onPatch={patchLead} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
