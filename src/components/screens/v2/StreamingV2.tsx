import { useRef, useState } from 'react';
import { useStreamingIdeas } from '../../../data/useStreamingIdeas';
import { useEvents } from '../../../data/useEvents';
import { useContacts } from '../../../data/useContacts';
import { STREAMING_IDEAS_SEED } from '../../../data/streamingIdeasSeed';
import { STREAM_FORMATS, STREAM_STATUSES } from '../../../data/types';
import type { StreamFormat, StreamStatus, StreamingIdea } from '../../../data/types';
import { eventLabel } from '../../../data/eventDisplay';
import CalendarView from '../../CalendarView';
import type { CalendarViewHandle } from '../../CalendarView';
import Card from '../../mm/Card';
import Row from '../../mm/Row';
import Stat from '../../mm/Stat';
import type { ChipKind } from '../../mm/Chip';
import { Heatmap } from '../../mm/charts';
import type { HeatCell } from '../../mm/charts';
import { Empty } from '../../mm/States';
import { Page, Sheet, Field, field, area, useModule } from '../../mm/Page';
import { addDays, shortDate, ymd } from './util';

const FORMAT: Record<StreamFormat, string> = { solo: 'Solo', duo: 'Duo' };
const STATUS: Record<StreamStatus, { l: string; k: ChipKind }> = { idea: { l: 'Idea', k: 'neutral' }, planned: { l: 'Planned', k: 'accent' }, recorded: { l: 'Recorded', k: 'warn' }, posted: { l: 'Posted', k: 'good' } };

