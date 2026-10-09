import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { api } from '../../../lib/api';
import { Page, Sheet, Field, field } from '../../mm/Page';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import Stat from '../../mm/Stat';
import { Empty } from '../../mm/States';
import { celebrate } from '../../../lib/celebrate';
import { moneyEarned, fmtRange } from '../../../data/moneyMove';
import type { MoneyMove } from '../../../data/moneyMove';

interface Row { id: string; week_start: string; move: MoneyMove; status: 'new' | 'doing' | 'not_for_me' | 'done'; reason: string | null; earned_usd: number | null; created_at: string }
interface Inputs { money_skills: string[]; money_hours_per_week: number | null; money_budget_usd: number | null; money_city: string | null; money_interests: string[] }

/** Money Move (brief §4.7): one researched, local, doable opportunity a week. */
export default function MoneyMoveScreen() {
  const [rows, setRows] = useState<Row[]>([]);
  const [inputs, setInputs] = useState<Inputs | null>(null);
  const [editInputs, setEditInputs] = useState<Inputs | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [no, setNo] = useState<Row | null>(null);
  const [reason, setReason] = useState('');
  const [earned, setEarned] = useState<Row | null>(null);
  const [amount, setAmount] = useState('');
  const [missing, setMissing] = useState(false);
  const load = useCallback(async () => {
    const [m, s] = await Promise.all([supabase.from('money_moves').select('*').order('week_start', { ascending: false }).limit(30), supabase.from('user_setup').select('money_skills,money_hours_per_week,money_budget_usd,money_city,money_interests').maybeSingle()]);
    setMissing(!!m.error); setRows((m.data ?? []) as Row[]); setInputs((s.data as Inputs | null) ?? null);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const current = rows[0] && rows[0].status !== 'not_for_me' ? rows[0] : null;
  const run = async () => { setBusy(true); setMsg(''); const r = await api<{ ok?: boolean; error?: string }>('/api/solo/money-run', { body: {} }); setBusy(false); setMsg(r.error ?? ''); await load(); };
  const doing = async (r: Row) => {
    await supabase.from('money_moves').update({ status: 'doing', updated_at: new Date().toISOString() }).eq('id', r.id);
    const { data: g } = await supabase.from('goals').insert({ title: `Money Move: ${r.move.title}`.slice(0, 200), target_cost: r.move.earnings_low_usd, target_metric: 'dollars', deadline: new Date(Date.parse(`${r.week_start}T12:00:00Z`) + 6 * 86400000).toISOString().slice(0, 10) }).select('id').single();
    const goalId = (g as { id: string } | null)?.id ?? null;
    if (goalId) await supabase.from('money_moves').update({ goal_id: goalId }).eq('id', r.id);
    await supabase.from('tasks').insert(r.move.steps.map((s, i) => ({ title: s.slice(0, 300), project: 'Money Move', priority: i === 0 ? 'high' : 'med', goal_id: goalId, source: 'money_move', source_ref: r.id })));
    setMsg('Added the steps to Tasks and a mini goal for this week.'); await load();
  };
  const saveNo = async () => { if (!no) return; await supabase.from('money_moves').update({ status: 'not_for_me', reason: reason.trim() || null, updated_at: new Date().toISOString() }).eq('id', no.id); setNo(null); setReason(''); await load(); };
  const saveEarned = async () => { if (!earned) return; const n = Number(amount.replace(/[$,]/g, '')); if (!Number.isFinite(n)) return; await supabase.from('money_moves').update({ earned_usd: n, status: 'done', updated_at: new Date().toISOString() }).eq('id', earned.id); celebrate(); setEarned(null); setAmount(''); await load(); };
  const saveInputs = async () => {
    if (!editInputs) return;
    const { error } = await supabase.from('user_setup').upsert({ ...editInputs, updated_at: new Date().toISOString() });
    setMsg(error ? error.message : 'Saved. Your next move uses these.'); setEditInputs(null); await load();
  };
  const total = moneyEarned(rows);
  const blankInputs: Inputs = { money_skills: [], money_hours_per_week: null, money_budget_usd: null, money_city: null, money_interests: [] };

  if (missing) return <Page title="Money Move"><Empty text="Money Move needs the October migration (schema_124) applied." /></Page>;
  return (
    <Page title="Money Move" sub="One specific, doable way to make money this week, built from your skills, time, budget and city." menu={[{ t: 'Your inputs', onClick: () => setEditInputs(inputs ?? blankInputs) }]}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10 }}>
        <Stat label="Money Moves earned you" value={`$${total.toLocaleString('en-US')}`} k={total > 0 ? 'good' : undefined} />
        <Stat label="Moves tried" value={String(rows.filter((r) => r.status === 'doing' || r.status === 'done').length)} />
        <Stat label="This week" value={current ? (current.status === 'new' ? 'Ready' : current.status) : '—'} />
      </div>
      {msg && <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{msg}</div>}
      {!inputs?.money_city && !inputs?.money_skills?.length && (
        <Card title="Tell it what you've got">
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Your skills, free hours a week, a starting budget and your city. That's all it needs to find something real near you.</div>
          <button className="mm-btn mm-btn--primary" style={{ alignSelf: 'flex-start' }} onClick={() => setEditInputs(inputs ?? blankInputs)}>Add my inputs</button>
        </Card>
      )}
      {current ? <MoveCard r={current} onDoing={() => void doing(current)} onNo={() => setNo(current)} onEarned={() => { setEarned(current); setAmount(''); }} /> : (
        <Card title="This week's move" action={<button className="mm-btn mm-btn--primary" disabled={busy} onClick={() => void run()}>{busy ? 'Researching… (30–60s)' : 'Find my move'}</button>}>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>A new one lands every Monday morning. Or ask for one now.</div>
        </Card>
      )}
      {rows.slice(current ? 1 : 0).length > 0 && (
        <Card title="Past moves">
          {rows.slice(current ? 1 : 0).map((r, i) => (
            <div key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', borderTop: i ? '1px solid var(--grid)' : 'none', fontSize: 14 }}>
              <span style={{ flex: 1, minWidth: 0 }}>{r.move.title}</span>
              {r.earned_usd != null ? <Chip k="good">${Number(r.earned_usd).toLocaleString('en-US')}</Chip> : <Chip k="neutral">{r.status.replace(/_/g, ' ')}</Chip>}
              {r.status === 'doing' && <button className="mm-btn" style={{ height: 32 }} onClick={() => { setEarned(r); setAmount(''); }}>I made $___</button>}
            </div>
          ))}
        </Card>
      )}
      {no && (
        <Sheet title="Not for me" onClose={() => setNo(null)}>
          <Field l="Why? (makes the next one fit better)"><input style={field} value={reason} placeholder="e.g. no truck, hate cold calling, weekends are taken" onChange={(e) => setReason(e.target.value)} /></Field>
          <button className="mm-btn mm-btn--primary" style={{ height: 44, marginTop: 12 }} onClick={() => void saveNo()}>Save</button>
        </Sheet>
      )}
      {earned && (
        <Sheet title="What did you make?" onClose={() => setEarned(null)}>
          <Field l="Amount ($)"><input style={field} inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <button className="mm-btn mm-btn--primary" style={{ height: 44, marginTop: 12 }} onClick={() => void saveEarned()}>Log it</button>
        </Sheet>
      )}
      {editInputs && (
        <Sheet title="Your inputs" onClose={() => setEditInputs(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field l="Skills (comma separated)"><input style={field} value={editInputs.money_skills.join(', ')} onChange={(e) => setEditInputs({ ...editInputs, money_skills: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field l="Free hours a week"><input style={field} inputMode="numeric" value={editInputs.money_hours_per_week ?? ''} onChange={(e) => setEditInputs({ ...editInputs, money_hours_per_week: e.target.value ? Number(e.target.value) : null })} /></Field>
              <Field l="Starting budget ($)"><input style={field} inputMode="numeric" value={editInputs.money_budget_usd ?? ''} onChange={(e) => setEditInputs({ ...editInputs, money_budget_usd: e.target.value ? Number(e.target.value) : null })} /></Field>
            </div>
            <Field l="City"><input style={field} value={editInputs.money_city ?? ''} onChange={(e) => setEditInputs({ ...editInputs, money_city: e.target.value || null })} /></Field>
            <Field l="Interests (comma separated)"><input style={field} value={editInputs.money_interests.join(', ')} onChange={(e) => setEditInputs({ ...editInputs, money_interests: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></Field>
            <button className="mm-btn mm-btn--primary" style={{ height: 44 }} onClick={() => void saveInputs()}>Save</button>
          </div>
        </Sheet>
      )}
    </Page>
  );
}

function MoveCard({ r, onDoing, onNo, onEarned }: { r: Row; onDoing: () => void; onNo: () => void; onEarned: () => void }) {
  const m = r.move;
  return (
    <Card title={m.title} meta={`week of ${r.week_start}`} hero>
      <div style={{ fontSize: 15, color: 'var(--text)' }}><strong>Why it fits you:</strong> {m.why_you}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8 }}>
        <Stat label="Startup cost" value={m.startup_cost_usd != null ? `$${m.startup_cost_usd}` : '—'} />
        <Stat label="Time" value={m.time_needed || '—'} />
        <Stat label="Could earn" value={fmtRange(m.earnings_low_usd, m.earnings_high_usd)} pill="estimate" />
      </div>
      <div><div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 4 }}>The plan</div><ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 }}>{m.steps.map((s, i) => <li key={i}>{s}</li>)}</ol></div>
      {m.script && <div><div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 4 }}>Ready to post</div><div style={{ whiteSpace: 'pre-wrap', fontSize: 14, padding: 12, borderRadius: 10, background: 'var(--surface-2)' }}>{m.script}</div><button className="mm-btn" style={{ marginTop: 6 }} onClick={() => void navigator.clipboard?.writeText(m.script)}>Copy</button></div>}
      {m.sources.length > 0 && <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>Sources: {m.sources.map((s) => <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)' }}>{s.title || new URL(s.url).hostname} ↗</a>)}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {r.status === 'new' && <><button className="mm-btn mm-btn--primary" onClick={onDoing}>I'm doing it</button><button className="mm-btn" onClick={onNo}>Not for me</button></>}
        {r.status === 'doing' && <button className="mm-btn mm-btn--primary" onClick={onEarned}>I made $___</button>}
        {r.earned_usd != null && <Chip k="good">Made ${Number(r.earned_usd).toLocaleString('en-US')}</Chip>}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Earnings are an estimate, not a promise.</div>
    </Card>
  );
}
