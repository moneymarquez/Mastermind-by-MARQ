import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { supabase } from '../../lib/supabase';
import Chip from '../mm/Chip';
import { LEVERS, METRICS, fmtMetric, rowFor, scorecard, targetsOf, valuesOf } from '../../data/scorecard';
import type { MetricKey, MetricsRow, Values } from '../../data/scorecard';
import { JOURNEY_STEPS } from '../../data/madebyJourney';

type Row = MetricsRow & { id: string; captured_at: string };
const num = (s: string) => (s.trim() === '' || !Number.isFinite(Number(s)) ? null : Number(s));

/** Client record → Scorecard (Business Scaler, Growth Blueprint): baseline
 *  captured once, current values, a 90-day target per metric, the weakest
 *  metric highlighted and a next play for it from the static lever library.
 *  Reads and writes client_metrics only (data/scorecard.ts). Sends nothing. */
export default function ScorecardPanel({ clientId, phone }: { clientId: string; phone?: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [form, setForm] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<'none' | 'now' | 'targets'>('none');
  const load = useCallback(async () => {
    const r = await supabase.from('client_metrics').select('*').eq('client_id', clientId).order('captured_at');
    if (r.error) setErr(r.error.message);
    setRows((r.data ?? []) as Row[]);
    setLoading(false);
  }, [clientId]);
  useEffect(() => { void load(); }, [load]);

  const base = rows.find((x) => x.kind === 'baseline') ?? null;
  const latest = [...rows].reverse().find((x) => x.kind === 'snapshot') ?? null;
  const sc = scorecard(base, latest);
  const vals = (): Values => Object.fromEntries(METRICS.map((m) => [m.key, num(form[m.key] ?? '')])) as Values;
  const open = (m: typeof mode) => {
    const src = m === 'targets' ? Object.fromEntries(sc.lines.map((l) => [l.m.key, l.target])) : m === 'now' ? { ...valuesOf(base), ...valuesOf(latest) } : {};
    setForm(Object.fromEntries(Object.entries(src).map(([k, v]) => [k, v == null ? '' : String(v)])));
    setMode(m);
  };
  const save = async () => {
    setErr('');
    let r;
    if (!base) r = await supabase.from('client_metrics').insert({ client_id: clientId, kind: 'baseline', ...rowFor(vals()) });
    else if (mode === 'targets') r = await supabase.from('client_metrics').update({ note: rowFor(valuesOf(base), vals()).note }).eq('id', base.id);
    else r = await supabase.from('client_metrics').insert({ client_id: clientId, kind: 'snapshot', ...rowFor(vals()) });
    if (r.error) { setErr(r.error.message); return; }
    setMode('none'); setForm({}); await load();
  };

  if (loading) return <div style={{ marginTop: 16, color: 'var(--text-tertiary)', fontSize: 14 }}>Loading…</div>;
  const w = sc.weakest, play = w ? LEVERS[w.m.key] : null;
  const stepName = (n: number) => JOURNEY_STEPS.find((s) => s.n === n)?.label ?? '';
  const editing = !base || mode !== 'none';

  return (
    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {err && <div style={{ fontSize: 13.5, color: 'var(--danger)' }}>{err}</div>}
      {w && play && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 14, borderRadius: 14, border: '1px solid var(--warning)', background: 'color-mix(in srgb, var(--warning) 8%, var(--surface))' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip k="warn">Weakest: {w.m.label}</Chip>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{fmtMetric(w.m, w.now ?? w.base)} now · target {fmtMetric(w.m, w.target)} · {Math.round((w.progress ?? 0) * 100)}% of the way</span>
          </div>
          <strong style={{ fontSize: 15, color: 'var(--text)' }}>Next play: {play.title}</strong>
          <span style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>{play.detail}</span>
          <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{play.autonomy} · proof: {play.proof} · step {play.step} {stepName(play.step)}</span>
        </div>
      )}
      {sc.hasBaseline && !w && <Chip k="good">Every metric is at or past its 90-day target</Chip>}
      {sc.hasBaseline && (
        <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ ...rowGrid(phone), fontSize: 12, color: 'var(--text-tertiary)', background: 'var(--surface-2)' }}><span>Metric</span><span>Baseline</span><span>Now</span><span>90-day target</span></div>
          {sc.lines.map((l) => {
            const weak = w?.m.key === l.m.key;
            return (
              <div key={l.m.key} style={{ ...rowGrid(phone), fontSize: 14, borderTop: '1px solid var(--border)', background: weak ? 'color-mix(in srgb, var(--warning) 10%, transparent)' : undefined }}>
                <span style={{ color: 'var(--text)', fontWeight: weak ? 600 : 500 }}>{l.m.label}{l.progress != null && <span style={{ display: 'block', height: 3, marginTop: 4, borderRadius: 2, background: 'var(--surface-3)' }}><span style={{ display: 'block', height: 3, width: `${Math.round(l.progress * 100)}%`, borderRadius: 2, background: weak ? 'var(--warning)' : 'var(--accent)' }} /></span>}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{fmtMetric(l.m, l.base)}</span>
                <span style={{ color: 'var(--text)' }}>{fmtMetric(l.m, l.now)}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{fmtMetric(l.m, l.target)}</span>
              </div>
            );
          })}
        </div>
      )}
      {base && (
        <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>
          Baseline captured {new Date(base.captured_at).toLocaleDateString()}{latest ? ` · now as of ${new Date(latest.captured_at).toLocaleDateString()}` : ' · no update yet (now = baseline)'}{Object.keys(targetsOf(base)).length ? '' : ' · targets are the default lift'}
        </span>
      )}
      {!editing && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="mm-btn mm-btn--primary" style={{ height: 36 }} onClick={() => open('now')}>Update current numbers</button>
          <button className="mm-btn" style={{ height: 36 }} onClick={() => open('targets')}>Edit 90-day targets</button>
        </div>
      )}
      {editing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <strong style={{ fontSize: 15, color: 'var(--text)' }}>{!base ? 'Capture the baseline (once)' : mode === 'targets' ? '90-day targets' : 'Current numbers'}</strong>
          {!base && <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>From their POS, books and Google before any work starts. It can't be changed later, so the lift is provable. Leave a field empty if unknown.</span>}
          <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            {METRICS.map((m) => (
              <label key={m.key} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                {m.label}{m.unit ? ` (${m.unit})` : ''}
                <input inputMode="decimal" value={form[m.key] ?? ''} placeholder={m.hint} onChange={(e) => setForm((f) => ({ ...f, [m.key as MetricKey]: e.target.value }))} style={input} />
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="mm-btn mm-btn--primary" style={{ height: 36 }} disabled={!METRICS.some((m) => num(form[m.key] ?? '') != null)} onClick={() => void save()}>{!base ? 'Save baseline' : 'Save'}</button>
            {base && <button className="mm-btn" style={{ height: 36 }} onClick={() => setMode('none')}>Cancel</button>}
          </div>
        </div>
      )}
    </div>
  );
}

const rowGrid = (phone?: boolean): CSSProperties => ({ display: 'grid', gridTemplateColumns: phone ? '1.5fr 1fr 1fr 1fr' : '2fr 1fr 1fr 1fr', gap: 8, padding: '9px 12px', alignItems: 'center' });
const input: CSSProperties = { height: 36, padding: '0 10px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' };
