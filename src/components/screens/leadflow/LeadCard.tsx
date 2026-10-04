import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { leadMediaUrl, sendLeadToCrm } from '../../../data/useLeadflow';
import { timeToMinutes, minutesToTime } from '../../../data/time';
import type { LeadflowLead } from '../../../data/useLeadflow';
import { skinClass } from './leadTheme';
import type { LeadSkin } from './leadTheme';
import { LEAD_CALL_OUTCOMES, LEAD_OUTCOME_LABEL } from './leadOutcomes';
import { celebrate } from '../../../lib/fxEvents';
import {
  mapsUrl, streetViewUrl, websiteUrl, registryUrl, peopleSearchUrl,
  bestOwnerGuess, leadImagePaths, hasOwnerContact,
} from './leadLinks';
import { fmtPhone, telHref, leadCategory, leadTags, cityState, fmtReviewAge } from './format';
import { Tag, TierMark, PhoneIcon, MoreMenu, Banner, Dot } from './ui';
import './leadflow.css';

/** One lead, rendered the same way wherever it appears.
 *
 *  LeadFlow shows it as a table row plus a record panel (LeadRecord);
 *  Dialing shows it as a card (LeadCard, default export) that opens into the
 *  same record sections. One set of sections, so the owner fields, call log,
 *  flag and CRM hand-off can't drift apart between the two. Colors come
 *  only from --lf-* tokens; the skin picks the token set (leadTheme.ts).
 */

export type PatchLead = (id: string, patch: Partial<LeadflowLead>) => Promise<boolean>;
export type LogCall = (lead: LeadflowLead, status: string) => Promise<boolean>;

/** Signed thumbnails of the storefront, menu and food.
 *
 *  Signed on open rather than for the whole pool: the URLs expire in an
 *  hour and most leads are never opened. The section is hidden when a lead
 *  has no photos (fewer than half do). */
function Photos({ paths }: { paths: string[] }) {
  const [urls, setUrls] = useState<string[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    setUrls(null);
    (async () => {
      const signed = await Promise.all(paths.map((p) => leadMediaUrl(p)));
      if (!cancelled) setUrls(signed.filter((u): u is string => !!u));
    })();
    return () => { cancelled = true; };
  }, [paths]);
  if (paths.length === 0 || (urls && urls.length === 0)) return null;
  return (
    <Section title="Photos">
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        {urls === null
          ? paths.slice(0, 4).map((p) => <div key={p} className="lf-skel" style={{ width: 96, height: 72, flex: 'none', borderRadius: 6 }} />)
          : urls.map((u) => (
            <a key={u} href={u} target="_blank" rel="noopener noreferrer" style={{ flex: 'none' }}>
              <img src={u} alt="" loading="lazy" style={{ height: 96, borderRadius: 6, border: '1px solid var(--lf-border)', display: 'block' }} />
            </a>
          ))}
      </div>
    </Section>
  );
}

function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <div className="lf-sec" id={id}>
      <div className="lf-sec-h">{title}</div>
      {children}
    </div>
  );
}

/** Copies text with visible confirmation, in words. Reports failure: a
 *  clipboard write can be refused (permissions, insecure context). */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle');
  useEffect(() => {
    if (state === 'idle') return;
    const timer = setTimeout(() => setState('idle'), 1600);
    return () => clearTimeout(timer);
  }, [state]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setState('ok'); } catch { setState('fail'); }
  };
  return (
    <button className={`lf-btn lf-btn--secondary lf-btn--sm${state === 'ok' ? ' lf-btn--on' : ''}`} onClick={copy} disabled={!text}
      style={state === 'fail' ? { color: 'var(--lf-stop-text)' } : undefined}>
      {state === 'ok' ? 'Copied' : state === 'fail' ? 'Copy blocked' : label}
    </button>
  );
}

/** The owner's real name and direct line, typed in by hand and saved on
 *  blur. This is the payoff of the registry and people-search links: the
 *  scraper can't get owner details. A name plus a direct number shows
 *  "Owner on file", which sits beside Go time, because knowing who to ask
 *  for is not the same as having called them. */
