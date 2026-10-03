import { useEffect, useRef, useState } from 'react';
import { useCallRecordings } from '../../../data/useCallRecordings';
import type { CallRecording } from '../../../data/useCallRecordings';
import { useContacts } from '../../../data/useContacts';
import Card from '../../mm/Card';
import Row from '../../mm/Row';
import Stat from '../../mm/Stat';
import { Empty } from '../../mm/States';
import ModuleDash from '../../mm/ModuleDash';
import { Page, Sheet, Field, field, area, useModule, useAi, AiOffCard, NovaMark } from '../../mm/Page';
import { shortDate, ymd } from './util';

const len = (s: number | null) => (s == null ? '—' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`);
const when = (iso: string) => { const d = ymd(new Date(iso)); return d === ymd(new Date()) ? `Today ${new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : shortDate(d); };

export default function CallRecordingsV2() {
  const { device, novaOpen } = useModule();
  const phone = device === 'phone';
  const R = useCallRecordings();
  const { contacts } = useContacts();
  const [sel, setSel] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const who = (id: string | null) => (id ? contacts.find((c) => c.id === id) ?? null : null);
  const cur = R.recordings.find((r) => r.id === sel) ?? (phone ? null : R.recordings[0] ?? null);

  if (!R.loading && R.recordings.length === 0) {
    return (
      <Page title="Call Recordings" sub="Tied to your contacts">
        <Empty text="No recordings yet. Upload a call and it's kept with the contact you spoke to." cta="Upload a recording" onCta={() => setAdding(true)} />
        {adding && <UploadSheet onClose={() => setAdding(false)} R={R} contacts={contacts} />}
      </Page>
    );
  }

  const month = new Date().toISOString().slice(0, 7);
  const thisMonth = R.recordings.filter((r) => r.recorded_at.slice(0, 7) === month);
  const timed = R.recordings.filter((r) => r.duration_seconds != null);
  const total = timed.reduce((s, r) => s + (r.duration_seconds ?? 0), 0);
  const stats = [
    <Stat key="m" label="This month" value={String(thisMonth.length)} pill="Recordings" />,
    <Stat key="t" label="Total time" value={timed.length ? `${Math.round((total / 3600) * 10) / 10} h` : '—'} pill={timed.length ? `${timed.length} with a length` : 'No lengths yet'} />,
    <Stat key="s" label="Summarized" value={`${R.recordings.filter((r) => r.ai_analysis).length} of ${R.recordings.length}`} pill="By Nova" />,
    <Stat key="a" label="Avg. length" value={timed.length ? len(total / timed.length) : '—'} pill="Per call" />,
  ];
  const player = cur && <Player key={cur.id} r={cur} contact={who(cur.contact_id)?.name ?? null} R={R} onDeleted={() => setSel(null)} onBack={phone ? () => setSel(null) : undefined} />;
  const library = (
    <Card title="Library" meta="Linked to contacts" flush wide={!phone}>
      <div>{R.recordings.map((r, i) => { const c = who(r.contact_id); return <Row key={r.id} first={i === 0} name={c?.name ?? r.title} meta={c?.business_name ?? (c ? undefined : 'No contact')} chip={r.ai_analysis ? 'Summarized' : 'Not summarized'} k={r.ai_analysis ? 'good' : 'neutral'} amt={len(r.duration_seconds)} sub={when(r.recorded_at)} onClick={() => setSel(r.id)} />; })}</div>
    </Card>
  );

  return (
    <Page title="Call Recordings" sub={`${R.recordings.length} recordings`} fab={{ t: 'Upload', onClick: () => setAdding(true) }}>
      {phone ? (cur ? player : <><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{stats[0]}{stats[3]}</div>{library}</>) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>{stats}</div>
          {player}
          <ModuleDash device={device} novaOpen={novaOpen} spec={{ table: { title: 'Library', meta: 'Linked to contacts', head: ['Contact', 'Business', 'When', 'Summary', 'Length'], cols: 'minmax(0,1.2fr) minmax(0,1.2fr) 130px 140px 70px',
            rows: R.recordings.map((r) => { const c = who(r.contact_id); return { cells: [c?.name ?? r.title, c?.business_name ?? '—', when(r.recorded_at), r.ai_analysis ? { chip: 'Summarized', k: 'good' as const } : { chip: 'Not yet', k: 'neutral' as const }, len(r.duration_seconds)], onClick: () => setSel(r.id) }; }) } }} />
        </>
      )}
      {adding && <UploadSheet onClose={() => setAdding(false)} R={R} contacts={contacts} />}
    </Page>
  );
}

