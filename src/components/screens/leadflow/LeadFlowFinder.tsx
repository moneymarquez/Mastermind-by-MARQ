import { useEffect, useMemo, useState } from 'react';
import { useLeadflowLeads, findLeads, latestLeadJob, citySuggestions } from '../../../data/useLeadflow';
import type { LeadflowLead, FindLeadsResult } from '../../../data/useLeadflow';
import { US_STATES, NICHES } from './shared';
import { CITIES, PACKAGE_INDUSTRIES } from './findOptions';
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
// Suggestions only — any industry can be typed. Home services first: those
// owners run on few reviews and high tickets, and the score bands fit them.
const FIND_INDUSTRIES = [
  // Home services
  'HVAC', 'plumber', 'electrician', 'roofing', 'landscaping', 'lawn care', 'tree service', 'house cleaning', 'carpet cleaning', 'window cleaning',
  'pressure washing', 'handyman', 'painter', 'flooring', 'remodeling contractor', 'general contractor', 'concrete contractor', 'fencing', 'garage door repair',
  'pest control', 'pool service', 'junk removal', 'moving company', 'appliance repair', 'locksmith', 'solar installer', 'snow removal',
  // Auto
  'auto repair', 'auto detailing', 'auto body shop', 'tire shop', 'towing', 'mobile mechanic',
  // Food
  'restaurant', 'food truck', 'coffee shop', 'bakery', 'catering', 'pizza', 'taco shop', 'dessert shop',
  // Beauty and wellness
  'hair salon', 'barbershop', 'nail salon', 'med spa', 'lash studio', 'tattoo shop', 'massage therapist', 'day spa',
  // Health
  'dentist', 'orthodontist', 'chiropractor', 'physical therapy', 'optometrist', 'veterinarian',
  // Fitness
  'gym', 'yoga studio', 'pilates studio', 'martial arts', 'personal trainer', 'dance studio',
  // Professional
  'real estate agent', 'mortgage broker', 'insurance agency', 'law firm', 'accountant', 'financial advisor', 'photographer', 'wedding venue', 'event planner',
  // Local retail and family
  'retail boutique', 'florist', 'jewelry store', 'furniture store', 'daycare', 'tutoring', 'music lessons', 'pet grooming', 'dog trainer', 'storage facility',
].filter((v, i, a) => a.indexOf(v) === i);
// Each search is capped at $1 in Google fees (the Worker enforces it), which is about 30 lookups.
const FIND_COUNTS = [10, 20, 30];
const OTHER = '__other__';
const PACKAGE_SEARCHES = new Set(PACKAGE_INDUSTRIES.map((i) => i.search.toLowerCase()));
const MORE_INDUSTRIES = FIND_INDUSTRIES.filter((i) => !PACKAGE_SEARCHES.has(i.toLowerCase()) && i !== 'plumber');
const ALL_FIND_INDUSTRIES = [...PACKAGE_INDUSTRIES.map((i) => i.search), ...MORE_INDUSTRIES];
const STATE_ABBR: Record<string, string> = { Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA', Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', 'District of Columbia': 'DC', Florida: 'FL', Georgia: 'GA', Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA', Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS', Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT', Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY' };
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
  const [showFind, setShowFind] = useState(false);
  const [find, setFind] = useState({ city: 'Draper', state: 'UT', industry: 'HVAC', count: 20 });
  const [citySugg, setCitySugg] = useState<string[]>([]);
  const [resumable, setResumable] = useState<FindLeadsResult | null>(null);
  const [finding, setFinding] = useState(false);
  const [findErr, setFindErr] = useState('');
  const [found, setFound] = useState<FindLeadsResult | null>(null);

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

  // City suggestions as you type, for the chosen state.
  useEffect(() => {
    if (!showFind) return;
    const t = setTimeout(() => { citySuggestions(find.city, find.state).then(setCitySugg).catch(() => setCitySugg([])); }, 250);
    return () => clearTimeout(t);
  }, [find.city, find.state, showFind]);
  // A search that stopped part-way (closed the app, lost signal) can pick up where it left off.
  useEffect(() => {
    if (!showFind || finding) return;
    latestLeadJob().then((j) => setResumable(j && !j.done ? j : null)).catch(() => {});
  }, [showFind, finding]);

  const stateCities = CITIES[find.state] ?? [];
  const cityListed = stateCities.includes(find.city);
  const industryListed = ALL_FIND_INDUSTRIES.includes(find.industry);

  const doFind = async (resumeId?: string) => {
    if ((!resumeId && (!find.city.trim() || !find.industry.trim())) || finding) return;
    setFinding(true);
    setFindErr('');
    setFound(null);
    setResumable(null);
    try {
      const r = await findLeads(find.city.trim(), find.state, find.industry.trim(), find.count, setFound, resumeId);
      setFound(r);
      if (r.added.length) applyFilters(industry, tag, state, city);
    } catch (e) {
      setFindErr(e instanceof Error ? e.message : 'Lead search failed.');
    } finally {
      setFinding(false);
    }
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
        <span>{lead.phone ? (lead.status === 'do_not_contact' ? <span className="lf-mono" title="Do not contact" style={{ fontSize: 13, color: 'var(--lf-text-tertiary)', textDecoration: 'line-through' }}>{fmtPhone(lead.phone)}</span> : <a className="lf-mono" href={`tel:${lead.phone.replace(/[^\d+]/g, '')}`} onClick={(e) => e.stopPropagation()} style={{ fontSize: 13, color: 'var(--lf-text-secondary)' }}>{fmtPhone(lead.phone)}</a>) : <span className="lf-label">None</span>}</span>
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
      <HeaderAction>
        <button className="lf-btn lf-btn--secondary" onClick={() => { setOpenId(null); setShowAdd(true); }}>Add lead</button>
        <button className="lf-btn lf-btn--primary" onClick={() => { setOpenId(null); setFound(null); setFindErr(''); setShowFind(true); }}>Find leads</button>
      </HeaderAction>
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

      {showFind && (
        <SidePanel title="Find leads" onClose={() => setShowFind(false)} footer={<>
          <button className="lf-btn lf-btn--secondary" onClick={() => setShowFind(false)}>{found ? 'Done' : 'Cancel'}</button>
          <button className="lf-btn lf-btn--primary" onClick={() => doFind()} disabled={!find.city.trim() || !find.industry.trim() || finding}>{finding ? 'Searching…' : found ? 'Search again' : 'Find leads'}</button>
        </>}>
          {resumable && !finding && (
            <Banner s="wait" title="Unfinished search">
              “{resumable.query}”: looked up {resumable.processed} of {resumable.total}, {resumable.added.length} added so far.{' '}
              <button className="lf-btn lf-btn--secondary" style={{ marginTop: 6 }} onClick={() => doFind(resumable.jobId)}>Continue it</button>
            </Banner>
          )}
          <Field label="State"><select className="lf-input" value={find.state} onChange={(e) => setFind({ ...find, state: e.target.value, city: CITIES[e.target.value]?.[0] ?? '' })}>
            {US_STATES.map((n) => <option key={n} value={STATE_ABBR[n] ?? n}>{n}</option>)}
          </select></Field>
          <Field label="City"><select className="lf-input" value={cityListed ? find.city : OTHER} onChange={(e) => setFind({ ...find, city: e.target.value === OTHER ? '' : e.target.value })}>
            {stateCities.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value={OTHER}>Another city…</option>
          </select></Field>
          {!cityListed && (
            <>
              <input className="lf-input" value={find.city} onChange={(e) => setFind({ ...find, city: e.target.value })} placeholder="Type the city" autoFocus />
              {citySugg.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{citySugg.filter((c) => c !== find.city).map((c) => <button key={c} type="button" className="lf-btn lf-btn--secondary" style={{ minHeight: 32 }} onClick={() => setFind({ ...find, city: c })}>{c}</button>)}</div>}
            </>
          )}
          <Field label="Industry"><select className="lf-input" value={industryListed ? find.industry : OTHER} onChange={(e) => setFind({ ...find, industry: e.target.value === OTHER ? '' : e.target.value })}>
            <optgroup label="Made by packages">{PACKAGE_INDUSTRIES.map((i) => <option key={i.search} value={i.search}>{i.label}</option>)}</optgroup>
            <optgroup label="More industries">{MORE_INDUSTRIES.map((i) => <option key={i} value={i}>{i[0].toUpperCase() + i.slice(1)}</option>)}</optgroup>
            <option value={OTHER}>Something else…</option>
          </select></Field>
          {!industryListed && <input className="lf-input" value={find.industry} onChange={(e) => setFind({ ...find, industry: e.target.value })} placeholder="Type the industry" />}
          <Field label="How many to look up"><select className="lf-input" value={find.count} onChange={(e) => setFind({ ...find, count: Number(e.target.value) })}>{FIND_COUNTS.map((n) => <option key={n} value={n}>{n}</option>)}</select></Field>
          <span className="lf-label">Only businesses inside {find.city.trim() || 'the city'} itself are kept, not the whole county. Closed businesses, weak ratings and leads you already have are skipped; businesses with 3+ locations are kept but flagged so you can check if they're a franchise. Never more than $1 in Google fees per search.</span>
          {finding && (
            <Banner s="info" title={found ? `Looked up ${found.processed} of ${found.total}` : 'Searching Google…'}>
              {found ? `${found.added.length} added so far. Keep this panel open until it finishes; if it stops, Continue picks up where it left off.` : 'Finding every match inside the city lines.'}
              {found && found.total > 0 && <div style={{ height: 6, borderRadius: 3, background: 'var(--lf-line, #e5e5e5)', marginTop: 8, overflow: 'hidden' }}><div style={{ width: `${Math.round((found.processed / found.total) * 100)}%`, height: '100%', background: 'var(--lf-go, #2e7d32)' }} /></div>}
            </Banner>
          )}
          {findErr && <Banner s="stop">{findErr}</Banner>}
          {found && !finding && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Banner s={found.added.length ? 'go' : 'wait'} title={found.added.length ? `${found.added.length} new lead${found.added.length === 1 ? '' : 's'} added` : 'No new leads this time'}>
                {found.found} found for “{found.query}”. Skipped: {found.skipped.chain} national chains, {found.skipped.weak} weak fits, {found.skipped.existing} already in LeadFlow{found.skipped.outside ? `, ${found.skipped.outside} outside ${find.city.trim() || 'the city'}` : ''}
                {found.skipped.noPhone ? `, ${found.skipped.noPhone} with no phone` : ''}{found.skipped.doNotContact ? `, ${found.skipped.doNotContact} do-not-contact` : ''}{found.skipped.lookupFailed ? `, ${found.skipped.lookupFailed} lookups failed` : ''}. About ${found.estCostUsd.toFixed(2)}.
              </Banner>
              {found.warning && <Banner s="wait">{found.warning}</Banner>}
              {found.added.map((l) => (
                <button key={l.id} className="lf-row" style={{ display: 'flex', gap: 8, alignItems: 'center', textAlign: 'left', minHeight: 40 }} onClick={() => { setShowFind(false); setOpenId(l.id); }}>
                  <TierMark tier={l.tier} /><span className="lf-trunc" style={{ flex: 1, fontWeight: 500 }}>{l.business_name}</span>
                  <span className="lf-label">{l.city}</span><span className="lf-mono" style={{ fontSize: 13 }}>{l.fizzle_score}</span>
                </button>
              ))}
            </div>
          )}
        </SidePanel>
      )}

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