function OwnerSection({ lead, onPatch }: { lead: LeadflowLead; onPatch: PatchLead }) {
  const [name, setName] = useState(lead.owner_name ?? '');
  const [phone, setPhone] = useState(lead.owner_phone ?? '');
  const [email, setEmail] = useState(lead.owner_email ?? '');
  const guess = bestOwnerGuess(lead);
  const people = peopleSearchUrl(name, lead);
  const reg = registryUrl(lead);
  const known = hasOwnerContact({ owner_name: name, owner_phone: phone });
  const save = (patch: Partial<LeadflowLead>) => onPatch(lead.id, patch);

  return (
    <Section title="Owner">
      {known && <div style={{ marginBottom: 8 }}><Tag s="info">Owner on file</Tag></div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input className="lf-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Owner name" aria-label="Owner name"
          onBlur={() => name !== (lead.owner_name ?? '') && save({ owner_name: name.trim() || null })} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="lf-input lf-mono" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Direct number" aria-label="Direct number" inputMode="tel" style={{ flex: '1 1 150px' }}
            onBlur={() => phone !== (lead.owner_phone ?? '') && save({ owner_phone: phone.trim() || null })} />
          <input className="lf-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" aria-label="Owner email" inputMode="email" style={{ flex: '1 1 170px' }}
            onBlur={() => email !== (lead.owner_email ?? '') && save({ owner_email: email.trim() || null })} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        {phone.trim() && <a className="lf-btn lf-btn--secondary lf-btn--sm" href={telHref(phone)}><PhoneIcon size={14} />Call owner direct</a>}
        <a className="lf-btn lf-btn--secondary lf-btn--sm" href={people ?? undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!people}>TruePeopleSearch</a>
        {reg && (
          // Copies on the way out too, so the one tap that opens the registry
          // also leaves the name ready to paste into its form.
          <a className="lf-btn lf-btn--secondary lf-btn--sm" href={reg} target="_blank" rel="noopener noreferrer"
            onClick={() => { navigator.clipboard?.writeText(lead.business_name).catch(() => {}); }}>State registry</a>
        )}
      </div>
      <div className="lf-label" style={{ marginTop: 8, lineHeight: 1.5 }}>
        {reg && <div>Opening the registry copies “{lead.business_name}”. Paste it into Name, or use Principal Name to search an owner directly.</div>}
        {!name && (guess || lead.registry_note) && (
          <div>{guess ? `Registry suggested: ${guess}${lead.owner_is_agent_only ? ' (registered agent, may not be the owner)' : ''}` : lead.registry_note}</div>
        )}
      </div>
    </Section>
  );
}

/** Log an attempt and keep notes on it. Logging sets the status, bumps
 *  call_count and stamps last_called_at (the hooks' logCall). */
function CallLogSection({ lead, onLogCall, onPatch }: { lead: LeadflowLead; onLogCall: LogCall; onPatch: PatchLead }) {
  const [notes, setNotes] = useState(lead.call_notes ?? '');
  const [saving, setSaving] = useState('');
  const log = async (status: string) => { setSaving(status); await onLogCall(lead, status); setSaving(''); };
  const lastCalled = lead.last_called_at ? new Date(lead.last_called_at).toLocaleDateString() : null;
  const current = lead.status && lead.status !== 'new' ? lead.status : '';

  return (
    <Section title="Call log">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="group" aria-label="Call outcome">
        {LEAD_CALL_OUTCOMES.map((o) => {
          const active = current === o.value;
          return (
            <button key={o.value} onClick={() => log(o.value)} disabled={!!saving} aria-pressed={active}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 10px', borderRadius: 'var(--lf-r-ctl)',
                border: `1px solid ${active ? `var(--lf-${o.signal}-dot)` : 'var(--lf-border-strong)'}`,
                background: active ? `var(--lf-${o.signal}-fill)` : 'var(--lf-surface)',
                color: active ? `var(--lf-${o.signal}-text)` : 'var(--lf-text)',
                fontSize: 13, fontWeight: 500, cursor: saving ? 'default' : 'pointer', opacity: saving && saving !== o.value ? 0.5 : 1,
                transition: 'background-color .12s, border-color .12s',
              }}>
              <Dot s={o.signal} />{saving === o.value ? 'Saving…' : o.label}
            </button>
          );
        })}
      </div>
      {(current || !!lead.call_count) && (
        <div className="lf-label" style={{ marginTop: 8 }}>
          {current ? LEAD_OUTCOME_LABEL[current] ?? current : 'Logged'}
          {lead.call_count ? <> · <span className="lf-mono">{lead.call_count}</span> attempt{lead.call_count === 1 ? '' : 's'}</> : null}
          {lastCalled ? <> · last <span className="lf-mono">{lastCalled}</span></> : null}
        </div>
      )}
      <textarea className="lf-input" value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Call notes"
        onBlur={() => notes !== (lead.call_notes ?? '') && onPatch(lead.id, { call_notes: notes.trim() || null })}
        placeholder="Call notes: who you spoke to, what they said, when to try again…" style={{ width: '100%', marginTop: 10 }} />
    </Section>
  );
}

