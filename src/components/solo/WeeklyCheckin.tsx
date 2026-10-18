import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import Card from '../mm/Card';
import Chip from '../mm/Chip';
import { field } from '../mm/Page';
import type { Adjustment, ScoreRow } from '../../data/weeklyCheckin';

interface Row { id: string; week_start: string; summary: string; scorecard: ScoreRow[] | null; shortfalls: { area: string; what: string; why: string }[] | null; adjustments: Adjustment[] | null; focus: string | null; chat: { role: string; text: string }[] }
const STATUS_K: Record<ScoreRow['status'], 'good' | 'warn' | 'bad' | 'neutral'> = { hit: 'good', close: 'warn', miss: 'bad', none: 'neutral' };

/** Weekly Check-in (brief §4.6): planned vs actual, where it fell short and
 *  why, 3 adjustments you apply with one tap, and a chat to push back. */
export default function WeeklyCheckin({ week }: { week: string }) {
  const [row, setRow] = useState<Row | null>(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [text, setText] = useState('');
  const [applied, setApplied] = useState<Set<number>>(new Set());
  const load = useCallback(async () => {
    const { data } = await supabase.from('weekly_reviews').select('id,week_start,summary,scorecard,shortfalls,adjustments,focus,chat').eq('week_start', week).maybeSingle();
    setRow((data as Row | null) ?? null); setApplied(new Set());
  }, [week]);
  useEffect(() => { void load(); }, [load]);
  const run = async () => { setBusy('Checking your week… (20–40s)'); setMsg(''); const r = await api<{ error?: string }>('/api/solo/checkin-run', { body: { week_start: week } }); setBusy(''); if (r.error) setMsg(r.error); await load(); };
  const send = async () => {
    if (!row || !text.trim()) return;
    const t = text.trim(); setText(''); setBusy('…');
    setRow({ ...row, chat: [...(row.chat ?? []), { role: 'user', text: t }] });
    const r = await api<{ reply?: string; error?: string }>('/api/solo/checkin-chat', { body: { id: row.id, message: t } });
    setBusy(''); if (r.error) setMsg(r.error); await load();
  };
  const apply = async (a: Adjustment, i: number) => {
    const c = a.change as Record<string, string | number | undefined>;
    let err: string | null = null;
    if (a.kind === 'macros') {
      const { data: cur } = await supabase.from('nutrition_targets').select('*').eq('active', true).limit(1).maybeSingle();
      const old = cur as { id: string; daily_calories: number; daily_protein_g: number; daily_carbs_g: number; daily_fat_g: number } | null;
      const cal = Number(c.calories ?? old?.daily_calories ?? 0), pro = Number(c.protein_g ?? old?.daily_protein_g ?? 0);
      if (old) await supabase.from('nutrition_targets').update({ active: false }).eq('id', old.id);
      ({ error: err } = await supabase.from('nutrition_targets').insert({ daily_calories: Math.round(cal), daily_protein_g: Math.round(pro), daily_carbs_g: old?.daily_carbs_g ?? Math.round((cal * 0.45) / 4), daily_fat_g: old?.daily_fat_g ?? Math.round((cal * 0.25) / 9), rationale: `Weekly check-in: ${a.why}`.slice(0, 500) }).then((r) => ({ error: r.error?.message ?? null })));
    } else if (a.kind === 'task') {
      ({ error: err } = await supabase.from('tasks').insert({ title: String(c.title ?? a.title).slice(0, 300), due: typeof c.due === 'string' ? c.due : null, priority: c.priority === 'high' || c.priority === 'low' ? c.priority : 'med', project: c.project ? String(c.project) : null, source: 'weekly_checkin', source_ref: row?.id ?? null, notes: a.why }).then((r) => ({ error: r.error?.message ?? null })));
    } else if (a.kind === 'reminder') {
      ({ error: err } = await supabase.from('reminders').insert({ title: String(c.title ?? a.title).slice(0, 200), due_date: typeof c.due_date === 'string' ? c.due_date : new Date().toISOString().slice(0, 10), due_time: typeof c.due_time === 'string' ? c.due_time : null }).then((r) => ({ error: r.error?.message ?? null })));
    } else if (a.kind === 'schedule_note') {
      ({ error: err } = await supabase.from('nova_memory').insert({ fact: `Schedule change from the weekly check-in: ${String(c.note ?? a.title)}` }).then((r) => ({ error: r.error?.message ?? null })));
    } else if (a.kind === 'focus') {
      ({ error: err } = await supabase.from('user_setup').upsert({ focus_line: String(c.line ?? a.title).slice(0, 120), focus_week: week, updated_at: new Date().toISOString() }).then((r) => ({ error: r.error?.message ?? null })));
    }
    if (err) setMsg(err); else setApplied((s) => new Set(s).add(i));
  };
  const pin = async () => { if (!row?.focus) return; const { error } = await supabase.from('user_setup').upsert({ focus_line: row.focus, focus_week: week, updated_at: new Date().toISOString() }); setMsg(error ? error.message : 'Pinned on Home for next week.'); };

  if (!row?.scorecard) {
    return (
      <Card title="Weekly check-in" meta="planned vs actual, and what to change" action={<button className="mm-btn mm-btn--primary" disabled={!!busy} onClick={() => void run()}>{busy || 'Run the check-in'}</button>}>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>It runs by itself Sunday evening and texts or pushes you when it's ready. It reads Tasks, Goals, Macros, Fitness, Dialing and your Daily Plans for the week.</div>
        {msg && <div style={{ fontSize: 13.5, color: 'var(--danger)' }}>{msg}</div>}
      </Card>
    );
  }
  return (
    <Card title="Weekly check-in" meta={row.summary.slice(0, 120)} action={<button className="mm-btn" disabled={!!busy} onClick={() => void run()}>{busy ? '…' : 'Run again'}</button>} wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {row.scorecard.map((r) => (
          <div key={r.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: 10, alignItems: 'center', fontSize: 14 }}>
            <span>{r.label}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{r.key.startsWith('goal:') ? `${r.actual}% vs ${r.planned}% expected` : `${r.actual} / ${r.planned}`}</span>
            <Chip k={STATUS_K[r.status]}>{r.status === 'none' ? '—' : r.status}</Chip>
          </div>
        ))}
      </div>
      {(row.shortfalls ?? []).length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Where you fell short</div>
          {(row.shortfalls ?? []).map((s, i) => <div key={i} style={{ fontSize: 14 }}><strong>{s.area}:</strong> {s.what}{s.why ? <span style={{ color: 'var(--text-secondary)' }}> — likely why: {s.why}</span> : null}</div>)}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>3 adjustments for next week</div>
        {(row.adjustments ?? []).map((a, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 10, border: '1px solid var(--border)', borderRadius: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14.5, fontWeight: 600 }}>{a.title}</div><div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{a.why}</div></div>
            {applied.has(i) ? <Chip k="good">Applied</Chip> : <button className="mm-btn mm-btn--primary" style={{ height: 36 }} onClick={() => void apply(a, i)}>Apply</button>}
          </div>
        ))}
      </div>
      {row.focus && <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 12, borderRadius: 12, background: 'var(--surface-2)' }}><span style={{ flex: 1, fontSize: 15 }}>Focus for next week: <strong>{row.focus}</strong></span><button className="mm-btn" style={{ height: 34 }} onClick={() => void pin()}>Pin on Home</button></div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(row.chat ?? []).map((m, i) => <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', padding: '8px 12px', borderRadius: 12, background: m.role === 'user' ? 'var(--surface-2)' : 'transparent', border: m.role === 'user' ? 'none' : '1px solid var(--border)', fontSize: 14 }}>{m.text}</div>)}
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={{ ...field, flex: 1 }} value={text} placeholder='Push back, e.g. "that week was an outlier"' onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void send(); }} />
          <button className="mm-btn mm-btn--primary" style={{ height: 44 }} disabled={!!busy || !text.trim()} onClick={() => void send()}>Send</button>
        </div>
      </div>
      {msg && <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{msg}</div>}
    </Card>
  );
}
