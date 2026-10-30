import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { HANDOFF_LABEL } from '../../data/handoffs';
import { E, Badge, btn } from '../screens/ecom/ecomShared';

// "From the other bots": the open ai_handoffs addressed to this screen's
// bot (the nightly handoffs step writes them). Done / Dismiss only change
// the handoff row; nothing sends or posts.
interface Row { id: string; kind: string; status: string; note: string | null; payload: Record<string, unknown>; created_at: string }

export default function HandoffInbox({ kinds, title = 'From the other bots' }: { kinds: string[]; title?: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState('');
  const key = kinds.join(',');
  const load = useCallback(async () => {
    const r = await supabase.from('ai_handoffs').select('id,kind,status,note,payload,created_at').in('kind', key.split(',')).in('status', ['open', 'working']).order('created_at', { ascending: false }).limit(12);
    setRows(r.error ? [] : ((r.data ?? []) as Row[]));
  }, [key]);
  useEffect(() => { void load(); }, [load]);
  const close = async (h: Row, how: 'done' | 'dismissed') => {
    const r = await supabase.from('ai_handoffs').update({ status: 'done', done_at: new Date().toISOString(), note: how === 'dismissed' ? `Dismissed: ${h.note ?? ''}`.slice(0, 500) : h.note }).eq('id', h.id);
    setMsg(r.error ? 'Could not save that. Try again.' : how === 'done' ? 'Marked done.' : 'Dismissed.');
    await load();
  };
  if (!rows.length && !msg) return null;
  return (
    <div data-testid="handoff-inbox" style={{ ...E.card, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 14.5, letterSpacing: '-0.01em', color: E.text }}>{title} <span style={{ color: E.faint, fontWeight: 400, fontFamily: 'var(--g-mono)', fontSize: 12.5 }}>· {rows.length} open</span></div>
      {rows.map((h) => {
        const url = typeof h.payload.url === 'string' ? h.payload.url : null;
        return (
          <div key={h.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap', borderTop: `1px solid ${E.border}`, paddingTop: 8 }}>
            <Badge color={E.blue}>{HANDOFF_LABEL[h.kind] ?? h.kind}</Badge>
            <span style={{ flex: '1 1 220px', color: E.text, fontSize: 'var(--text-body)' }}>{h.note ?? 'Open handoff.'}{url && <> <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: E.accent }}>source ↗</a></>}</span>
            <span style={{ display: 'flex', gap: 6 }}>
              <button style={{ ...btn('primary'), minHeight: 30, height: 30, fontSize: 12.5 }} onClick={() => void close(h, 'done')}>Done</button>
              <button style={{ ...btn('ghost'), minHeight: 30, height: 30, fontSize: 12.5 }} onClick={() => void close(h, 'dismissed')}>Dismiss</button>
            </span>
          </div>
        );
      })}
      {msg && <div style={{ fontSize: 'var(--text-caption)', color: E.muted }}>{msg}</div>}
    </div>
  );
}
