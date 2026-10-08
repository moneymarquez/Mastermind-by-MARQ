import { useEffect, useMemo, useState } from 'react';
import { useContactLists, ListFilter, ContactPeople } from '../../solo/PeopleLists';
import { useContacts } from '../../../data/useContacts';
import { useEvents } from '../../../data/useEvents';
import { useCallOutcomes } from '../../../data/useCallOutcomes';
import type { Contact, ContactSource } from '../../../data/types';
import { CALL_OUTCOME_LABEL, CREDIT_SCORE_RANGES } from '../../../data/types';
import { eventLabel } from '../../../data/eventDisplay';
import ContactFormModal from '../ContactFormModal';
import Chip from '../../mm/Chip';
import type { ChipKind } from '../../mm/Chip';
import Stat from '../../mm/Stat';
import { Empty } from '../../mm/States';
import { Page, useModule } from '../../mm/Page';
import { initials, shortDate, ymd } from './util';

const SOURCE: Record<ContactSource, string> = { dialing: 'Dialing', scalez: 'Scaling', manual: 'Manual' };
const YES_NO = [['yes', 'Yes'], ['no', 'No']] as const;
const YNU = [...YES_NO, ['unsure', 'Unsure']] as const;
type F = { k: string; l: string; top?: boolean; type?: string; opts?: readonly (readonly [string, string])[]; num?: boolean; area?: boolean };
const BASE: F[] = [{ k: 'name', l: 'Name', top: true }, { k: 'phone', l: 'Phone', top: true, type: 'tel' }, { k: 'email', l: 'Email', top: true, type: 'email' }, { k: 'business_name', l: 'Business', top: true }];
const DIAL: F[] = [{ k: 'appointment_at', l: 'Appointment', type: 'datetime-local' }, { k: 'address', l: 'Address' }, { k: 'homeowner', l: 'Homeowner', opts: YES_NO }, { k: 'electric_utility', l: 'Electric utility' }, { k: 'avg_monthly_bill', l: 'Monthly bill ($)', num: true }, { k: 'credit_score_range', l: 'Credit score', opts: CREDIT_SCORE_RANGES.map((r) => [r, r] as const) }, { k: 'roof_type_age', l: 'Roof type / age' }, { k: 'shading_issues', l: 'Shading', opts: YNU }, { k: 'hoa', l: 'HOA', opts: YES_NO }];
const SCALE: F[] = [{ k: 'appointment_at', l: 'Appointment', type: 'datetime-local' }, { k: 'industry', l: 'Industry' }, { k: 'has_website', l: 'Has a website', opts: YES_NO }, { k: 'marketing_spend', l: 'Marketing $/mo', num: true }, { k: 'decision_maker_confirmed', l: 'Decision maker', opts: YES_NO }, { k: 'pain_points', l: 'Pain points', area: true }];

function matches(c: Contact, q: string) {
  const s = q.trim().toLowerCase();
  return !s || [c.name, c.phone, c.email, c.business_name, c.status].some((v) => (v ?? '').toLowerCase().includes(s));
}

