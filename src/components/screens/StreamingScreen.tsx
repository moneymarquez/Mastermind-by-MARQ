import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useStreamingIdeas } from '../../data/useStreamingIdeas';
import { STREAMING_IDEAS_SEED } from '../../data/streamingIdeasSeed';
import { useEvents } from '../../data/useEvents';
import { useContacts } from '../../data/useContacts';
import { STREAM_FORMATS, STREAM_STATUSES } from '../../data/types';
import type { StreamFormat, StreamStatus, StreamingIdea } from '../../data/types';
import { EVENT_TYPE_COLOR } from '../../data/eventDisplay';
import CalendarView from '../CalendarView';
import type { CalendarViewHandle } from '../CalendarView';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
  isOwner: boolean;
}

const inputStyle: CSSProperties = {
  background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)', padding: '9px 12px',
  color: 'var(--text)', fontSize: 'var(--text-body-lg)', outline: 'none',
};
const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 18 };
const FORMAT_LABEL: Record<StreamFormat, string> = { solo: 'Solo', duo: 'Duo' };
const STATUS_LABEL: Record<StreamStatus, string> = { idea: 'Idea', planned: 'Planned', recorded: 'Recorded', posted: 'Posted' };
const STREAM_COLOR = EVENT_TYPE_COLOR.streaming;

function IdeaCard({ idea, onUpdate, onDelete }: { idea: StreamingIdea; onUpdate: (patch: Partial<StreamingIdea>) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(idea.title);
  const [vibe, setVibe] = useState(idea.vibe ?? '');
  const [description, setDescription] = useState(idea.description ?? '');
  const [format, setFormat] = useState<StreamFormat>(idea.format);

  const save = () => {
    onUpdate({ title: title.trim() || idea.title, vibe: vibe.trim() || null, description: description.trim() || null, format });
    setEditing(false);
  };

  if (editing) {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <select style={{ ...inputStyle, flex: 1 }} value={format} onChange={(e) => setFormat(e.target.value as StreamFormat)}>
              {STREAM_FORMATS.map((f) => <option key={f} value={f}>{FORMAT_LABEL[f]}</option>)}
            </select>
            <input style={{ ...inputStyle, flex: 1 }} placeholder="Vibe" value={vibe} onChange={(e) => setVibe(e.target.value)} />
          </div>
          <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <div style={{ padding: '7px 14px', borderRadius: 'var(--radius-pill)', background: 'var(--text)', color: 'var(--bg)', fontSize: 'var(--text-small)', fontWeight: 600, cursor: 'pointer' }} onClick={save}>Save</div>
          <div style={{ padding: '7px 14px', borderRadius: 'var(--radius-pill)', color: 'var(--text-secondary)', fontSize: 'var(--text-small)', cursor: 'pointer' }} onClick={() => setEditing(false)}>Cancel</div>
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontSize: 'var(--text-label)', fontWeight: 600, color: 'var(--text)' }}>{idea.title}</div>
        <span style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={onDelete}>Delete</span>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 'var(--text-micro)', fontWeight: 700, color: STREAM_COLOR, border: `1px solid ${STREAM_COLOR}`, borderRadius: 'var(--radius-pill)', padding: '2px 8px' }}>
          {FORMAT_LABEL[idea.format]}
        </span>
        {idea.vibe && <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '2px 8px' }}>{idea.vibe}</span>}
      </div>
      {idea.description && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.5 }}>{idea.description}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <select style={{ ...inputStyle, flex: 1, fontSize: 'var(--text-body-sm)', padding: '6px 10px' }} value={idea.status} onChange={(e) => onUpdate({ status: e.target.value as StreamStatus })}>
          {STREAM_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <span style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={() => setEditing(true)}>Edit</span>
      </div>
    </div>
  );
}