/** Reason for a flag, shown only while the lead is flagged. */
function FlagReason({ lead, onPatch }: { lead: LeadflowLead; onPatch: PatchLead }) {
  const [note, setNote] = useState(lead.flag_note ?? '');
  if (!lead.flagged) return null;
  return (
    <input className="lf-input" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Why is this lead flagged"
      onBlur={() => note !== (lead.flag_note ?? '') && onPatch(lead.id, { flag_note: note.trim() || null })}
      placeholder="Why flagged? e.g. gone quiet 4 yrs, check before calling" style={{ width: '100%', marginTop: 10 }} />
  );
}

/** Books the kickoff call and hands the lead to Client CRM in one step:
 *  a crm_clients row carrying the lead's context, plus a 30-minute 'scalez'
 *  event (the same shape the Event Adder writes). */
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
      await sendLeadToCrm(lead, date, time, minutesToTime(timeToMinutes(time) + 30));
      setDone(true);
      celebrate();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send to CRM.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Hand off to Client CRM" id={`lf-handoff-${lead.id}`}>
      {done ? (
        <Banner s="go" title="Sent to Client CRM">Kickoff call booked. Drop the transcript on the client's CRM page after the call.</Banner>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input className="lf-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Call date" />
            <input className="lf-input" type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Call time" />
            <button className="lf-btn lf-btn--secondary" onClick={send} disabled={busy || !date || !time}>{busy ? 'Sending…' : 'Create client + book call'}</button>
          </div>
          <div className="lf-label" style={{ marginTop: 6 }}>Creates the client at stage “new lead” with this lead's details and notes, and books a 30-minute call.</div>
          {err && <div style={{ marginTop: 8 }}><Banner s="stop">{err}</Banner></div>}
        </>
      )}
    </Section>
  );
}

