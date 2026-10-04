import { useEffect, useMemo, useState } from 'react';
import { useLeadflowPool } from '../../../data/useLeadflow';
import type { LeadflowLead } from '../../../data/useLeadflow';
import { LeadRecord } from './LeadCard';
import { isTouched, hasOwnerContact } from './leadLinks';
import { ALL, stateOptions, cityOptions, filterByGeo, reconcileCity, pickForDialing, availableForDialing } from './leadFilters';
import { fmtPhone, leadCategory, statusOf } from './format';
import { Tag, TierMark, KpiStrip, Banner, NotConnected, EmptyState, SkeletonRows, FilterButton, Segmented, MoreMenu } from './ui';
import { WithRecord, useRecordMode } from './layout';

/** The standing stock of researched leads.
 *
 *  Two jobs: keep hundreds of leads organised, and hand batches of them to
 *  Dialing. Geography is the organising principle ("this week I'm only
 *  calling Draper"), and Send to dialing draws today's call list straight
 *  out of whatever the filters are showing.
 */

const SEND_SIZES = [10, 20, 50, 100] as const;
const PAGE = 50;
const COLS = '36px minmax(160px,1.6fr) minmax(90px,1fr) minmax(70px,.7fr) 128px 70px 60px 190px 80px 36px';
type Sort = 'score' | 'industry' | 'reviews';

