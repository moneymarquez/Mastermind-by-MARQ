import { useMemo, useState } from 'react';
import { useLeadflowLeads } from '../../../data/useLeadflow';
import type { LeadflowLead } from '../../../data/useLeadflow';
import { US_STATES, NICHES } from './shared';
import { LeadRecord } from './LeadCard';
import { hasOwnerContact } from './leadLinks';
import { ALL } from './leadFilters';
import { fmtPhone, fmtIndustry, leadCategory, fmtReviewAge, tagSignal, tagLabel } from './format';
import { Tag, TierMark, NotConnected, Banner, EmptyState, SkeletonRows, FilterButton, Lede } from './ui';
import { WithRecord, HeaderAction, SidePanel, useRecordMode } from './layout';

/** Where leads get researched before they're worth calling.
 *
 *  The morning job: filter to one city, open each lead, chase the owner's
 *  real name and direct line through the registry and people-search links,
 *  then push it to the pool. The record panel puts Owner first here,
 *  because that is the entire point of the screen.
 */

const TAGS = ['Hot', 'Warm', 'Not Ready'];
const COLS = '36px minmax(160px,1.6fr) minmax(90px,1fr) minmax(70px,.7fr) 128px 70px 100px 100px 80px 112px';
const BLANK = { business_name: '', phone: '', industry: NICHES[0], website_status: 'no_website', tag: 'Warm', state: '', city: '', pooled: false };

