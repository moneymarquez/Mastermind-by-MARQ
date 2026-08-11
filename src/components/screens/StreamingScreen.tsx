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
}

const inputStyle: CSSProperties = {
  background: '#1a1c21', border: '1px solid #2b2f36', borderRadius: 8, padding: '9px 12px',
  color: '#F5F6F7', fontSize: 13.5, outline: 'none',
};
const cardStyle: CSSProperties = { background: '#14161A', border: '1px solid #22262B', borderRadius: 14, padding: 18 };
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
          <div style={{ padding: '7px 14px', borderRadius: 999, background: '#F5F6F7', color: '#0A0B0D', fontSize: 12, fontWeight: 600, cursor: 'pointer' }} onClick={save}>Save</div>
          <div style={{ padding: '7px 14px', borderRadius: 999, color: '#8A8F98', fontSize: 12, cursor: 'pointer' }} onClick={() => setEditing(false)}>Cancel</div>
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F6F7' }}>{idea.title}</div>
        <span style={{ fontSize: 11, color: '#565b64', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={onDelete}>Delete</span>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: STREAM_COLOR, border: `1px solid ${STREAM_COLOR}`, borderRadius: 999, padding: '2px 8px' }}>
          {FORMAT_LABEL[idea.format]}
        </span>
        {idea.vibe && <span style={{ fontSize: 10.5, color: '#8A8F98', border: '1px solid #22262B', borderRadius: 999, padding: '2px 8px' }}>{idea.vibe}</span>}
      </div>
      {idea.description && <div style={{ fontSize: 12.5, color: '#8A8F98', marginTop: 10, lineHeight: 1.5 }}>{idea.description}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <select style={{ ...inputStyle, flex: 1, fontSize: 12.5, padding: '6px 10px' }} value={idea.status} onChange={(e) => onUpdate({ status: e.target.value as StreamStatus })}>
          {STREAM_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <span style={{ fontSize: 11, color: '#565b64', cursor: 'pointer' }} onClick={() => setEditing(true)}>Edit</span>
      </div>
    </div>
  );
}

export default function StreamingScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const { ideas, loading, addIdea, updateIdea, removeIdea, loadSeed } = useStreamingIdeas();
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
        <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F6F7' }}>Ideas Bank</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {ideas.length === 0 && (
            <div
              style={{ padding: '8px 16px', borderRadius: 999, border: '1px solid #22262B', color: seeding ? '#565b64' : '#8A8F98', fontSize: 12.5, cursor: seeding ? 'default' : 'pointer' }}
              onClick={() => !seeding && loadStarterIdeas()}
            >
              {seeding ? 'Loading…' : 'Load starter ideas (20)'}
            </div>
          )}
          <div
            style={{ padding: '8px 16px', borderRadius: 999, border: '1px solid #F5F6F7', color: '#F5F6F7', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
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
          <div style={{ alignSelf: 'flex-start', padding: '9px 16px', borderRadius: 999, background: '#F5F6F7', color: '#0A0B0D', fontSize: 13, fontWeight: 600, cursor: 'pointer' }} onClick={submit}>
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
        <div style={{ fontSize: 12.5, color: '#565b64', marginTop: 8 }}>Nothing here yet — load the starter list or add your own.</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 36, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F6F7' }}>Schedule</div>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 999, border: `1px solid ${STREAM_COLOR}`, color: STREAM_COLOR, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
          onClick={() => calendarRef.current?.openAddModal()}
        >
          + New Stream
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: '#565b64', marginTop: 4 }}>
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