export default function StreamingScreen({ homeHeadStyle, homeSubStyle, isOwner }: Props) {
  const { ideas, loading, addIdea, updateIdea, removeIdea, loadSeed } = useStreamingIdeas();
  // Load starter ideas seeds Cristopher's own personal streaming ideas
  // (specific to his content/business) — only the owner account should
  // ever be offered that button. Other accounts get a plain empty state
  // with just "+ Add idea", per the personal-content gating requirement.
  const { events, addEvent, addHolidayEvents, updateEvent, deleteEvent } = useEvents();
  const { search: searchContacts, upsertContact } = useContacts();
  const calendarRef = useRef<CalendarViewHandle>(null);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [format, setFormat] = useState<StreamFormat>('solo');
  const [vibe, setVibe] = useState('');
  const [description, setDescription] = useState('');
  const [seeding, setSeeding] = useState(false);

  const streamingEvents = events.filter((e) => e.type === 'streaming');

  const submit = async () => {
    if (!title.trim()) return;
    await addIdea({ title: title.trim(), format, vibe: vibe.trim() || null, description: description.trim() || null });
    setTitle(''); setVibe(''); setDescription(''); setFormat('solo');
    setShowForm(false);
  };

  const loadStarterIdeas = async () => {
    setSeeding(true);
    try {
      await loadSeed(STREAMING_IDEAS_SEED);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div>
      <div style={homeHeadStyle}>Streaming</div>
      <div style={homeSubStyle}>Ideas Bank + your streaming schedule.</div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontSize: 'var(--text-label)', fontWeight: 600, color: 'var(--text)' }}>Ideas Bank</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {ideas.length === 0 && isOwner && (
            <div
              style={{ padding: '8px 16px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', color: seeding ? 'var(--text-tertiary)' : 'var(--text-secondary)', fontSize: 'var(--text-body-sm)', cursor: seeding ? 'default' : 'pointer' }}
              onClick={() => !seeding && loadStarterIdeas()}
            >
              {seeding ? 'Loading…' : 'Load starter ideas (20)'}
            </div>
          )}
          <div
            style={{ padding: '8px 16px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--text)', color: 'var(--text)', fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: 'pointer' }}
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? 'Cancel' : '+ Add idea'}
          </div>
        </div>
      </div>

      {showForm && (
        <div style={{ ...cardStyle, marginTop: 14, maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input style={inputStyle} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <select style={{ ...inputStyle, flex: 1 }} value={format} onChange={(e) => setFormat(e.target.value as StreamFormat)}>
              {STREAM_FORMATS.map((f) => <option key={f} value={f}>{FORMAT_LABEL[f]}</option>)}
            </select>
            <input style={{ ...inputStyle, flex: 1 }} placeholder="Vibe (e.g. Horror, Cooking)" value={vibe} onChange={(e) => setVibe(e.target.value)} />
          </div>
          <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} placeholder="One-line description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div style={{ alignSelf: 'flex-start', padding: '9px 16px', borderRadius: 'var(--radius-pill)', background: 'var(--text)', color: 'var(--bg)', fontSize: 'var(--text-body)', fontWeight: 600, cursor: 'pointer' }} onClick={submit}>
            Save idea
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginTop: 16 }}>
        {ideas.map((idea) => (
          <IdeaCard key={idea.id} idea={idea} onUpdate={(patch) => updateIdea(idea.id, patch)} onDelete={() => removeIdea(idea.id)} />
        ))}
      </div>
      {!loading && ideas.length === 0 && (
        <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)', marginTop: 8 }}>Nothing here yet — load the starter list or add your own.</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 36, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontSize: 'var(--text-label)', fontWeight: 600, color: 'var(--text)' }}>Schedule</div>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 'var(--radius-pill)', border: `1px solid ${STREAM_COLOR}`, color: STREAM_COLOR, fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: 'pointer' }}
          onClick={() => calendarRef.current?.openAddModal()}
        >
          + New Stream
        </div>
      </div>
      <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 4 }}>
        Same calendar as Schedule, filtered to Streaming — anything added here shows up there too, and vice versa.
      </div>

      <CalendarView
        ref={calendarRef}
        events={streamingEvents}
        defaultType="streaming"
        searchContacts={searchContacts}
        upsertContact={upsertContact}
        addEvent={addEvent}
        addHolidayEvents={addHolidayEvents}
        updateEvent={updateEvent}
        deleteEvent={deleteEvent}
      />
    </div>
  );
}