/** Everything known about a lead and every field you can fill in on it. */
export function RecordBody({ lead, onPatch, onLogCall, ownerFirst }: { lead: LeadflowLead; onPatch: PatchLead; onLogCall: LogCall; ownerFirst?: boolean }) {
  // Memoised: Photos keys its signing off this array's identity.
  const imagePaths = useMemo(() => leadImagePaths(lead), [lead]);
  const sv = streetViewUrl(lead);
  const site = websiteUrl(lead.website);
  const stale = fmtReviewAge(lead.days_since_last_review);

  const contact = (
    <Section title="Contact" key="contact">
      <div className="lf-field"><div>Phone</div><div>{lead.phone ? <a className="lf-mono" href={telHref(lead.phone)} style={{ color: 'var(--lf-text)' }}>{fmtPhone(lead.phone)}</a> : <span style={{ color: 'var(--lf-text-tertiary)' }}>None</span>}</div></div>
      {lead.address && <div className="lf-field"><div>Address</div><div>{lead.address}</div></div>}
      {cityState(lead) && <div className="lf-field"><div>City</div><div>{cityState(lead)}</div></div>}
      <div className="lf-field"><div>Website</div><div>{site ? <a href={site} target="_blank" rel="noopener noreferrer">{lead.website}</a> : <span style={{ color: 'var(--lf-text-tertiary)' }}>{lead.website_status === 'no_website' ? 'No website' : lead.website_status ? 'Has a site, address not on file' : 'None on file'}</span>}</div></div>
    </Section>
  );
  const owner = <OwnerSection key="owner" lead={lead} onPatch={onPatch} />;
  return (
    <>
      {ownerFirst ? <>{owner}{contact}</> : contact}
      <CallLogSection lead={lead} onLogCall={onLogCall} onPatch={onPatch} />
      {!ownerFirst && owner}
      <Section title="Details">
        {lead.fizzle_score != null && <div className="lf-field"><div>Fizzle score</div><div className="lf-mono">{lead.fizzle_score}{lead.tier ? ` · tier ${lead.tier}` : ''}</div></div>}
        {lead.rating != null && <div className="lf-field"><div>Rating</div><div className="lf-mono">{lead.rating}{lead.review_count ? ` (${lead.review_count})` : ''}</div></div>}
        {stale && <div className="lf-field"><div>Last review</div><div className="lf-mono">{stale}</div></div>}
        {leadCategory(lead) && <div className="lf-field"><div>Category</div><div>{leadCategory(lead)}</div></div>}
      </Section>
      {(lead.summary || (lead.fizzle_reasons && lead.fizzle_reasons.length > 0)) && (
        <Section title="Why this lead">
          {lead.summary && <div style={{ fontSize: 14, color: 'var(--lf-text-secondary)', lineHeight: 1.6 }}>{lead.summary}</div>}
          {lead.fizzle_reasons && lead.fizzle_reasons.length > 0 && (
            <ul style={{ margin: lead.summary ? '8px 0 0' : 0, paddingLeft: 18, fontSize: 14, color: 'var(--lf-text-secondary)', lineHeight: 1.6 }}>
              {lead.fizzle_reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          )}
        </Section>
      )}
      <Photos paths={imagePaths} />
      <Section title="Links">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a className="lf-btn lf-btn--secondary lf-btn--sm" href={mapsUrl(lead)} target="_blank" rel="noopener noreferrer">Maps</a>
          {sv && <a className="lf-btn lf-btn--secondary lf-btn--sm" href={sv} target="_blank" rel="noopener noreferrer">Street View</a>}
          {site && <a className="lf-btn lf-btn--secondary lf-btn--sm" href={site} target="_blank" rel="noopener noreferrer">Website</a>}
          <CopyButton text={lead.business_name} label="Copy name" />
        </div>
      </Section>
      <HandoffSection lead={lead} />
    </>
  );
}

/** Name, meta line and signal tags. */
export function RecordHeader({ lead, onClose, onBack, backLabel, onPatch }: { lead: LeadflowLead; onClose?: () => void; onBack?: () => void; backLabel?: string; onPatch: PatchLead }) {
  return (
    <div style={{ padding: 16, borderBottom: '1px solid var(--lf-border)' }}>
      {onBack && <button className="lf-btn lf-btn--ghost lf-btn--sm" onClick={onBack} style={{ marginLeft: -10, marginBottom: 6, color: 'var(--lf-text-tertiary)' }}>‹ {backLabel ?? 'Back'}</button>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
          <TierMark tier={lead.tier} />
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 500, letterSpacing: '-0.015em', lineHeight: 1.25 }}>{lead.business_name}</h2>
        </div>
        {onClose && <button className="lf-btn lf-btn--ghost lf-btn--sm" onClick={onClose} aria-label="Close record" style={{ fontSize: 18, color: 'var(--lf-text-tertiary)' }}>×</button>}
      </div>
      <div style={{ fontSize: 13, color: 'var(--lf-text-tertiary)', margin: '6px 0 10px' }}>{[leadCategory(lead), cityState(lead)].filter(Boolean).join(' · ')}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{leadTags(lead).map((t) => <Tag key={t.label} s={t.s} title={t.title}>{t.label}</Tag>)}</div>
      <FlagReason lead={lead} onPatch={onPatch} />
    </div>
  );
}

