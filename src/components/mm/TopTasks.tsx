import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { decideApproval } from '../../data/useEngine';
import { useNeedsConfirm } from './ScorePills';
import ScorePills from './ScorePills';
import Chip from './Chip';
import Card from './Card';
import TopLineScene from '../office3d/TopLineScene';
import type { TopTask } from '../../data/topTasks';

/** Marq's top tasks across the app (shared cache so Today and the Classroom agree). */
let cache: TopTask[] | null = null;
const subs = new Set<(t: TopTask[]) => void>();
async function fetchTop() {
  const r = await api<{ top?: TopTask[] }>('/api/orchestrator/top', { method: 'GET' });
  if (r.top) { cache = r.top; subs.forEach((f) => f(r.top!)); }
}
export function useTopTasks() {
  const [top, setTop] = useState<TopTask[] | null>(cache);
  useEffect(() => { subs.add(setTop); void fetchTop(); const t = setInterval(() => void fetchTop(), 60000); return () => { subs.delete(setTop); clearInterval(t); }; }, []);
  const reload = useCallback(() => fetchTop(), []);
  return { top, reload };
}

// Cards that spend money or need you to buy something are decided in Approvals.
const OPEN_ONLY = new Set(['sample_purchase', 'domain_purchase', 'supplier_order', 'buy_domain', 'product_pitch', 'scout_products']);

/** One ranked task with the action that finishes it. */
export function TopTaskRow({ t, onDone, onNav, expanded }: { t: TopTask; onDone: () => void; onNav: (screen: string) => void; expanded?: boolean }) {
  const { red } = useNeedsConfirm('approval', t.kind === 'approval' ? t.id : null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const finish = async (fn: () => Promise<{ error?: string | null } | unknown>, done: string) => {
    setBusy(true); const r = (await fn()) as { error?: { message?: string } | string | null }; setBusy(false);
    if (r && r.error) { setMsg(typeof r.error === 'string' ? r.error : r.error.message ?? 'Could not save.'); return; }
    setMsg(done); onDone();
  };
  const approve = (status: 'approved' | 'sent_back') => {
    if (status === 'approved' && red && !window.confirm('This card scores red. Approve anyway?')) return;
    void finish(async () => { const r = await decideApproval(t.id, status, status === 'sent_back' ? 'Sent back from your line.' : null); return { error: r.error ?? (r.ok === false ? 'Could not save.' : null) }; }, status === 'approved' ? 'Approved.' : 'Sent back.');
  };
  const btn = { height: 32, fontSize: 13 } as const;
  return (
    <div style={{ display: 'flex', gap: 10, padding: '10px 0', borderTop: '1px solid var(--border)', alignItems: 'flex-start' }}>
      <span style={{ width: 26, height: 26, borderRadius: 13, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, background: t.rank === 1 ? '#ff5a36' : 'color-mix(in srgb, var(--warning) 30%, transparent)', color: t.rank === 1 ? '#fff' : 'var(--text)' }}>{t.rank}</span>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.3 }}>{t.title}</span>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5, color: 'var(--text-tertiary)' }}><Chip>{t.area}</Chip>{t.reason}</span>
        {expanded && t.kind === 'approval' && <ScorePills type="approval" id={t.id} compact />}
        {msg ? <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{msg}</span> : (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {t.kind === 'approval' && !OPEN_ONLY.has(t.type ?? '') && !t.is_money && <>
              <button className="mm-btn mm-btn--primary" style={btn} disabled={busy} onClick={() => approve('approved')}>Approve</button>
              <button className="mm-btn" style={btn} disabled={busy} onClick={() => approve('sent_back')}>Send back</button>
            </>}
            {(t.kind === 'task' || t.kind === 'reminder') && <button className="mm-btn mm-btn--primary" style={btn} disabled={busy} onClick={() => void finish(() => t.kind === 'task' ? supabase.from('tasks').update({ done: true, done_at: new Date().toISOString() }).eq('id', t.id) : supabase.from('reminders').update({ done: true }).eq('id', t.id), 'Done.')}>Done</button>}
            {t.phone && <a className="mm-btn mm-btn--primary" style={{ ...btn, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} href={`tel:${t.phone}`}>Call</a>}
            <button className="mm-btn" style={btn} onClick={() => onNav(t.screen)}>{t.kind === 'approval' && (t.is_money || OPEN_ONLY.has(t.type ?? '')) ? 'Open to decide' : 'Open'}</button>
          </div>
        )}
      </div>
    </div>
  );
}

/** "Your line" for Today: the scene plus the ranked list with actions. */
export function YourLineCard({ nav, owner }: { nav: (screen: string) => void; owner: boolean }) {
  const { top, reload } = useTopTasks();
  const [open, setOpen] = useState<string | null>(null);
  if (!owner) return null;
  return (
    <Card title="Your line" meta={top ? (top.length ? 'Most important first, across everything' : 'Nothing urgent') : 'Loading…'} action={<button className="mm-btn" style={{ height: 32 }} onClick={() => nav('board')}>Classroom</button>}>
      {top && top.length > 0 && <TopLineScene top={top} onOpen={(t) => setOpen(`${t.kind}:${t.id}`)} />}
      {top && top.length === 0 && <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Nobody's in line. Nothing is overdue or waiting on you.</span>}
      <div>{(top ?? []).map((t) => <TopTaskRow key={`${t.kind}:${t.id}`} t={t} expanded={open === `${t.kind}:${t.id}`} onDone={() => void reload()} onNav={nav} />)}</div>
    </Card>
  );
}
