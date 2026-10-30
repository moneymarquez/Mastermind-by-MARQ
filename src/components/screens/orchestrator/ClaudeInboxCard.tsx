import { useCallback, useEffect, useState } from 'react';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import { field } from '../../mm/Page';
import { supabase } from '../../../lib/supabase';

interface Row { id: string; request: string; screen: string | null; answer: string | null; status: 'new' | 'working' | 'question' | 'done' | 'wontdo'; reply: string | null; replied_at: string | null; seen_at: string | null; created_at: string }
const LABEL = { new: 'Queued', working: 'Claude is on it', question: 'Claude asked you', done: 'Done', wontdo: 'Not doing' } as const;
const KIND = { new: 'neutral', working: 'warn', question: 'accent', done: 'good', wontdo: 'bad' } as const;

/** Requests Nova (or you) sent to Claude, and Claude's replies. */
export default function ClaudeInboxCard() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { data, error } = await supabase.from('claude_inbox').select('id,request,screen,answer,status,reply,replied_at,seen_at,created_at').order('created_at', { ascending: false }).limit(15);
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
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const answer = async (id: string) => {
    const a = (answers[id] ?? '').trim(); if (!a) return;
    await supabase.from('claude_inbox').update({ answer: a, status: 'new', updated_at: new Date().toISOString() }).eq('id', id);
    setAnswers((x) => ({ ...x, [id]: '' })); void load();
  };
  const open = (rows ?? []).filter((r) => r.status === 'new' || r.status === 'working' || r.status === 'question').length;
  return (
    <Card title="Claude inbox" meta={rows ? (open ? `${open} open` : 'All caught up') : '…'}>
      <span style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Ask Nova to change the app and it lands here. Claude checks every hour from 7am to 10pm, does it, and replies here and in the bell. If something's unclear, Claude asks you here first.</span>
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
          {r.reply && <div style={{ fontSize: 14, lineHeight: 1.5, padding: '8px 10px', borderRadius: 'var(--g-r-md)', background: 'var(--surface-2)', whiteSpace: 'pre-wrap' }}><strong>Claude:</strong> {r.reply}</div>}
          {r.answer && r.status !== 'question' && <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}><strong>You:</strong> {r.answer}</div>}
          {r.status === 'question' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...field, flex: 1 }} placeholder="Answer Claude" value={answers[r.id] ?? ''} onChange={(e) => setAnswers((x) => ({ ...x, [r.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') void answer(r.id); }} />
              <button className="mm-btn mm-btn--primary" style={{ height: 40 }} disabled={!(answers[r.id] ?? '').trim()} onClick={() => void answer(r.id)}>Answer</button>
            </div>
          )}
        </div>
      ))}
    </Card>
  );
}
