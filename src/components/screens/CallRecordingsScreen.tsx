import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useCallRecordings } from '../../data/useCallRecordings';
import type { CallRecording } from '../../data/useCallRecordings';
import { useContacts } from '../../data/useContacts';
import { useNovaPreferences } from '../../data/useNovaPreferences';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 };
const inputStyle: CSSProperties = {
  background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 8, padding: '9px 12px',
  color: 'var(--text)', fontSize: 13.5, outline: 'none',
};
const primaryBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '10px 18px', borderRadius: 999,
  background: 'var(--text)', color: 'var(--bg)', fontSize: 13, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start',
};

function DetailView({ recording, contactName, onBack }: { recording: CallRecording; contactName: string | null; onBack: () => void }) {
  const { getPlaybackUrl, updateNotes, remove } = useCallRecordings();
  const { assistantName } = useNovaPreferences();
  const [url, setUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState(recording.notes ?? '');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getPlaybackUrl(recording.file_path).then(setUrl);
  }, [recording.file_path]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ marginTop: 20, maxWidth: 640 }}>
      <div style={{ fontSize: 13, color: 'var(--text-tertiary)', cursor: 'pointer', marginBottom: 14 }} onClick={onBack}>&larr; All recordings</div>
      <div style={cardStyle}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{recording.title}</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>
          {new Date(recording.recorded_at).toLocaleString()}{contactName ? ` · ${contactName}` : ''}
        </div>
        {url ? (
          <audio controls src={url} style={{ width: '100%', marginTop: 16 }} />
        ) : (
          <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 16 }}>Loading audio…</div>
        )}

        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Notes</div>
          <textarea
            style={{ ...inputStyle, width: '100%', minHeight: 80, resize: 'vertical', fontFamily: 'inherit' }}
            value={notes}
            onChange={(e) => { setNotes(e.target.value); setSaved(false); }}
            onBlur={() => { updateNotes(recording.id, notes); setSaved(true); }}
          />
          {saved && <div style={{ fontSize: 11.5, color: '#4CAF7D', marginTop: 4 }}>Saved.</div>}
        </div>

        <div style={{ marginTop: 20, padding: '12px 14px', borderRadius: 10, background: 'var(--surface-4)', border: '1px solid var(--border-2)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#C9A24B' }}>AI call breakdown — pending Anthropic key</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4 }}>
            {recording.ai_analysis ?? `${assistantName} will summarize this call automatically once the API key is funded — nothing to set up here when that happens.`}
          </div>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', cursor: 'pointer', marginTop: 20 }} onClick={() => remove(recording.id, recording.file_path).then(onBack)}>
          Delete recording
        </div>
      </div>
    </div>
  );
}

export default function CallRecordingsScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const { recordings, loading, uploading, uploadError, upload } = useCallRecordings();
  const { contacts } = useContacts();
  const fileRef = useRef<HTMLInputElement>(null);

  const [showForm, setShowForm] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [contactId, setContactId] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = recordings.find((r) => r.id === selectedId) ?? null;
  const contactName = (id: string | null) => (id ? contacts.find((c) => c.id === id)?.name ?? null : null);

  const onFilePicked = (file: File | null) => {
    setPendingFile(file);
    if (file && !title) setTitle(file.name.replace(/\.[^/.]+$/, ''));
  };

  const submit = async () => {
    if (!pendingFile || !title.trim()) return;
    await upload(pendingFile, { title: title.trim(), contact_id: contactId || null, notes: null });
    setPendingFile(null);
    setTitle('');
    setContactId('');
    setShowForm(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  if (selected) {
    return <DetailView recording={selected} contactName={contactName(selected.contact_id)} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={homeHeadStyle}>Call Recordings</div>
          <div style={homeSubStyle}>Recordings tied to your Dialing/Scaling contacts.</div>
        </div>
        <div style={primaryBtn} onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancel' : '+ Upload recording'}</div>
      </div>

      {showForm && (
        <div style={{ ...cardStyle, marginTop: 20, maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input ref={fileRef} type="file" accept="audio/*" onChange={(e) => onFilePicked(e.target.files?.[0] ?? null)} style={{ fontSize: 13, color: 'var(--text-quaternary-2)' }} />
          <input style={inputStyle} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <select style={inputStyle} value={contactId} onChange={(e) => setContactId(e.target.value)}>
            <option value="">No linked contact</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.source})</option>)}
          </select>
          {uploadError && <div style={{ fontSize: 12, color: '#c47a7a' }}>{uploadError}</div>}
          <div style={{ ...primaryBtn, opacity: uploading || !pendingFile || !title.trim() ? 0.5 : 1 }} onClick={() => !uploading && submit()}>
            {uploading ? 'Uploading…' : 'Save recording'}
          </div>
        </div>
      )}

      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', maxWidth: 640 }}>
        {recordings.map((r) => (
          <div
            key={r.id}
            onClick={() => setSelectedId(r.id)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--surface-3)', background: 'var(--surface-2)', cursor: 'pointer' }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{r.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                {new Date(r.recorded_at).toLocaleDateString()}{contactName(r.contact_id) ? ` · ${contactName(r.contact_id)}` : ''}
              </div>
            </div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#C9A24B', textTransform: 'uppercase' }}>AI pending</div>
          </div>
        ))}
        {!loading && recordings.length === 0 && (
          <div style={{ padding: 18, fontSize: 13, color: 'var(--text-tertiary)', background: 'var(--surface-2)' }}>No recordings uploaded yet.</div>
        )}
      </div>
    </div>
  );
}
