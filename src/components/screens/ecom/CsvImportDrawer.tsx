import { useMemo, useState } from 'react';
import type { Channel } from '../../../data/ecom';
import { CHANNELS, money } from '../../../data/ecom';
import { CSV_TEMPLATE, importProducts } from '../../../data/ecomProducts';
import type { ImportRow } from '../../../data/ecomProducts';
import { Drawer, E, Badge, ConfidenceBadge, btn, field, label } from './ecomShared';

interface Props {
  open: boolean;
  channel: Channel;
  onClose: () => void;
  onImport: (rows: ImportRow[], source: string) => Promise<{ inserted: number; updated: number }>;
}

/** §5 "CSV import — paste data from any tool". Headers are matched
 *  loosely (price, cost, image, link… all work), unknown columns are
 *  named, every row is previewed before it lands. */
export default function CsvImportDrawer({ open, channel, onClose, onImport }: Props) {
  const [text, setText] = useState('');
  const [source, setSource] = useState('');
  const [chan, setChan] = useState<Channel>(channel);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ inserted: number; updated: number } | null>(null);
  const today = new Date().toISOString();
  const parsed = useMemo(() => (text.trim() ? importProducts(text, chan, today) : null), [text, chan, today]);

  const download = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'product-sheet-template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Drawer open={open} onClose={onClose} title="Import products (CSV)" subtitle="Paste from any tool. Same product + channel on a later day adds a rank snapshot instead of a duplicate." width={640}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={label}>Default channel</div>
        <select style={{ ...field, width: 'auto' }} value={chan} onChange={(e) => setChan(e.target.value as Channel)}>
          {CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <button style={btn('ghost')} onClick={download}>Download template</button>
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={{ ...label, marginBottom: 4 }}>Where this came from</div>
        <input style={field} value={source} placeholder="e.g. TikTok Creative Center, 26 Sep · FastMoss export · my own notes" onChange={(e) => setSource(e.target.value)} />
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={{ ...label, marginBottom: 4 }}>CSV</div>
        <textarea style={{ ...field, minHeight: 160, fontFamily: 'var(--font-mono)', fontSize: 12, resize: 'vertical' }} value={text} placeholder={'name,category,rank,sell_price,supplier_cost,ship_cost,days_trending,velocity,score,content_difficulty,image_url,source_url,confidence\n…'} onChange={(e) => { setText(e.target.value); setResult(null); }} />
        <input type="file" accept=".csv,text/csv" style={{ marginTop: 8, fontSize: 12 }} onChange={(e) => { const f = e.target.files?.[0]; if (f) f.text().then(setText); }} />
      </div>

      {parsed && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Badge color={parsed.rows.length ? E.green : E.amber}>{parsed.rows.length} product{parsed.rows.length === 1 ? '' : 's'} ready</Badge>
            {parsed.unknownColumns.length > 0 && <Badge color={E.amber}>Ignored columns: {parsed.unknownColumns.join(', ')}</Badge>}
          </div>
          {parsed.problems.map((p, i) => <div key={i} style={{ fontSize: 'var(--text-caption)', color: E.amber, marginTop: 4 }}>{p}</div>)}
          <div style={{ ...E.card, marginTop: 10, overflow: 'auto', maxHeight: 280 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
              <thead><tr style={{ background: '#f9fafb' }}>{['#', 'Name', 'Channel', 'Price', 'Landed', 'Margin', 'Trend', 'Conf.'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: E.faint, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
              <tbody>
                {parsed.rows.slice(0, 60).map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '6px 8px', fontFamily: 'var(--font-mono)' }}>{r.rank ?? '—'}</td>
                    <td style={{ padding: '6px 8px', color: E.text, fontWeight: 600 }}>{r.name}</td>
                    <td style={{ padding: '6px 8px' }}>{CHANNELS.find((c) => c.id === r.channel)?.short}</td>
                    <td style={{ padding: '6px 8px', fontFamily: 'var(--font-mono)' }}>{money(r.sell_price)}</td>
                    <td style={{ padding: '6px 8px', fontFamily: 'var(--font-mono)' }}>{money(r.landed_cost)}</td>
                    <td style={{ padding: '6px 8px', fontFamily: 'var(--font-mono)', color: r.margin_pct != null && r.sell_price != null && r.landed_cost != null && r.sell_price >= r.landed_cost * 3 ? E.green : E.text }}>{r.margin_pct != null ? `${r.margin_pct.toFixed(0)}%` : '—'}</td>
                    <td style={{ padding: '6px 8px' }}>{r.velocity ?? '—'}</td>
                    <td style={{ padding: '6px 8px' }}><ConfidenceBadge c={r.confidence} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result && <div style={{ marginTop: 12, fontSize: 'var(--text-body)', color: E.green, fontWeight: 600 }}>Imported: {result.inserted} new, {result.updated} refreshed with a new snapshot.</div>}

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button style={{ ...btn('primary'), opacity: parsed?.rows.length && !busy ? 1 : 0.6 }} disabled={!parsed?.rows.length || busy} onClick={async () => { if (!parsed) return; setBusy(true); const r = await onImport(parsed.rows, source.trim() || 'csv'); setResult(r); setBusy(false); setText(''); }}>{busy ? 'Importing…' : `Import ${parsed?.rows.length ?? 0}`}</button>
        <button style={btn('ghost')} onClick={onClose}>{result ? 'Done' : 'Cancel'}</button>
      </div>
      <div style={{ fontSize: 'var(--text-caption)', color: E.faint, marginTop: 12, lineHeight: 1.5 }}>
        Rules that hold everywhere in this module: no bulk scraping of any site, never scrape Instagram, TikTok or Facebook. Paste what a tool gives you, or what you read off public pages by hand, and mark the confidence honestly.
      </div>
    </Drawer>
  );
}
