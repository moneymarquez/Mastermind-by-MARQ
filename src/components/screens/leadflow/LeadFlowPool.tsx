import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useLeadflowPool } from '../../../data/useLeadflow';
import { GREEN } from './shared';
import NotConnectedBanner from './NotConnectedBanner';
import LeadCard from './LeadCard';
import { isTouched } from './leadLinks';
import { ALL, stateOptions, cityOptions, filterByGeo, reconcileCity, pickForDialing, availableForDialing } from './leadFilters';

/** The standing stock of researched leads.
 *
 *  Two jobs: keep hundreds of leads organised, and hand batches of them to
 *  Dialing. The geography filters are the organising principle — the way
 *  this actually gets worked is "this week I'm only calling Draper" — and
 *  the Send buttons draw today's call list straight out of whatever the
 *  filters are currently showing.
 */

const SEND_SIZES = [10, 20, 50, 100];

const selectStyle: CSSProperties = {
  padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid #e5e7eb',
  background: '#fff', color: '#374151', fontSize: 'var(--text-body)', fontWeight: 600,
};

export default function LeadFlowPool() {
  const { pool, loading, notConnected, removeFromPool, patchLead, logCall, sendToDialing } = useLeadflowPool();
  const [sortBy, setSortBy] = useState<'industry' | 'reviews' | 'score'>('score');
  const [openId, setOpenId] = useState<string | null>(null);
  const [state, setState] = useState(ALL);
  const [city, setCity] = useState(ALL);
  const [sending, setSending] = useState(0);
  const [sendResult, setSendResult] = useState('');

  const states = useMemo(() => stateOptions(pool), [pool]);
  const cities = useMemo(() => cityOptions(pool, state), [pool, state]);
  const filtered = useMemo(() => filterByGeo(pool, { state, city }), [pool, state, city]);

  // Changing state has to re-check the city: "Draper" is meaningless once
  // you've switched to Nevada, and leaving it set would show an empty list
  // with no visible reason.
  const chooseState = (next: string) => {
    setState(next);
    setCity((c) => reconcileCity(pool, next, c));
  };

  const sorted = [...filtered].sort((a, b) => {
    // Worked leads sink, always — ahead of whichever sort is selected — so
    // the top of the list is only ever leads nobody has touched yet.
    const at = isTouched(a) ? 1 : 0;
    const bt = isTouched(b) ? 1 : 0;
    if (at !== bt) return at - bt;
    if (sortBy === 'industry') return (a.industry || '').localeCompare(b.industry || '');
    if (sortBy === 'score') return (b.fizzle_score || 0) - (a.fizzle_score || 0);
    return (b.review_count || 0) - (a.review_count || 0);
  });

  const freshCount = filtered.filter((l) => !isTouched(l)).length;
  const sendable = availableForDialing(filtered);
  const where = [city !== ALL ? city : '', state !== ALL ? state : ''].filter(Boolean).join(', ') || 'all leads';

  const send = async (n: number) => {
    if (sending) return;
    const batch = pickForDialing(filtered, n);
    if (batch.length === 0) return;
    setSending(n);
    setSendResult('');
    try {
      await sendToDialing(batch);
      setSendResult(`Sent ${batch.length} ${where} lead${batch.length === 1 ? '' : 's'} to Dialing.`);
    } catch (e) {
      setSendResult(e instanceof Error ? e.message : 'Could not send to Dialing.');
    } finally {
      setSending(0);
    }
  };

  const sortBtn = (key: typeof sortBy, text: string) => (
    <button onClick={() => setSortBy(key)} style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid #e5e7eb', background: sortBy === key ? GREEN : '#fff', color: sortBy === key ? '#fff' : '#374151', cursor: 'pointer', fontWeight: 500 }}>{text}</button>
  );

  return (
    <div>
      {notConnected && <NotConnectedBanner />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: 4 }}>Lead Pool</h1>
          <p style={{ color: '#9ca3af', fontSize: 'var(--text-subhead)' }}>
            {freshCount} untouched · {filtered.length - freshCount} worked
            {filtered.length !== pool.length ? ` · ${pool.length} in the pool overall` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {sortBtn('score', 'By Score')}
          {sortBtn('industry', 'By Industry')}
          {sortBtn('reviews', 'By Reviews')}
        </div>
      </div>

      {/* Geography + the batch hand-off, together: the filters decide what
          "Send 50" means, so they belong in the same block as the buttons
          rather than somewhere further up the page. */}
      <div style={{ background: '#fff', border: '1px solid #f3f4f6', borderRadius: 'var(--radius-lg)', padding: '14px 16px', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--text-caption)', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>Working</span>
          <select value={state} onChange={(e) => chooseState(e.target.value)} style={selectStyle}>
            <option value={ALL}>All states ({pool.length})</option>
            {states.map((s) => <option key={s.value} value={s.value}>{s.value} ({s.count})</option>)}
          </select>
          <select value={city} onChange={(e) => setCity(e.target.value)} style={selectStyle}>
            <option value={ALL}>All cities</option>
            {cities.map((c) => <option key={c.value} value={c.value}>{c.value} ({c.count})</option>)}
          </select>
          {(state !== ALL || city !== ALL) && (
            <button onClick={() => { setState(ALL); setCity(ALL); }} style={{ ...selectStyle, cursor: 'pointer', color: '#9ca3af' }}>Clear</button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--text-body)', color: '#6b7280' }}>Send to Dialing:</span>
          {SEND_SIZES.map((n) => {
            // Disabled at zero rather than hidden — a greyed-out "Send 50"
            // next to "12 ready" says why, where a missing button doesn't.
            const off = sendable === 0 || !!sending;
            return (
              <button
                key={n}
                onClick={() => send(n)}
                disabled={off}
                style={{
                  padding: '8px 16px', borderRadius: 'var(--radius-pill)', border: 'none',
                  background: off ? '#e5e7eb' : GREEN, color: off ? '#9ca3af' : '#fff',
                  fontSize: 'var(--text-body)', fontWeight: 700, cursor: off ? 'default' : 'pointer',
                }}
              >
                {sending === n ? 'Sending…' : `Send ${n}`}
              </button>
            );
          })}
          <span style={{ fontSize: 'var(--text-caption)', color: '#9ca3af' }}>
            {sendable} untouched in {where}
            {sendable > 0 && sendable < SEND_SIZES[SEND_SIZES.length - 1] ? ' — a bigger batch just sends what is left' : ''}
          </span>
        </div>

        {sendResult && <div style={{ fontSize: 'var(--text-body)', color: sendResult.startsWith('Sent') ? '#16a34a' : '#ef4444' }}>{sendResult}</div>}
      </div>

      {loading ? (
        <p style={{ color: '#9ca3af' }}>Loading pool...</p>
      ) : pool.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 'var(--radius-2xl)', padding: '3rem', textAlign: 'center', border: '1px solid #f3f4f6' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🎯</div>
          <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Your pool is empty</h3>
          <p style={{ color: '#9ca3af' }}>Go to Lead Finder and click "+ Pool" on any lead to add them here.</p>
        </div>
      ) : sorted.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 'var(--radius-2xl)', padding: '2rem', textAlign: 'center', border: '1px solid #f3f4f6', color: '#9ca3af' }}>
          No leads in {where}.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              open={openId === lead.id}
              onToggle={() => setOpenId(openId === lead.id ? null : lead.id)}
              onPatch={patchLead}
              onLogCall={logCall}
              actions={
                <button onClick={() => removeFromPool(lead.id)} style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid #fee2e2', background: '#fff', color: '#ef4444', cursor: 'pointer', fontSize: 'var(--text-body)', fontWeight: 500 }}>Remove</button>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
