import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { api } from '../../../lib/api';
import { Page, Sheet, Field, field } from '../../mm/Page';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import Stat from '../../mm/Stat';
import { Empty } from '../../mm/States';
import { celebrate } from '../../../lib/celebrate';
import { PEPTIDE_FOOTER, dosesLeft, needsReorder, monthlyCost, dosesPerWeek } from '../../../data/peptides';
import type { PeptideRow } from '../../../data/peptides';

type Row = PeptideRow & { schedule_note: string | null; site_rotation: string | null; notes: string | null };
interface Log { id: string; peptide_id: string; taken_at: string; amount: string | null; site: string | null; effects: string | null }
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** Peptides (brief §4.8): tracking only. The AI summarizes your own log;
 *  it never suggests amounts, compounds or protocols. */
export default function PeptidesScreen() {
  const [rows, setRows] = useState<Row[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [edit, setEdit] = useState<Partial<Row> | null>(null);
  const [logFor, setLogFor] = useState<Row | null>(null);
  const [entry, setEntry] = useState<{ amount: string; site: string; effects: string }>({ amount: '', site: '', effects: '' });
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  const load = useCallback(async () => {
    const [p, l] = await Promise.all([supabase.from('peptides').select('*').order('created_at'), supabase.from('peptide_logs').select('*').order('taken_at', { ascending: false }).limit(200)]);
    setMissing(!!p.error); setRows((p.data ?? []) as Row[]); setLogs((l.data ?? []) as Log[]);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const save = async () => {
    if (!edit?.name?.trim()) return;
    const row = { name: edit.name.trim(), amount: edit.amount || null, unit: edit.unit || null, days: edit.days ?? [], times: (edit.times ?? []).filter(Boolean), schedule_note: edit.schedule_note || null, site_rotation: edit.site_rotation || null, vial_remaining: edit.vial_remaining ?? null, per_dose: edit.per_dose ?? null, reorder_at_doses: edit.reorder_at_doses ?? null, cost_per_month: edit.cost_per_month ?? null, notes: edit.notes || null, active: edit.active ?? true, updated_at: new Date().toISOString() };
    if (edit.id) await supabase.from('peptides').update(row).eq('id', edit.id); else await supabase.from('peptides').insert(row);
    setEdit(null); await load();
  };
  const log = async () => {
    if (!logFor) return;
    await supabase.from('peptide_logs').insert({ peptide_id: logFor.id, amount: entry.amount || logFor.amount, site: entry.site || null, effects: entry.effects || null });
    if (logFor.vial_remaining != null && logFor.per_dose) await supabase.from('peptides').update({ vial_remaining: Math.max(0, logFor.vial_remaining - logFor.per_dose) }).eq('id', logFor.id);
    celebrate(); setLogFor(null); setEntry({ amount: '', site: '', effects: '' }); await load();
  };
  const summarize = async () => { setBusy(true); const r = await api<{ text?: string; error?: string }>('/api/solo/peptide-summary', { body: {} }); setBusy(false); setSummary(r.error ?? r.text ?? ''); };
  const num = (v: string) => (v.trim() === '' ? null : Number(v));

  if (missing) return <Page title="Peptides"><Empty text="Peptides needs the October migration (schema_124) applied." /></Page>;
  return (
    <Page title="Peptides" sub="Log what you take, when, and how you feel. Tracking only." fab={{ t: 'Peptide', onClick: () => setEdit({ days: [], times: ['08:00'], active: true }) }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10 }}>
        <Stat label="Tracking" value={String(rows.filter((r) => r.active).length)} />
        <Stat label="Per month" value={`$${monthlyCost(rows).toFixed(0)}`} />
        <Stat label="Reorder soon" value={String(rows.filter((r) => r.active && needsReorder(r)).length)} k={rows.some((r) => r.active && needsReorder(r)) ? 'warn' : undefined} />
      </div>
      {rows.length === 0 && <Empty text="Nothing tracked yet. Add what you take with the amount and schedule your doctor gave you; Masterminds reminds you and keeps the log." />}
      {rows.map((r) => {
        const left = dosesLeft(r);
        const mine = logs.filter((l) => l.peptide_id === r.id);
        return (
          <Card key={r.id} title={r.name} meta={[r.amount && `${r.amount} ${r.unit ?? ''}`, r.days.length ? `${r.days.join(' ')} ${r.times.join(', ')}` : r.schedule_note].filter(Boolean).join(' · ')} action={<button className="mm-btn" onClick={() => setEdit(r)}>Edit</button>}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {!r.active && <Chip k="neutral">paused</Chip>}
              {left != null && <Chip k={needsReorder(r) ? 'warn' : 'neutral'}>{left} doses left{needsReorder(r) ? ' · reorder' : ''}</Chip>}
              {dosesPerWeek(r) > 0 && <Chip k="neutral">{dosesPerWeek(r)}/week</Chip>}
              {r.site_rotation && <Chip k="neutral">sites: {r.site_rotation}</Chip>}
            </div>
            {mine.slice(0, 4).map((l) => <div key={l.id} style={{ fontSize: 13.5, color: 'var(--text-secondary)', borderTop: '1px solid var(--grid)', paddingTop: 6 }}>{new Date(l.taken_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · {l.amount ?? ''}{l.site ? ` · ${l.site}` : ''}{l.effects ? ` · “${l.effects}”` : ''}</div>)}
            <button className="mm-btn mm-btn--primary" style={{ alignSelf: 'flex-start' }} onClick={() => { setLogFor(r); setEntry({ amount: r.amount ?? '', site: '', effects: '' }); }}>Log a dose</button>
          </Card>
        );
      })}
      {rows.length > 0 && (
        <Card title="Summary of your log" meta="AI reads only what you logged" action={<button className="mm-btn" disabled={busy} onClick={() => void summarize()}>{busy ? '…' : 'Summarize'}</button>}>
          <div style={{ fontSize: 14, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>{summary || 'Consistency, the effects you noted, and what\'s running low. It won\'t suggest amounts or protocols.'}</div>
        </Card>
      )}
      <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', textAlign: 'center', padding: '8px 0' }}>{PEPTIDE_FOOTER}</div>

      {edit && (
        <Sheet title={edit.id ? 'Edit' : 'Track a peptide'} onClose={() => setEdit(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field l="Name"><input style={field} value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field l="Amount (as prescribed)"><input style={field} value={edit.amount ?? ''} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} /></Field>
              <Field l="Unit"><input style={field} value={edit.unit ?? ''} placeholder="mg, mcg, IU, ml" onChange={(e) => setEdit({ ...edit, unit: e.target.value })} /></Field>
            </div>
            <Field l="Days">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{DAYS.map((d) => { const on = (edit.days ?? []).includes(d); return <button key={d} className={`mm-btn ${on ? 'mm-btn--primary' : ''}`} style={{ height: 34, padding: '0 10px' }} onClick={() => setEdit({ ...edit, days: on ? (edit.days ?? []).filter((x) => x !== d) : [...(edit.days ?? []), d] })}>{d}</button>; })}</div>
            </Field>
            <Field l="Times (reminders)"><input style={field} value={(edit.times ?? []).join(', ')} placeholder="08:00, 20:00" onChange={(e) => setEdit({ ...edit, times: e.target.value.split(',').map((x) => x.trim()).filter((x) => /^\d{2}:\d{2}$/.test(x)) })} /></Field>
            <Field l="Injection-site rotation (optional)"><input style={field} value={edit.site_rotation ?? ''} onChange={(e) => setEdit({ ...edit, site_rotation: e.target.value })} /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <Field l="In the vial"><input style={field} inputMode="decimal" value={edit.vial_remaining ?? ''} onChange={(e) => setEdit({ ...edit, vial_remaining: num(e.target.value) })} /></Field>
              <Field l="Used per dose"><input style={field} inputMode="decimal" value={edit.per_dose ?? ''} onChange={(e) => setEdit({ ...edit, per_dose: num(e.target.value) })} /></Field>
              <Field l="Remind at doses left"><input style={field} inputMode="numeric" value={edit.reorder_at_doses ?? ''} onChange={(e) => setEdit({ ...edit, reorder_at_doses: num(e.target.value) })} /></Field>
            </div>
            <Field l="Cost per month ($)"><input style={field} inputMode="decimal" value={edit.cost_per_month ?? ''} onChange={(e) => setEdit({ ...edit, cost_per_month: num(e.target.value) })} /></Field>
            <Field l="Notes"><textarea style={{ ...field, height: 80, padding: 10 }} value={edit.notes ?? ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}><input type="checkbox" checked={edit.active ?? true} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Active (reminders on)</label>
            <button className="mm-btn mm-btn--primary" style={{ height: 44 }} disabled={!edit.name?.trim()} onClick={() => void save()}>Save</button>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{PEPTIDE_FOOTER}</div>
          </div>
        </Sheet>
      )}
      {logFor && (
        <Sheet title={`Log: ${logFor.name}`} onClose={() => setLogFor(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field l="Amount"><input style={field} value={entry.amount} onChange={(e) => setEntry({ ...entry, amount: e.target.value })} /></Field>
            <Field l="Site (optional)"><input style={field} value={entry.site} onChange={(e) => setEntry({ ...entry, site: e.target.value })} /></Field>
            <Field l="How you feel / effects (optional)"><textarea style={{ ...field, height: 80, padding: 10 }} value={entry.effects} onChange={(e) => setEntry({ ...entry, effects: e.target.value })} /></Field>
            <button className="mm-btn mm-btn--primary" style={{ height: 44 }} onClick={() => void log()}>Save to log</button>
          </div>
        </Sheet>
      )}
    </Page>
  );
}
