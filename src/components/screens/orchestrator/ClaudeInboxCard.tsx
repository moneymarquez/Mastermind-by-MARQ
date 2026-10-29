import { useCallback, useEffect, useState } from 'react';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import { field } from '../../mm/Page';
import { supabase } from '../../../lib/supabase';

interface Row { id: string; request: string; screen: string | null; status: 'new' | 'working' | 'done' | 'wontdo'; reply: string | null; replied_at: string | null; seen_at: string | null; created_at: string }
const LABEL = { new: 'Queued', working: 'Claude is on it', done: 'Done', wontdo: 'Not doing' } as const;
const KIND = { new: 'neutral', working: 'warn', done: 'good', wontdo: 'bad' } as const;

/** Requests Nova (or you) sent to Claude, and Claude's replies. */
export default function ClaudeInboxCard() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { data, error } = await supabase.from('claude_inbox').select('id,request,screen,status,reply,replied_at,seen_at,created_at').order('created_at', { ascending: false }).limit(15);
    if (error) { setRows([]); return; }
    const r = (data ?? []) as Row[];
    setRows(r);
    // Replies count as seen once they're on screen.
    const unseen = r.filter((x) => x.reply && !x.seen_at).map((x) => x.id);
    if (unseen.length) await supabase.from('claude_inbox').update({ seen_at: new Date().toISOString() }).in('id', unseen);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const send = async () => {
    if (text.trim().length < 4) return;
    setBusy(true);
    await supabase.from('claude_inbox').insert({ source: 'typed', request: text.trim().slice(0, 4000), screen: 'orchestrator' });
    setBusy(false); setText(''); void load();
  };
  const open = (rows ?? []).filter((r) => r.status === 'new' || r.status === 'working').length;
  return (
    <Card title="Claude inbox" meta={rows ? (open ? `${open} open` : 'All caught up') : '…'}>
      <span style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Ask Nova to change the app and it lands here for Claude. Or type it yourself. Replies show here and in the bell.</span>
      <div style={{ display: 'flex', gap: 8 }}>
        <input style={{ ...field, flex: 1 }} placeholder="e.g. Make the Office rooms bigger on my phone" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void send(); }} />
        <button className="mm-btn mm-btn--primary" style={{ height: 40 }} disabled={busy || text.trim().length < 4} onClick={() => void send()}>Send</button>
      </div>
      {(rows ?? []).map((r) => (
        <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 0', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 14.5 }}>{r.request}</span>
            <Chip k={KIND[r.status]}>{LABEL[r.status]}</Chip>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}{r.screen ? ` · from ${r.screen}` : ''}</span>
          {r.reply && <div style={{ fontSize: 14, lineHeight: 1.5, padding: '8px 10px', borderRadius: 10, background: 'var(--surface-2)', whiteSpace: 'pre-wrap' }}><strong>Claude:</strong> {r.reply}</div>}
        </div>
      ))}
    </Card>
  );
}
