import { useState } from 'react';
import { useStickySpot } from '../../../data/useStickySpot';
import type { StickyRow, StickyStatus } from '../../../data/useStickySpot';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import type { ChipKind } from '../../mm/Chip';
import Stat from '../../mm/Stat';
import { Bars } from '../../mm/charts';
import { Empty } from '../../mm/States';
import { Page, Sheet, Field, field, useModule } from '../../mm/Page';
import { usd } from './util';

const STATUS: Record<StickyStatus, { l: string; k: ChipKind }> = { idea: { l: 'Idea', k: 'neutral' }, listed: { l: 'Listed', k: 'neutral' }, quoted: { l: 'Quoted', k: 'accent' }, booked: { l: 'Booked', k: 'good' }, done: { l: 'Done', k: 'good' } };
const ORDER: StickyStatus[] = ['idea', 'listed', 'quoted', 'booked', 'done'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function StickySpotV2() {
  const { device, novaOpen } = useModule();
  const phone = device === 'phone';
  const S = useStickySpot();
  const [adding, setAdding] = useState(false);
  const [edit, setEdit] = useState<StickyRow | null>(null);
  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  const done = S.rows.filter((r) => r.status === 'done');
  const live = S.rows.filter((r) => r.status !== 'done');
  const madeMonth = done.filter((r) => (r.done_at ?? '').slice(0, 7) === month);
  const sum = (a: StickyRow[]) => a.reduce((s, r) => s + (r.amount ?? 0), 0);
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const perMonth = months.map((m) => sum(done.filter((r) => (r.done_at ?? '').slice(0, 7) === m)));
  const biggest = [...live].sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))[0];

  const err = S.error && <div style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid color-mix(in srgb, var(--warning) 40%, var(--border))', background: 'color-mix(in srgb, var(--warning) 8%, var(--surface))', fontSize: 14, color: 'var(--text)' }}>{S.error}</div>;
  const sheets = <>{adding && <IdeaSheet onClose={() => setAdding(false)} save={async (v) => S.add(v)} />}{edit && <IdeaSheet row={edit} onClose={() => setEdit(null)} save={async (v) => { await S.update(edit.id, v); return true; }} remove={async () => { await S.remove(edit.id); setEdit(null); }} />}</>;

  if (!S.loading && S.rows.length === 0) {
    return <Page title="Sticky Spot" sub="Fast-cash plays: $500 to $1,000 in the same hour or day" fab={{ t: 'Idea', onClick: () => setAdding(true) }}>{err}<Empty text="No fast-cash ideas yet. Add one you could do today and track it to paid." cta="Add an idea" onCta={() => setAdding(true)} />{sheets}</Page>;
  }

  const list = (
    <Card title="Fast-cash list" meta={`${S.rows.length} ${S.rows.length === 1 ? 'idea' : 'ideas'}`} flush wide={!phone}>
      <div>{[...live, ...done].map((r, i) => (
        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: i ? '1px solid var(--grid)' : 'none' }}>
          <button onClick={() => setEdit(r)} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6, border: 0, background: 'transparent', padding: 0, textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer' }}>
            <span style={{ color: r.status === 'done' ? 'var(--text-secondary)' : 'var(--text)', fontSize: 15, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.text}</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}><Chip k={STATUS[r.status].k}>{STATUS[r.status].l}</Chip>{r.note && <span style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.note}</span>}</div>
          </button>
          <select aria-label={`Status for ${r.text}`} value={r.status} onChange={(e) => void S.update(r.id, { status: e.target.value as StickyStatus })} style={{ height: 34, padding: '0 6px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }}>
            {ORDER.map((s) => <option key={s} value={s}>{STATUS[s].l}</option>)}
          </select>
          <span style={{ width: 76, textAlign: 'right', color: r.status === 'done' ? 'var(--text-secondary)' : 'var(--text)', fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em' }}>{r.amount != null ? usd(r.amount) : '—'}</span>
        </div>
      ))}</div>
    </Card>
  );
  const bars = perMonth.some(Boolean) && <Card title="Side cash by month" meta="Last 6, paid out" wide={!phone}><Bars vals={perMonth} labels={months.map((m) => MON[Number(m.slice(5)) - 1])} /></Card>;

  return (
    <Page title="Sticky Spot" sub="Fast-cash plays: $500 to $1,000 in the same hour or day" fab={{ t: 'Idea', onClick: () => setAdding(true) }}>
      {err}
      {phone ? (
        <><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><Stat label="Made this month" value={usd(sum(madeMonth))} pill={`${madeMonth.length} done`} k={madeMonth.length ? 'good' : 'neutral'} /><Stat label="In play" value={usd(sum(live))} pill={`${live.length} ideas`} /></div>{list}{bars}</>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>
            <Stat label="Made this month" value={usd(sum(madeMonth))} pill={`${madeMonth.length} done`} k={madeMonth.length ? 'good' : 'neutral'} />
            <Stat label="In play" value={usd(sum(live))} pill={`${live.length} ${live.length === 1 ? 'idea' : 'ideas'}`} />
            <Stat label="Biggest open" value={biggest?.amount != null ? usd(biggest.amount) : '—'} pill={biggest?.text ?? 'None'} />
            <Stat label="Made all time" value={usd(sum(done))} pill={`${done.length} done`} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: device === 'desktop' && !novaOpen ? 'minmax(0,2fr) minmax(0,1fr)' : 'minmax(0,1fr)', gap: 16, alignItems: 'start' }}>{list}{bars}</div>
        </>
      )}
      {sheets}
    </Page>
  );
}

function IdeaSheet({ row, onClose, save, remove }: { row?: StickyRow; onClose: () => void; save: (v: { text: string; amount: number | null; note: string | null }) => Promise<boolean>; remove?: () => Promise<void> }) {
  const [text, setText] = useState(row?.text ?? '');
  const [amt, setAmt] = useState(row?.amount != null ? String(row.amount) : '');
  const [note, setNote] = useState(row?.note ?? '');
  const [busy, setBusy] = useState(false);
  const n = amt.trim() ? Number(amt.replace(/[$,\s]/g, '')) : null;
  return (
    <Sheet title={row ? 'Edit idea' : 'New idea'} onClose={onClose}>
      <Field l="The play"><input value={text} onChange={(e) => setText(e.target.value)} style={field} placeholder="Sell the old monitor" autoFocus /></Field>
      <Field l="What it should bring in"><input inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} style={field} placeholder="$120" /></Field>
      <Field l="Note (optional)"><input value={note} onChange={(e) => setNote(e.target.value)} style={field} placeholder="Marketplace, listed today" /></Field>
      <button className="mm-btn mm-btn--primary" style={{ height: 48, fontSize: 15 }} disabled={busy || !text.trim() || (n != null && !Number.isFinite(n))} onClick={async () => { setBusy(true); const ok = await save({ text: text.trim(), amount: n, note: note.trim() || null }); setBusy(false); if (ok) onClose(); }}>{busy ? 'Saving…' : 'Save'}</button>
      {remove && <button className="mm-btn" style={{ height: 44, color: 'var(--danger)' }} onClick={() => { if (window.confirm('Delete this idea?')) void remove(); }}>Delete</button>}
    </Sheet>
  );
}
