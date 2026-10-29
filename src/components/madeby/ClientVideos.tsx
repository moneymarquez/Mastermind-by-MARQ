import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import { field } from '../mm/Page';
import Chip from '../mm/Chip';
import VideoRecorder from './VideoRecorder';
import { videoEmail, shareUrl } from '../../data/clientVideo';
import { DEFAULT_SENDER } from '../../data/madeby';
import type { CrmClient } from '../../data/types';

interface Row { id: string; title: string; share_token: string; views: number; last_viewed_at: string | null; replies: { name: string; message: string; at: string }[]; created_at: string }

/** A client's videos: record one, get the share link, send it in an email
 *  you read first. Views and replies show here. Archive only, never delete. */
export default function ClientVideos({ client }: { client: CrmClient }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [recording, setRecording] = useState(false);
  const [draft, setDraft] = useState<{ to: string; subject: string; body: string } | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { data } = await supabase.from('client_videos').select('id,title,share_token,views,last_viewed_at,replies,created_at').eq('client_id', client.id).is('archived_at', null).order('created_at', { ascending: false });
    setRows((data ?? []) as Row[]);
  }, [client.id]);
  useEffect(() => { void load(); }, [load]);

  const link = (t: string) => shareUrl(window.location.origin, t);
  const startDraft = (r: { title: string; share_token: string }) => {
    const first = (client.contact_name || client.business_name || 'there').split(' ')[0];
    setDraft({ to: client.contact_email ?? '', ...videoEmail({ firstName: first, title: r.title, link: link(r.share_token), sender: DEFAULT_SENDER.split(' (')[0] }) });
  };
  const send = async () => {
    if (!draft) return;
    setBusy(true); setMsg('');
    const r = await api<{ ok?: boolean; status?: string; error?: string }>('/api/comms/send', { body: { channel: 'email', to: draft.to, subject: draft.subject, body: draft.body, client_id: client.id } });
    setBusy(false);
    if (r.error || !r.ok) { setMsg(r.error ?? 'Couldn\'t send.'); return; }
    setMsg(r.status === 'dry_run' ? 'Test mode is on: logged in Comms, not emailed.' : 'Sent.');
    setDraft(null);
  };
  const archive = async (id: string) => { await supabase.from('client_videos').update({ archived_at: new Date().toISOString() }).eq('id', id); await load(); };

  return (
    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <strong style={{ flex: 1 }}>Videos</strong>
        {!recording && <button className="mm-btn" style={{ height: 32 }} onClick={() => { setRecording(true); setMsg(''); }}>Record a video</button>}
      </div>
      {recording && (
        <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <VideoRecorder clientId={client.id} defaultTitle={`A quick video for ${client.business_name}`} onCancel={() => setRecording(false)}
            onSaved={(r) => { setRecording(false); startDraft(r); void load(); }} />
        </div>
      )}
      {draft && (
        <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Email draft with the link. Read it, then send.</span>
          <input style={field} placeholder="To" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
          <input style={field} placeholder="Subject" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
          <textarea style={{ ...field, height: 150, padding: 10, lineHeight: 1.5 }} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="mm-btn mm-btn--primary" style={{ height: 38 }} disabled={busy || !draft.to.trim()} onClick={() => void send()}>{busy ? 'Sending…' : 'Send email'}</button>
            <button className="mm-btn" style={{ height: 38 }} onClick={() => setDraft(null)}>Not now</button>
          </div>
        </div>
      )}
      {msg && <span style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{msg}</span>}
      {rows.length === 0 && !recording && <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>No videos for {client.business_name} yet.</span>}
      {rows.map((r) => (
        <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 14 }}>
            <span style={{ flex: '1 1 160px', minWidth: 0 }}>{r.title}</span>
            <Chip k={r.views ? 'good' : 'neutral'}>{r.views ? `${r.views} view${r.views === 1 ? '' : 's'}` : 'not watched'}</Chip>
            {r.replies.length > 0 && <Chip k="warn">{r.replies.length} repl{r.replies.length === 1 ? 'y' : 'ies'}</Chip>}
            <button className="mm-btn" style={{ height: 30 }} onClick={() => { void navigator.clipboard?.writeText(link(r.share_token)); setMsg('Link copied.'); }}>Copy link</button>
            <button className="mm-btn" style={{ height: 30 }} onClick={() => startDraft(r)}>Email it</button>
            <button className="mm-btn" style={{ height: 30 }} onClick={() => void archive(r.id)}>Archive</button>
          </div>
          {r.replies.map((x, i) => <span key={i} style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}><strong>{x.name}:</strong> {x.message}</span>)}
        </div>
      ))}
    </div>
  );
}