export default function ContactsV2() {
  const { device } = useModule();
  const phone = device === 'phone';
  const C = useContacts();
  const { events } = useEvents();
  const dialing = useMemo(() => C.contacts.filter((c) => c.source === 'dialing'), [C.contacts]);
  const O = useCallOutcomes(dialing);
  const [q, setQ] = useState('');
  const [src, setSrc] = useState<ContactSource | 'all'>('all');
  const [sel, setSel] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const people = useContactLists();
  const [listId, setListId] = useState<string | null>(null);
  const today = ymd(new Date());

  const members = listId ? people.inList(listId) : null;
  const list = C.contacts.filter((c) => (src === 'all' || c.source === src) && matches(c, q) && (!members || members.has(c.id)));
  useEffect(() => { if (!phone && !sel && list[0]) setSel(list[0].id); }, [phone, sel, list]);
  const cur = C.contacts.find((c) => c.id === sel) ?? null;

  const status = (c: Contact): { c: string; k: ChipKind } => {
    const l = O.latestByContact.get(c.id);
    if (c.source === 'scalez') return { c: 'Scaling', k: 'client' };
    if (!l) return c.source === 'dialing' ? { c: 'Never called', k: 'neutral' } : { c: SOURCE[c.source], k: 'neutral' };
    if (l.outcome === 'appointment_set') return { c: 'Booked', k: 'good' };
    if (l.outcome === 'call_back_later') return { c: l.callback_date && l.callback_date > today ? `Call back ${shortDate(l.callback_date)}` : 'Call back', k: 'warn' };
    if (l.outcome === 'dnc_remove' || l.outcome === 'not_qualified') return { c: CALL_OUTCOME_LABEL[l.outcome], k: 'bad' };
    return { c: CALL_OUTCOME_LABEL[l.outcome], k: 'neutral' };
  };
  const callbackDue = dialing.filter((c) => { const l = O.latestByContact.get(c.id); return l?.outcome === 'call_back_later' && (!l.callback_date || l.callback_date <= today); }).length;
  const never = dialing.filter((c) => !O.latestByContact.has(c.id)).length;
  const booked = dialing.filter((c) => O.latestByContact.get(c.id)?.outcome === 'appointment_set').length;

  if (!C.loading && C.contacts.length === 0) {
    return (
      <Page title="Contacts" sub="Everyone from Dialing and Scaling">
        <Empty text="No contacts yet. Add one, or they show up from Dialing and Scaling as you work." cta="Add a contact" onCta={() => setAdding(true)} />
        {adding && <ContactFormModal onSave={C.upsertContact} onClose={() => setAdding(false)} />}
      </Page>
    );
  }

  const listPane = (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, borderRight: phone ? 'none' : '1px solid var(--grid)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', flex: 'none' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, business, phone" aria-label="Search contacts" style={{ flex: 1, minWidth: 0, height: 36, padding: '0 10px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }} />
          {!phone && <button className="mm-btn mm-btn--primary" style={{ height: 36, fontSize: 13 }} onClick={() => setAdding(true)}>Contact</button>}
        </div>
        <ListFilter api={people} value={listId} onChange={setListId} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['all', 'dialing', 'scalez', 'manual'] as const).map((s) => <button key={s} aria-pressed={src === s} onClick={() => setSrc(s)} style={{ padding: '4px 10px', borderRadius: 999, border: src === s ? '1px solid var(--text)' : '1px solid var(--border)', background: src === s ? 'var(--text)' : 'transparent', color: src === s ? 'var(--bg)' : 'var(--text-secondary)', fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}>{s === 'all' ? `All ${C.contacts.length}` : SOURCE[s]}</button>)}
        </div>
      </div>
      <div className="mm-scroll-y" style={{ flex: 1, minHeight: 0 }}>
        {list.length === 0 && <div style={{ padding: '18px 14px', fontSize: 14, color: 'var(--text-tertiary)' }}>No matches.</div>}
        {list.map((c) => { const s = status(c); return (
          <button key={c.id} onClick={() => setSel(c.id)} className="mm-dash-tr" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', width: '100%', textAlign: 'left', border: 0, borderTop: '1px solid var(--grid)', background: cur?.id === c.id && !phone ? 'var(--surface-3)' : 'transparent', cursor: 'pointer', fontFamily: 'inherit', minHeight: 56 }}>
            <div style={{ width: 32, height: 32, flex: 'none', borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', fontSize: 11.5, fontWeight: 600 }}>{initials(c.name)}</div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span><span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{c.phone ?? ''}</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}><Chip k={s.k}>{s.c}</Chip><span style={{ fontSize: 12.5, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.business_name ?? ''}</span></div>
            </div>
          </button>
        ); })}
      </div>
    </div>
  );
  const record = cur && <Record key={cur.id} people={people} c={cur} chip={status(cur)} onBack={phone ? () => setSel(null) : undefined} update={C.updateContact} remove={async () => { if (window.confirm(`Delete ${cur.name}?`)) { await C.deleteContact(cur.id); setSel(null); } }}
    log={[
      ...O.outcomes.filter((o) => o.contact_id === cur.id).map((o) => ({ at: o.logged_at, t: `Call · ${CALL_OUTCOME_LABEL[o.outcome]}${o.callback_date && o.outcome === 'call_back_later' ? ` · back ${shortDate(o.callback_date)}` : ''}` })),
      ...events.filter((e) => e.linked_contact_id === cur.id).map((e) => ({ at: `${e.event_date}T${e.start_time}`, t: `${eventLabel(e)}${e.status ? ` · ${e.status}` : ''}` })),
    ].sort((a, b) => b.at.localeCompare(a.at))} />;

  return (
    <Page title="Contacts" sub={`${C.contacts.length} ${C.contacts.length === 1 ? 'contact' : 'contacts'}`} fab={phone ? { t: 'Contact', onClick: () => setAdding(true) } : undefined}>
      {phone ? (
        <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>{cur ? record : listPane}</section>
      ) : (
        <>
          <section style={{ display: 'grid', gridTemplateColumns: device === 'desktop' ? '380px minmax(0,1fr)' : '320px minmax(0,1fr)', height: device === 'desktop' ? 680 : 620, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', minWidth: 0 }}>
            {listPane}
            {record ?? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 14 }}>Pick a contact on the left.</div>}
          </section>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>
            <Stat label="Contacts" value={C.contacts.length.toLocaleString('en-US')} pill={`${dialing.length} from Dialing`} />
            <Stat label="Callback due" value={String(callbackDue)} pill="Today or earlier" k={callbackDue ? 'warn' : 'neutral'} />
            <Stat label="Never called" value={String(never)} pill="Dialing contacts" />
            <Stat label="Booked" value={String(booked)} pill="Last call booked" k={booked ? 'good' : 'neutral'} />
          </div>
        </>
      )}
      {adding && <ContactFormModal onSave={C.upsertContact} onClose={() => setAdding(false)} />}
    </Page>
  );
}

function Record({ c, chip, onBack, update, remove, log, people }: { c: Contact; chip: { c: string; k: ChipKind }; onBack?: () => void; update: ReturnType<typeof useContacts>['updateContact']; remove: () => void; log: { at: string; t: string }[]; people?: ReturnType<typeof useContactLists> }) {
  const d = c.details as Record<string, unknown>;
  const fields = [...BASE.filter((f) => f.k !== 'business_name' || c.source !== 'dialing' || c.business_name), ...(c.source === 'dialing' ? DIAL : c.source === 'scalez' ? SCALE : [])];
  const save = (f: F, raw: string) => {
    const v = f.num ? (raw ? Number(raw) : null) : raw || null;
    if (f.top) void update(c.id, { [f.k]: f.k === 'name' ? raw : v } as never);
    else void update(c.id, { details: { ...c.details, [f.k]: v } } as never);
  };
  const val = (f: F) => String((f.top ? (c as unknown as Record<string, unknown>)[f.k] : d[f.k]) ?? '');
  const act = (t: string, href: string | null, primary?: boolean) => href ? <a key={t} className={primary ? 'mm-btn mm-btn--primary' : 'mm-btn'} href={href} style={{ height: 38, fontSize: 13.5, textDecoration: 'none' }}>{t}</a> : null;
  const tel = c.phone?.replace(/[^\d+]/g, '');
  return (
    <div className="mm-scroll-y" style={{ minWidth: 0, minHeight: 0 }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: onBack ? 18 : '22px 26px' }}>
      {onBack && <button className="mm-btn" onClick={onBack} style={{ alignSelf: 'flex-start', height: 34 }}>‹ All contacts</button>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h2 style={{ margin: 0, color: 'var(--text)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em' }}>{c.name}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><Chip k={chip.k}>{chip.c}</Chip><span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{[c.business_name, SOURCE[c.source]].filter(Boolean).join(' · ')}</span></div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {act('Call', tel ? `tel:${tel}` : null, true)}{act('Text', tel ? `sms:${tel}` : null)}{act('Email', c.email ? `mailto:${c.email}` : null)}
        <button className="mm-btn" style={{ height: 38, fontSize: 13.5, color: 'var(--danger)' }} onClick={remove}>Delete</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: onBack ? 'minmax(0,1fr)' : 'repeat(2,minmax(0,1fr))', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {fields.map((f, i) => <EditCell key={f.k} f={f} value={val(f)} onSave={(v) => save(f, v)} first={onBack ? i === 0 : i < 2} odd={!onBack && i % 2 === 1} />)}
      </div>
      {people && <ContactPeople api={people} contact={c as never} />}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Notes</span>
        <NoteBox value={c.notes ?? ''} onSave={(v) => void update(c.id, { notes: v || null } as never)} />
      </label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Activity</span>
        {log.length ? log.slice(0, 12).map((l, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: '72px minmax(0,1fr)', gap: 10, fontSize: 14 }}><span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-tertiary)' }}>{l.at.slice(0, 10) === ymd(new Date()) ? 'Today' : shortDate(l.at.slice(0, 10))}</span><span style={{ color: 'var(--text)', lineHeight: 1.4 }}>{l.t}</span></div>)
          : <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>No calls or events with this contact yet.</span>}
      </div>
    </div>
    </div>
  );
}