function CallButton({ lead, big }: { lead: LeadflowLead; big?: boolean }) {
  const cls = `lf-btn lf-btn--primary${big ? ' lf-btn--call' : ''}`;
  return lead.phone
    ? <a className={cls} href={telHref(lead.phone)} style={{ flex: 1, minWidth: 0 }}><PhoneIcon />Call <span className="lf-mono">{fmtPhone(lead.phone)}</span></a>
    : <button className={cls} disabled style={{ flex: 1 }}>No phone on file</button>;
}

/** The record panel: header, action bar, sections. `sheet` is the phone
 *  layout: a back link on top and Call pinned at the bottom. */
export function LeadRecord({ lead, onPatch, onLogCall, onClose, poolAction, ownerFirst, sheet, backLabel }: {
  lead: LeadflowLead; onPatch: PatchLead; onLogCall: LogCall; onClose: () => void;
  poolAction?: { label: string; onClick: () => void; danger?: boolean }; ownerFirst?: boolean; sheet?: boolean; backLabel?: string;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bodyRef.current?.scrollTo({ top: 0 }); }, [lead.id]);
  const jumpToHandoff = () => document.getElementById(`lf-handoff-${lead.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const more = [
    { label: 'Open in Maps', href: mapsUrl(lead) },
    { label: 'Copy business name', onClick: () => { navigator.clipboard?.writeText(lead.business_name).catch(() => {}); } },
    { label: 'Hand off to Client CRM', onClick: jumpToHandoff },
  ];
  const flagBtn = (
    <button className={`lf-btn lf-btn--secondary${lead.flagged ? ' lf-btn--on' : ''}`} aria-pressed={!!lead.flagged} onClick={() => onPatch(lead.id, { flagged: !lead.flagged })}>
      {lead.flagged ? 'Flagged' : 'Flag'}
    </button>
  );
  const poolBtn = poolAction && <button className="lf-btn lf-btn--secondary" onClick={poolAction.onClick}>{poolAction.label}</button>;

  return (
    <section className={`lf-record${sheet ? ' lf-record--sheet' : ''}`} aria-label={`${lead.business_name} record`} style={{ height: '100%' }}>
      <RecordHeader lead={lead} onClose={sheet ? undefined : onClose} onBack={sheet ? onClose : undefined} backLabel={backLabel} onPatch={onPatch} />
      {sheet ? (
        <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--lf-border)' }}>{poolBtn}{flagBtn}</div>
      ) : (
        <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--lf-border)', flexWrap: 'wrap' }}>
          <CallButton lead={lead} />{poolBtn}{flagBtn}<MoreMenu items={more} />
        </div>
      )}
      <div ref={bodyRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: sheet ? 96 : 0 }}>
        <RecordBody key={lead.id} lead={lead} onPatch={onPatch} onLogCall={onLogCall} ownerFirst={ownerFirst} />
      </div>
      {sheet && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', background: 'var(--lf-surface)', borderTop: '1px solid var(--lf-border)', display: 'flex', gap: 8 }}>
          <CallButton lead={lead} big />
          <MoreMenu items={more} up buttonClass="lf-btn lf-btn--secondary lf-btn--call" />
        </div>
      )}
    </section>
  );
}

/** Dialing's card: the collapsed lead plus, when open, the same record
 *  sections LeadFlow's panel uses. Skin 'mastermind' wears V2 tokens. */
export default function LeadCard({ lead, open, onToggle, onPatch, onLogCall, skin = 'leadflow', actions }: {
  lead: LeadflowLead;
  open: boolean;
  onToggle: () => void;
  onPatch: PatchLead;
  onLogCall: LogCall;
  skin?: LeadSkin;
  actions?: ReactNode;
}) {
  const tags = leadTags(lead).filter((t) => !t.label.startsWith('Has website') && t.label !== 'No website');
  const stale = fmtReviewAge(lead.days_since_last_review);
  const meta = [leadCategory(lead), cityState(lead), lead.review_count ? `${lead.review_count} reviews` : '', stale ? `last review ${stale}` : ''].filter(Boolean).join(' · ');
  const ownerKnown = hasOwnerContact(lead);
  const current = lead.status && lead.status !== 'new' ? lead.status : '';

  return (
    <div className={skinClass(skin)} style={{ background: 'var(--lf-surface)', border: '1px solid var(--lf-border)', borderRadius: 'var(--lf-r-panel)', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <TierMark tier={lead.tier} />
          <button onClick={onToggle} aria-expanded={open} style={{ all: 'unset', cursor: 'pointer', fontSize: 16, fontWeight: 600, color: 'var(--lf-text)', minWidth: 0 }}>{lead.business_name}</button>
          {lead.fizzle_score != null && <span className="lf-mono" style={{ fontSize: 12, color: 'var(--lf-text-tertiary)' }}>{lead.fizzle_score}</span>}
          {tags.map((t) => <Tag key={t.label} s={t.s} title={t.title}>{t.label}</Tag>)}
        </div>
        {meta && <div style={{ fontSize: 13, color: 'var(--lf-text-tertiary)' }}>{meta}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {lead.phone && <a className="lf-mono" href={telHref(lead.phone)} style={{ fontSize: 20, fontWeight: 500, color: 'var(--lf-text)', textDecoration: 'none' }}>{fmtPhone(lead.phone)}</a>}
          {lead.phone && <a className="lf-btn lf-btn--primary" href={telHref(lead.phone)}><PhoneIcon />Call</a>}
          {ownerKnown && lead.owner_phone && <a className="lf-btn lf-btn--secondary" href={telHref(lead.owner_phone)}>{lead.owner_name}: <span className="lf-mono">{fmtPhone(lead.owner_phone)}</span></a>}
          <div style={{ flex: 1 }} />
          <button className="lf-btn lf-btn--secondary lf-btn--sm" onClick={onToggle}>{open ? 'Less' : 'Details'}</button>
          {actions}
        </div>
        {!open && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {LEAD_CALL_OUTCOMES.map((o) => {
              const active = current === o.value;
              return (
                <button key={o.value} onClick={() => onLogCall(lead, o.value)} aria-pressed={active}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px', borderRadius: 'var(--lf-r-ctl)', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                    border: `1px solid ${active ? `var(--lf-${o.signal}-dot)` : 'var(--lf-border-strong)'}`, background: active ? `var(--lf-${o.signal}-fill)` : 'transparent', color: active ? `var(--lf-${o.signal}-text)` : 'var(--lf-text)' }}>
                  <Dot s={o.signal} />{o.label}
                </button>
              );
            })}
          </div>
        )}
        {!open && lead.call_notes && <div className="lf-trunc" style={{ fontSize: 12, color: 'var(--lf-text-tertiary)' }}>{lead.call_notes}</div>}
      </div>
      {open && (
        <div style={{ borderTop: '1px solid var(--lf-border)' }}>
          <RecordBody lead={lead} onPatch={onPatch} onLogCall={onLogCall} />
          <div style={{ padding: '0 16px 16px' }}>
            <button className={`lf-btn lf-btn--secondary lf-btn--sm${lead.flagged ? ' lf-btn--on' : ''}`} onClick={() => onPatch(lead.id, { flagged: !lead.flagged })}>{lead.flagged ? 'Flagged' : 'Flag this lead'}</button>
            <FlagReason lead={lead} onPatch={onPatch} />
          </div>
        </div>
      )}
    </div>
  );
}