export default function StreamingV2({ isOwner }: { isOwner: boolean }) {
  const { device, novaOpen } = useModule();
  const phone = device === 'phone', three = device === 'desktop' && !novaOpen;
  const I = useStreamingIdeas();
  const E = useEvents();
  const { search: searchContacts, upsertContact } = useContacts();
  const cal = useRef<CalendarViewHandle>(null);
  const [adding, setAdding] = useState(false);
  const [edit, setEdit] = useState<StreamingIdea | null>(null);
  const [seeding, setSeeding] = useState(false);
  const today = ymd(new Date());
  const streams = E.events.filter((e) => e.type === 'streaming').sort((a, b) => `${a.event_date}${a.start_time}`.localeCompare(`${b.event_date}${b.start_time}`));
  const next = streams.find((e) => e.event_date >= today);
  const week = streams.filter((e) => e.event_date >= today && e.event_date < addDays(today, 7));
  const month = today.slice(0, 7);
  const now = new Date(), first = ymd(new Date(now.getFullYear(), now.getMonth(), 1)), dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const lead = (new Date(now.getFullYear(), now.getMonth(), 1).getDay() + 6) % 7;
  const days = new Set(streams.map((e) => e.event_date));
  const cells: HeatCell[] = [...Array.from({ length: lead }, () => ({ v: '_' as const })), ...Array.from({ length: dim }, (_, i) => { const d = addDays(first, i); return { v: days.has(d) ? (d <= today ? 3 : '.') : 0, n: String(i + 1), t: `${shortDate(d)}${days.has(d) ? ' · stream' : ''}` } as HeatCell; })];

  const sheets = <>{adding && <IdeaSheet onClose={() => setAdding(false)} save={async (v) => { await I.addIdea(v); }} />}{edit && <IdeaSheet idea={edit} onClose={() => setEdit(null)} save={async (v) => { await I.updateIdea(edit.id, v); }} remove={async () => { await I.removeIdea(edit.id); setEdit(null); }} />}</>;
  const menu = isOwner && I.ideas.length === 0 ? [{ t: seeding ? 'Loading…' : 'Load starter ideas', onClick: async () => { setSeeding(true); await I.loadSeed(STREAMING_IDEAS_SEED); setSeeding(false); } }] : [];

  const heat = <Card title={now.toLocaleDateString('en-US', { month: 'long' })} meta="Stream days" wide={!phone}><Heatmap cells={cells} flow="row" lo="" hi="Streamed" caption="Dashed = scheduled" /></Card>;
  const bank = (
    <Card title="Idea bank" meta={`${I.ideas.length} ${I.ideas.length === 1 ? 'idea' : 'ideas'}`} flush wide={!phone}>
      {I.ideas.length ? <div>{I.ideas.slice(0, 10).map((i, n) => <Row key={i.id} first={n === 0} name={i.title} meta={[FORMAT[i.format], i.vibe].filter(Boolean).join(' · ')} chip={STATUS[i.status]?.l ?? 'Idea'} k={STATUS[i.status]?.k ?? 'neutral'} note={i.description ?? undefined} onClick={() => setEdit(i)} />)}</div>
        : <div style={{ padding: '10px 0 14px', fontSize: 14, color: 'var(--text-tertiary)' }}>No ideas yet.</div>}
      <button className="mm-btn" style={{ margin: '4px 0 14px' }} onClick={() => setAdding(true)}>Add an idea</button>
    </Card>
  );
  const upcoming = (
    <Card title="Coming up" meta={`${streams.filter((e) => e.event_date >= today).length} scheduled`} flush wide={!phone}>
      {streams.filter((e) => e.event_date >= today).length ? <div>{streams.filter((e) => e.event_date >= today).slice(0, 5).map((e, i) => <Row key={e.id} first={i === 0} name={eventLabel(e)} meta={`${shortDate(e.event_date)} · ${new Date(`2000-01-01T${e.start_time.slice(0, 5)}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`} chip={e.event_date === today ? 'Today' : 'Scheduled'} k={e.event_date === today ? 'warn' : 'accent'} />)}</div>
        : <div style={{ padding: '10px 0 14px', fontSize: 14, color: 'var(--text-tertiary)' }}>Nothing scheduled.</div>}
      <button className="mm-btn" style={{ margin: '4px 0 14px' }} onClick={() => cal.current?.openAddModal()}>Schedule a stream</button>
    </Card>
  );
  const calendar = (
    <Card title="Calendar" meta="Shared with Schedule" wide={!phone}>
      <CalendarView ref={cal} events={streams} defaultType="streaming" searchContacts={searchContacts} upsertContact={upsertContact} addEvent={E.addEvent} addHolidayEvents={E.addHolidayEvents} updateEvent={E.updateEvent} deleteEvent={E.deleteEvent} />
    </Card>
  );

  if (!I.loading && I.ideas.length === 0 && streams.length === 0) {
    return <Page title="Streaming" sub="Idea bank and your stream schedule" menu={menu} fab={{ t: 'Idea', onClick: () => setAdding(true) }}><Empty text="No stream ideas or streams yet. Add an idea, or schedule your first stream." cta="Add an idea" onCta={() => setAdding(true)} />{calendar}{sheets}</Page>;
  }

  return (
    <Page title="Streaming" sub="Idea bank and your stream schedule" menu={menu} fab={{ t: 'Idea', onClick: () => setAdding(true) }}>
      {!phone && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>
          <Stat label="This week" value={String(week.length)} pill="Streams scheduled" />
          <Stat label="Next stream" value={next ? (next.event_date === today ? 'Today' : shortDate(next.event_date)) : '—'} pill={next ? eventLabel(next) : 'Nothing scheduled'} k={next?.event_date === today ? 'warn' : 'neutral'} />
          <Stat label="Streamed" value={String(streams.filter((e) => e.event_date.startsWith(month) && e.event_date <= today).length)} pill="This month" />
          <Stat label="Ideas" value={String(I.ideas.length)} pill={`${I.ideas.filter((i) => i.status === 'idea').length} not planned yet`} />
        </div>
      )}
      {phone ? <>{upcoming}{bank}{heat}</> : (
        <div style={{ display: 'grid', gridTemplateColumns: three ? 'repeat(3,minmax(0,1fr))' : 'repeat(2,minmax(0,1fr))', gap: 16, alignItems: 'start' }}>
          {heat}<div style={{ gridColumn: three ? 'span 2' : 'auto' }}>{bank}</div>{upcoming}
        </div>
      )}
      {calendar}
      {sheets}
    </Page>
  );
}

function IdeaSheet({ idea, onClose, save, remove }: { idea?: StreamingIdea; onClose: () => void; save: (v: { title: string; format: StreamFormat; vibe: string | null; description: string | null; status?: StreamStatus }) => Promise<void>; remove?: () => Promise<void> }) {
  const [title, setTitle] = useState(idea?.title ?? '');
  const [format, setFormat] = useState<StreamFormat>(idea?.format ?? 'solo');
  const [vibe, setVibe] = useState(idea?.vibe ?? '');
  const [desc, setDesc] = useState(idea?.description ?? '');
  const [status, setStatus] = useState<StreamStatus>(idea?.status ?? 'idea');
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title={idea ? 'Edit idea' : 'New stream idea'} onClose={onClose}>
      <Field l="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} style={field} placeholder="Building a client site live" autoFocus /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Field l="Format"><select value={format} onChange={(e) => setFormat(e.target.value as StreamFormat)} style={field}>{STREAM_FORMATS.map((f) => <option key={f} value={f}>{FORMAT[f]}</option>)}</select></Field>
        {idea ? <Field l="Status"><select value={status} onChange={(e) => setStatus(e.target.value as StreamStatus)} style={field}>{STREAM_STATUSES.map((s) => <option key={s} value={s}>{STATUS[s].l}</option>)}</select></Field>
          : <Field l="Vibe"><input value={vibe} onChange={(e) => setVibe(e.target.value)} style={field} placeholder="Cooking, horror" /></Field>}
      </div>
      {idea && <Field l="Vibe"><input value={vibe} onChange={(e) => setVibe(e.target.value)} style={field} /></Field>}
      <Field l="One line"><textarea value={desc} onChange={(e) => setDesc(e.target.value)} style={{ ...area, height: 72 }} /></Field>
      <button className="mm-btn mm-btn--primary" style={{ height: 48, fontSize: 15 }} disabled={busy || !title.trim()} onClick={async () => { setBusy(true); await save({ title: title.trim(), format, vibe: vibe.trim() || null, description: desc.trim() || null, ...(idea ? { status } : {}) }); onClose(); }}>{busy ? 'Saving…' : 'Save'}</button>
      {remove && <button className="mm-btn" style={{ height: 44, color: 'var(--danger)' }} onClick={() => { if (window.confirm('Delete this idea?')) void remove(); }}>Delete</button>}
    </Sheet>
  );
}