function EditCell({ f, value, onSave, first, odd }: { f: F; value: string; onSave: (v: string) => void; first: boolean; odd: boolean }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const st = { width: '100%', border: 0, background: 'transparent', color: 'var(--text)', fontSize: 14, fontWeight: 500, fontFamily: 'inherit', padding: 0, outline: 'none', minWidth: 0 } as const;
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 14px', borderTop: first ? 'none' : '1px solid var(--grid)', borderLeft: odd ? '1px solid var(--grid)' : 'none', minWidth: 0, gridColumn: f.area ? '1 / -1' : undefined }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>{f.l}</span>
      {f.opts ? <select value={v} onChange={(e) => { setV(e.target.value); onSave(e.target.value); }} style={st}><option value="">—</option>{f.opts.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        : f.area ? <textarea value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v)} rows={2} style={{ ...st, resize: 'vertical' }} />
        : <input type={f.type ?? (f.num ? 'number' : 'text')} value={v.slice(0, f.type === 'datetime-local' ? 16 : undefined)} placeholder="—" onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v)} style={st} />}
    </label>
  );
}

function NoteBox({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return <textarea value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v)} placeholder="Anything worth remembering before the next call" style={{ minHeight: 80, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 15, lineHeight: 1.45, fontFamily: 'inherit', resize: 'vertical' }} />;
}