export default function LeadFlowPool() {
  const { pool, loading, notConnected, removeFromPool, patchLead, logCall, sendToDialing } = useLeadflowPool();
  const mode = useRecordMode();
  const sheet = mode === 'sheet';
  const [sortBy, setSortBy] = useState<Sort>('score');
  const [openId, setOpenId] = useState<string | null>(null);
  const [state, setState] = useState(ALL);
  const [city, setCity] = useState(ALL);
  const [q, setQ] = useState('');
  const [size, setSize] = useState<(typeof SEND_SIZES)[number]>(20);
  const [shown, setShown] = useState(PAGE);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; text: string } | null>(null);

  const states = useMemo(() => stateOptions(pool), [pool]);
  const cities = useMemo(() => cityOptions(pool, state), [pool, state]);
  const filtered = useMemo(() => filterByGeo(pool, { state, city }), [pool, state, city]);
  const searched = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return filtered;
    const digits = t.replace(/\D/g, '');
    return filtered.filter((l) => l.business_name.toLowerCase().includes(t) || leadCategory(l).toLowerCase().includes(t) || (digits.length >= 3 && (l.phone ?? '').replace(/\D/g, '').includes(digits)));
  }, [filtered, q]);
  useEffect(() => { setShown(PAGE); }, [state, city, q, sortBy]);

  // Changing state re-checks the city: "Draper" means nothing in Nevada, and
  // leaving it set would show an empty list with no visible reason.
  const chooseState = (next: string) => { setState(next); setCity((c) => reconcileCity(pool, next, c)); };

  const sorted = useMemo(() => [...searched].sort((a, b) => {
    // Worked leads sink, always, ahead of whichever sort is chosen.
    const at = isTouched(a) ? 1 : 0, bt = isTouched(b) ? 1 : 0;
    if (at !== bt) return at - bt;
    if (sortBy === 'industry') return (a.industry || '').localeCompare(b.industry || '');
    if (sortBy === 'score') return (b.fizzle_score || 0) - (a.fizzle_score || 0);
    return (b.review_count || 0) - (a.review_count || 0);
  }), [searched, sortBy]);

  const freshCount = filtered.filter((l) => !isTouched(l)).length;
  const sendable = availableForDialing(filtered);
  const where = [city !== ALL ? city : '', state !== ALL ? state : ''].filter(Boolean).join(', ') || 'the pool';
  const page = sorted.slice(0, shown);
  const firstWorked = page.findIndex((l) => isTouched(l));
  const workedTotal = sorted.filter((l) => isTouched(l)).length;
  const open = pool.find((l) => l.id === openId) ?? null;

  const send = async () => {
    if (sending) return;
    const batch = pickForDialing(filtered, size);
    if (batch.length === 0) return;
    setSending(true);
    setSendResult(null);
    try {
      await sendToDialing(batch);
      setSendResult({ ok: true, text: `Sent ${batch.length} ${where === 'the pool' ? '' : `${where} `}lead${batch.length === 1 ? '' : 's'} to Dialing.${batch.length < size ? ' A bigger batch just sends what is left.' : ''}` });
    } catch (e) {
      setSendResult({ ok: false, text: e instanceof Error ? e.message : 'Could not send to Dialing.' });
    } finally {
      setSending(false);
    }
  };

  const helper = sendable === 0
    ? `Nothing untouched left in ${where}. Pick another city or add leads from the lead finder.`
    : `${sendable} untouched in ${where}.${sendable < size ? ' A bigger batch just sends what is left.' : ''}`;

  const sortHead = (key: Sort, label: string, right?: boolean) => (
    <button data-on={sortBy === key || undefined} onClick={() => setSortBy(key)} style={{ justifyContent: right ? 'flex-end' : undefined, width: right ? '100%' : undefined }} aria-label={`Sort by ${label}`}>
      {label} <span aria-hidden="true">{sortBy === key ? '↓' : '↑↓'}</span>
    </button>
  );

  const row = (lead: LeadflowLead) => {
    const st = statusOf(lead);
    const sel = openId === lead.id;
    const openIt = () => setOpenId(sel && !sheet ? null : lead.id);
    if (sheet) {
      return (
        <div key={lead.id} role="button" tabIndex={0} className="lf-row" aria-selected={sel} onClick={openIt} onKeyDown={(e) => e.key === 'Enter' && openIt()}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 4, padding: 12, minHeight: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <TierMark tier={lead.tier} />
            <span className="lf-trunc" style={{ fontWeight: 500, flex: 1 }}>{lead.business_name}</span>
            <Tag s={st.s}>{st.short}</Tag>
          </div>
          <div className="lf-label lf-trunc">
            {[leadCategory(lead), lead.city].filter(Boolean).join(' · ')}
            {lead.phone && <> · <span className="lf-mono">{fmtPhone(lead.phone)}</span></>}
            {lead.fizzle_score != null && <> · score <span className="lf-mono">{lead.fizzle_score}</span></>}
          </div>
        </div>
      );
    }
    return (
      <div key={lead.id} role="button" tabIndex={0} className="lf-row" aria-selected={sel} onClick={openIt} onKeyDown={(e) => e.key === 'Enter' && openIt()} style={{ gridTemplateColumns: COLS }}>
        <TierMark tier={lead.tier} />
        <span className="lf-trunc" style={{ fontWeight: 500, paddingRight: 8 }} title={lead.business_name}>{lead.business_name}</span>
        <span className="lf-cell-2 lf-trunc">{leadCategory(lead)}</span>
        <span className="lf-cell-2 lf-trunc">{lead.city}</span>
        <span>{lead.phone ? <a className="lf-mono" href={`tel:${lead.phone.replace(/[^\d+]/g, '')}`} onClick={(e) => e.stopPropagation()} style={{ fontSize: 13, color: 'var(--lf-text-secondary)' }}>{fmtPhone(lead.phone)}</a> : <span className="lf-label">None</span>}</span>
        <span className="lf-num">{lead.review_count ?? ''}</span>
        <span className="lf-num" style={{ fontWeight: 500 }}>{lead.fizzle_score ?? ''}</span>
        <span style={{ paddingLeft: 16 }}><Tag s={st.s}>{st.label}</Tag></span>
        <span>{hasOwnerContact(lead) ? <Tag s="info" title={lead.owner_phone ?? undefined}>On file</Tag> : <span className="lf-label" style={{ fontSize: 13 }}>None</span>}</span>
        <span style={{ display: 'flex', justifyContent: 'center' }}>
          <MoreMenu label={`Actions for ${lead.business_name}`} buttonClass="lf-btn lf-btn--ghost lf-btn--xs" items={[
            { label: 'Open record', onClick: () => setOpenId(lead.id) },
            { label: 'Remove from pool', danger: true, onClick: () => { if (openId === lead.id) setOpenId(null); void removeFromPool(lead.id); } },
          ]} />
        </span>
      </div>
    );
  };

  const toolbar = (
    <>
      <div className="lf-toolbar">
        <input className="lf-input lf-input--search" placeholder="Search pool" aria-label="Search pool" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: sheet ? '100%' : 200 }} />
        <FilterButton label="City" value={city} allValue={ALL} allLabel="All cities" options={cities} onChange={setCity} />
        {states.length > 0 && <FilterButton label="State" value={state} allValue={ALL} allLabel={`All states (${pool.length})`} options={states} onChange={chooseState} />}
        {(state !== ALL || city !== ALL || q) && <button className="lf-btn lf-btn--ghost" onClick={() => { setState(ALL); setCity(ALL); setQ(''); }}>Clear</button>}
        <div style={{ flex: 1 }} />
        <FilterButton label="Sort" value={sortBy} allValue={'score' as Sort} allLabel="Score" options={[{ value: 'industry' as Sort, label: 'Industry' }, { value: 'reviews' as Sort, label: 'Reviews' }]} onChange={setSortBy} />
        <span className="lf-mono" style={{ fontSize: 12, color: 'var(--lf-text-tertiary)' }}>{searched.length} result{searched.length === 1 ? '' : 's'}</span>
        <Segmented label="Batch size" value={size} onChange={setSize} options={SEND_SIZES.map((n) => ({ value: n, label: <span className="lf-mono">{n}</span> }))} />
        <button className="lf-btn lf-btn--primary" onClick={send} disabled={sendable === 0 || sending} title={sendable === 0 ? helper : undefined}>
          {sending ? 'Sending…' : sheet ? `Send ${Math.min(size, sendable)}` : 'Send to dialing'}
        </button>
      </div>
      <div style={{ padding: '6px 12px', fontSize: 12, color: 'var(--lf-text-tertiary)', borderBottom: '1px solid var(--lf-border)', background: 'var(--lf-surface-2)' }}>{helper}</div>
    </>
  );

  const panel = open && (
    <LeadRecord lead={open} onPatch={patchLead} onLogCall={logCall} onClose={() => setOpenId(null)} sheet={sheet} backLabel="Lead pool"
      poolAction={{ label: 'Remove from pool', onClick: () => { setOpenId(null); void removeFromPool(open.id); } }} />
  );

  return (
    <WithRecord panel={panel}>
      {notConnected && <NotConnected />}
      <KpiStrip compact={sheet} items={[
        { label: 'Untouched', value: freshCount, s: 'go' },
        { label: 'Worked', value: filtered.length - freshCount, s: 'info' },
        { label: sheet ? 'In pool' : 'In the pool overall', value: pool.length },
      ]} />
      {sendResult && <Banner s={sendResult.ok ? 'go' : 'stop'}>{sendResult.text}</Banner>}
      <div className="lf-panel" style={{ overflow: 'hidden' }}>
        {toolbar}
        {loading ? <SkeletonRows cols={COLS} />
          : pool.length === 0 ? <EmptyState text="Your pool is empty. Open a lead in the lead finder and add it to the pool." />
          : sorted.length === 0 ? <EmptyState text={q ? `Nothing in ${where} matches “${q}”.` : `No leads in ${where}.`} action="Clear filters" onAction={() => { setState(ALL); setCity(ALL); setQ(''); }} />
          : (
            <div style={{ overflowX: sheet ? 'visible' : 'auto' }}>
              <div style={{ minWidth: sheet ? 0 : 1000 }}>
                {!sheet && (
                  <div className="lf-thead" style={{ gridTemplateColumns: COLS }}>
                    <span>Tier</span><span>Business</span>{sortHead('industry', 'Category')}<span>City</span><span>Phone</span>
                    {sortHead('reviews', 'Reviews', true)}{sortHead('score', 'Score', true)}<span style={{ paddingLeft: 16 }}>Status</span><span>Owner</span><span />
                  </div>
                )}
                {page.map((l, i) => (
                  <div key={l.id} style={{ display: 'contents' }}>
                    {i === firstWorked && <div className="lf-group">Worked · <span className="lf-mono" style={{ marginLeft: 4 }}>{workedTotal}</span></div>}
                    {row(l)}
                  </div>
                ))}
              </div>
            </div>
          )}
        {!loading && sorted.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 44, padding: '0 12px', fontSize: 13, color: 'var(--lf-text-tertiary)' }}>
            <span className="lf-mono">Showing {page.length} of {sorted.length}</span>
            {shown < sorted.length && <button className="lf-btn lf-btn--secondary lf-btn--sm" onClick={() => setShown((n) => n + PAGE)}>Load more</button>}
          </div>
        )}
      </div>
    </WithRecord>
  );
}