function Player({ r, contact, R, onDeleted, onBack }: { r: CallRecording; contact: string | null; R: ReturnType<typeof useCallRecordings>; onDeleted: () => void; onBack?: () => void }) {
  const ai = useAi();
  const { nav } = useModule();
  const [url, setUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState(r.notes ?? '');
  const audio = useRef<HTMLAudioElement>(null);
  useEffect(() => { void R.getPlaybackUrl(r.file_path).then(setUrl); }, [r.file_path]); // eslint-disable-line react-hooks/exhaustive-deps
  const skip = (s: number) => { if (audio.current) audio.current.currentTime = Math.max(0, audio.current.currentTime + s); };
  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      {onBack && <button className="mm-btn" onClick={onBack} style={{ alignSelf: 'flex-start', height: 34 }}>‹ All recordings</button>}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
        <span style={{ color: 'var(--text)', fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em' }}>{[contact, when(r.recorded_at), r.duration_seconds != null ? len(r.duration_seconds) : null].filter(Boolean).join(' · ')}</span>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>Now playing</span>
      </div>
      <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{r.title}</span>
      {url ? <audio ref={audio} controls src={url} style={{ width: '100%' }} /> : <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Loading audio…</span>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="mm-btn" onClick={() => skip(-15)}>−15s</button>
        <button className="mm-btn" onClick={() => skip(15)}>+15s</button>
        {r.contact_id && <button className="mm-btn" onClick={() => nav('contacts')}>Open contacts</button>}
        <button className="mm-btn" style={{ color: 'var(--danger)' }} onClick={async () => { if (window.confirm('Delete this recording?')) { await R.remove(r.id, r.file_path); onDeleted(); } }}>Delete</button>
      </div>
      {ai === false ? <AiOffCard text="Calls aren't summarized while AI is off. Playback and notes still work." /> : (
        <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <NovaMark title="Summary" />
          <span style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{r.ai_analysis ?? 'Not summarized yet.'}</span>
        </div>
      )}
      <Field l="Notes"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => { if (notes !== (r.notes ?? '')) void R.updateNotes(r.id, notes); }} style={{ ...area, height: 80 }} /></Field>
    </section>
  );
}

function UploadSheet({ onClose, R, contacts }: { onClose: () => void; R: ReturnType<typeof useCallRecordings>; contacts: ReturnType<typeof useContacts>['contacts'] }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [cid, setCid] = useState('');
  return (
    <Sheet title="Upload a recording" onClose={onClose}>
      <Field l="Audio file"><input type="file" accept="audio/*" onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); if (f && !title) setTitle(f.name.replace(/\.[^/.]+$/, '')); }} style={{ ...field, paddingTop: 10 }} /></Field>
      <Field l="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} style={field} /></Field>
      <Field l="Contact"><select value={cid} onChange={(e) => setCid(e.target.value)} style={field}><option value="">No linked contact</option>{contacts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.business_name ? ` · ${c.business_name}` : ''}</option>)}</select></Field>
      {R.uploadError && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{R.uploadError}</span>}
      <button className="mm-btn mm-btn--primary" style={{ height: 48, fontSize: 15 }} disabled={R.uploading || !file || !title.trim()} onClick={async () => { await R.upload(file!, { title: title.trim(), contact_id: cid || null, notes: null }); if (!R.uploadError) onClose(); }}>{R.uploading ? 'Uploading…' : 'Save recording'}</button>
    </Sheet>
  );
}