export default function LeadFlowFinder() {
  const { leads, industries, places, loading, hasMore, notConnected, error, fetchLeads, addLead, updateLead, logCall } = useLeadflowLeads();
  const sheet = useRecordMode() === 'sheet';
  const [industry, setIndustry] = useState(ALL);
  const [tag, setTag] = useState(ALL);
  const [state, setState] = useState(ALL);
  const [city, setCity] = useState(ALL);
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [addErr, setAddErr] = useState('');
  const [adding, setAdding] = useState(false);

  // States come from the cities endpoint, not the static 50: offering
  // Wyoming when every lead is in Utah is 49 ways to an empty screen.
  const states = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of places) if (p.state) counts.set(p.state, (counts.get(p.state) ?? 0) + p.count);
    return [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);
  }, [places]);
  const cities = useMemo(() => places.filter((p) => state === ALL || p.state === state)
    .map((p) => ({ value: p.city, label: state === ALL && p.state ? `${p.city}, ${p.state}` : p.city, count: p.count })), [places, state]);

  // Filtering is server-side: the finder pages 50 at a time, so narrowing
  // only the loaded page would find Draper leads by luck of paging.
  const applyFilters = (ind: string, tg: string, st: string, ct: string) => {
    setPage(0);
    setOpenId(null);
    fetchLeads(0, true, { industry: ind, tag: tg, state: st, city: ct });
  };
  const chooseState = (next: string) => {
    setState(next);
    // A city from the old state can't survive the switch.
    const stillValid = next === ALL || places.some((p) => p.state === next && p.city === city);
    const nextCity = stillValid ? city : ALL;
    setCity(nextCity);
    applyFilters(industry, tag, next, nextCity);
  };
  const clearAll = () => { setState(ALL); setCity(ALL); setIndustry(ALL); setTag(ALL); applyFilters(ALL, ALL, ALL, ALL); };
  const loadMore = () => { const next = page + 1; setPage(next); fetchLeads(next, false, { industry, tag, state, city }); };

  const doAddLead = async () => {
    if (!form.business_name.trim() || adding) return;
    setAdding(true);
    setAddErr('');
    const created = await addLead(form);
    setAdding(false);
    if (created) { setShowAdd(false); setForm(BLANK); } else setAddErr('Could not add the lead. Check the connection and try again.');
  };

  // Reads lead.pooled rather than a local list, so the button tells the
  // truth after a reload.
  const togglePool = (lead: LeadflowLead) => updateLead(lead.id, { pooled: !lead.pooled });
  const pooledCount = leads.filter((l) => l.pooled).length;
  const open = leads.find((l) => l.id === openId) ?? null;
  const filtersOn = state !== ALL || city !== ALL || industry !== ALL || tag !== ALL;

  const poolCell = (lead: LeadflowLead) => lead.pooled
    ? <Tag s="info">In pool</Tag>
    : <button className="lf-btn lf-btn--secondary lf-btn--xs" onClick={(e) => { e.stopPropagation(); void togglePool(lead); }}>Add to pool</button>;

  const row = (lead: LeadflowLead) => {
    const sel = openId === lead.id;
    const openIt = () => setOpenId(sel && !sheet ? null : lead.id);
    const tg = lead.tag ? <Tag s={tagSignal(lead.tag)}>{tagLabel(lead.tag)}</Tag> : null;
    if (sheet) {
      return (
        <div key={lead.id} role="button" tabIndex={0} className="lf-row" aria-selected={sel} onClick={openIt} onKeyDown={(e) => e.key === 'Enter' && openIt()}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 4, padding: 12, minHeight: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <TierMark tier={lead.tier} /><span className="lf-trunc" style={{ fontWeight: 500, flex: 1 }}>{lead.business_name}</span>{tg}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="lf-label lf-trunc">{[leadCategory(lead), lead.city].filter(Boolean).join(' · ')}{lead.phone && <> · <span className="lf-mono">{fmtPhone(lead.phone)}</span></>}</span>
            {poolCell(lead)}
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
        <span className="lf-mono" style={{ paddingLeft: 16, fontSize: 13, color: 'var(--lf-text-secondary)' }}>{fmtReviewAge(lead.days_since_last_review)}</span>
        <span>{tg}</span>
        <span>{hasOwnerContact(lead) ? <Tag s="info" title={lead.owner_phone ?? undefined}>On file</Tag> : <span className="lf-label" style={{ fontSize: 13 }}>None</span>}</span>
        <span>{poolCell(lead)}</span>
      </div>
    );
  };

  const panel = open && (
    <LeadRecord lead={open} onPatch={updateLead} onLogCall={logCall} onClose={() => setOpenId(null)} sheet={sheet} backLabel="Lead finder" ownerFirst
      poolAction={{ label: open.pooled ? 'Remove from pool' : 'Add to pool', onClick: () => void togglePool(open) }} />
  );

  const set = (k: keyof typeof BLANK) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  return (
    <WithRecord panel={panel}>
      <HeaderAction><button className="lf-btn lf-btn--primary" onClick={() => { setOpenId(null); setShowAdd(true); }}>Add lead</button></HeaderAction>
      {notConnected && <NotConnected />}
      {error && <Banner s="stop">{error}</Banner>}
      <Lede>Open a lead, track down the owner, then send it to the pool.{pooledCount > 0 && <> <span className="lf-mono">{pooledCount}</span> of these {leads.length} are already pooled.</>}</Lede>
      <div className="lf-panel" style={{ overflow: 'hidden' }}>
        <div className="lf-toolbar">
          <FilterButton label="City" value={city} allValue={ALL} allLabel="All cities" options={cities} onChange={(v) => { setCity(v); applyFilters(industry, tag, state, v); }} />
          <FilterButton label="State" value={state} allValue={ALL} allLabel="All states" options={states} onChange={chooseState} />
          <FilterButton label="Industry" value={industry} allValue={ALL} allLabel="All industries" options={industries.filter((i) => i !== ALL).map((i) => ({ value: i, label: fmtIndustry(i) }))} onChange={(v) => { setIndustry(v); applyFilters(v, tag, state, city); }} />
          <FilterButton label="Tag" value={tag} allValue={ALL} allLabel="All tags" options={TAGS.map((t) => ({ value: t, label: tagLabel(t) }))} onChange={(v) => { setTag(v); applyFilters(industry, v, state, city); }} />
          {filtersOn && <button className="lf-btn lf-btn--ghost" onClick={clearAll}>Clear</button>}
          <div style={{ flex: 1 }} />
          <span className="lf-mono" style={{ fontSize: 12, color: 'var(--lf-text-tertiary)' }}>{leads.length}{hasMore ? '+' : ''} result{leads.length === 1 ? '' : 's'}</span>
        </div>
        {loading && leads.length === 0 ? <SkeletonRows cols={COLS} />
          : leads.length === 0 ? (notConnected ? null : <EmptyState text="No leads match these filters." action={filtersOn ? 'Clear filters' : undefined} onAction={clearAll} />)
          : (
            <div style={{ overflowX: sheet ? 'visible' : 'auto' }}>
              <div style={{ minWidth: sheet ? 0 : 1060 }}>
                {!sheet && (
                  <div className="lf-thead" style={{ gridTemplateColumns: COLS }}>
                    <span>Tier</span><span>Business</span><span>Category</span><span>City</span><span>Phone</span><span style={{ textAlign: 'right' }}>Reviews</span>
                    <span style={{ paddingLeft: 16 }}>Last review</span><span>Tag</span><span>Owner</span><span>Pool</span>
                  </div>
                )}
                {leads.map(row)}
              </div>
            </div>
          )}
        {leads.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 44, padding: '0 12px', fontSize: 13, color: 'var(--lf-text-tertiary)' }}>
            <span className="lf-mono">Showing {leads.length}</span>
            {hasMore && <button className="lf-btn lf-btn--secondary lf-btn--sm" onClick={loadMore} disabled={loading}>{loading ? 'Loading…' : 'Load more'}</button>}
          </div>
        )}
      </div>

      {showAdd && (
        <SidePanel title="Add lead" onClose={() => setShowAdd(false)} footer={<>
          <button className="lf-btn lf-btn--secondary" onClick={() => setShowAdd(false)}>Cancel</button>
          <button className="lf-btn lf-btn--primary" onClick={doAddLead} disabled={!form.business_name.trim() || adding}>{adding ? 'Adding…' : 'Add lead'}</button>
        </>}>
          <Field label="Business name"><input className="lf-input" value={form.business_name} onChange={set('business_name')} autoFocus /></Field>
          <Field label="Phone"><input className="lf-input lf-mono" value={form.phone} onChange={set('phone')} inputMode="tel" placeholder="(801) 555-0142" /></Field>
          <Field label="City"><input className="lf-input" value={form.city} onChange={set('city')} /></Field>
          {/* War Room queues match industry exactly, so pick from the niche list. */}
          <Field label="Industry"><select className="lf-input" value={form.industry} onChange={set('industry')}>{NICHES.map((n) => <option key={n} value={n}>{fmtIndustry(n)}</option>)}</select></Field>
          <Field label="State"><select className="lf-input" value={form.state} onChange={set('state')}><option value="">Select state</option>{US_STATES.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Tag"><select className="lf-input" value={form.tag} onChange={set('tag')}>{TAGS.map((t) => <option key={t} value={t}>{tagLabel(t)}</option>)}</select></Field>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, color: 'var(--lf-text-secondary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.pooled} onChange={(e) => setForm({ ...form, pooled: e.target.checked })} style={{ width: 16, height: 16, accentColor: 'var(--lf-accent)' }} />
            Add straight to the lead pool
          </label>
          {addErr && <Banner s="stop">{addErr}</Banner>}
        </SidePanel>
      )}
    </WithRecord>
  );
}

function Field({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="lf-label">{label}</span>
      {children}
    </label>
  );
}
