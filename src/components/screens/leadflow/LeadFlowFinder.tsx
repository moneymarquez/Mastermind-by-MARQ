import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useLeadflowLeads } from '../../../data/useLeadflow';
import type { LeadflowLead } from '../../../data/useLeadflow';
import { GREEN, US_STATES, NICHES } from './shared';
import NotConnectedBanner from './NotConnectedBanner';
import LeadCard from './LeadCard';
import { ALL } from './leadFilters';

/** Where leads get researched before they're worth calling.
 *
 *  The morning job this is built for: filter down to one city, open each
 *  lead, chase the owner's real name and direct line through the registry
 *  and people-search links, then push it to the pool. So the card here is
 *  the same full card the pool and Dialing use — the owner fields are the
 *  entire point of the screen, not a detail view of it.
 */

const TAGS = ['Hot', 'Warm', 'Not Ready'];

const selectStyle: CSSProperties = {
  padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid #e5e7eb',
  background: '#fff', color: '#374151', fontSize: 'var(--text-body)', fontWeight: 600,
};
const modalInput: CSSProperties = {
  width: '100%', padding: 10, borderRadius: 'var(--radius-sm)', border: '1px solid #e5e7eb',
  marginBottom: 10, boxSizing: 'border-box',
};

export default function LeadFlowFinder() {
  const { leads, industries, places, loading, hasMore, notConnected, error, fetchLeads, addLead, updateLead, logCall } = useLeadflowLeads();
  const [industry, setIndustry] = useState(ALL);
  const [tag, setTag] = useState(ALL);
  const [state, setState] = useState(ALL);
  const [city, setCity] = useState(ALL);
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ business_name: '', phone: '', industry: NICHES[0], website_status: 'no_website', tag: 'Warm', state: '', city: '', pooled: false });

  // The state list comes from the cities endpoint rather than the static
  // 50-state list: offering Wyoming when every lead is in Utah just means
  // 49 ways to get an empty screen.
  const states = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of places) if (p.state) counts.set(p.state, (counts.get(p.state) ?? 0) + p.count);
    return [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);
  }, [places]);

  const cities = useMemo(
    () => places.filter((p) => state === ALL || p.state === state),
    [places, state],
  );

  // Filtering is server-side — the finder pages 50 at a time, so narrowing
  // only the loaded page would find Draper leads solely by luck of paging.
  const applyFilters = (ind: string, tg: string, st: string, ct: string) => {
    setPage(0);
    setOpenId(null);
    fetchLeads(0, true, { industry: ind, tag: tg, state: st, city: ct });
  };

  const chooseState = (next: string) => {
    setState(next);
    // A city from the old state can't survive the switch, or the list goes
    // empty with nothing on screen explaining why.
    const stillValid = next === ALL || places.some((p) => p.state === next && p.city === city);
    const nextCity = stillValid ? city : ALL;
    setCity(nextCity);
    applyFilters(industry, tag, next, nextCity);
  };

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchLeads(next, false, { industry, tag, state, city });
  };

  const doAddLead = async () => {
    const created = await addLead(form);
    if (created) {
      setShowAdd(false);
      setForm({ business_name: '', phone: '', industry: NICHES[0], website_status: 'no_website', tag: 'Warm', state: '', city: '', pooled: false });
    }
  };

  // Reads lead.pooled rather than a separate local list, so the button
  // tells the truth after a reload instead of resetting to "not pooled"
  // for leads that are already in there.
  const togglePool = (lead: LeadflowLead) => updateLead(lead.id, { pooled: !lead.pooled });

  const pooledCount = leads.filter((l) => l.pooled).length;

  return (
    <div>
      {notConnected && <NotConnectedBanner />}
      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 'var(--radius-md)', padding: '10px 16px', marginBottom: '1rem', fontSize: 'var(--text-body)' }}>{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700 }}>Lead Finder</h1>
          <p style={{ color: '#6b7280' }}>
            Open a lead, track down the owner, then send it to the pool.
            {pooledCount > 0 ? ` ${pooledCount} of these ${leads.length} are already pooled.` : ''}
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '10px 18px', cursor: 'pointer', fontWeight: 600 }}>+ Add Lead</button>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={state} onChange={(e) => chooseState(e.target.value)} style={selectStyle}>
          <option value={ALL}>All states</option>
          {states.map((s) => <option key={s.value} value={s.value}>{s.value} ({s.count})</option>)}
        </select>
        <select value={city} onChange={(e) => { setCity(e.target.value); applyFilters(industry, tag, state, e.target.value); }} style={selectStyle}>
          <option value={ALL}>All cities</option>
          {cities.map((c) => <option key={`${c.state}|${c.city}`} value={c.city}>{c.city}{state === ALL && c.state ? `, ${c.state}` : ''} ({c.count})</option>)}
        </select>
        <select value={industry} onChange={(e) => { setIndustry(e.target.value); applyFilters(e.target.value, tag, state, city); }} style={selectStyle}>
          {industries.map((i) => <option key={i}>{i}</option>)}
        </select>
        <select value={tag} onChange={(e) => { setTag(e.target.value); applyFilters(industry, e.target.value, state, city); }} style={selectStyle}>
          <option>{ALL}</option>
          {TAGS.map((t) => <option key={t}>{t}</option>)}
        </select>
        {(state !== ALL || city !== ALL || industry !== ALL || tag !== ALL) && (
          <button
            onClick={() => { setState(ALL); setCity(ALL); setIndustry(ALL); setTag(ALL); applyFilters(ALL, ALL, ALL, ALL); }}
            style={{ ...selectStyle, cursor: 'pointer', color: '#9ca3af' }}
          >
            Clear
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            open={openId === lead.id}
            onToggle={() => setOpenId(openId === lead.id ? null : lead.id)}
            onPatch={updateLead}
            onLogCall={logCall}
            actions={
              <button
                onClick={() => togglePool(lead)}
                style={{
                  padding: '6px 14px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  border: `1px solid ${lead.pooled ? GREEN : '#e5e7eb'}`,
                  background: lead.pooled ? GREEN : '#fff',
                  color: lead.pooled ? '#fff' : '#374151',
                  fontSize: 'var(--text-body)', fontWeight: 600,
                }}
              >
                {lead.pooled ? '✓ In Pool' : '+ Pool'}
              </button>
            }
          />
        ))}
      </div>

      {leads.length === 0 && !loading && !notConnected && <p style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem' }}>No leads match these filters.</p>}

      {hasMore && leads.length > 0 && (
        <button onClick={loadMore} disabled={loading} style={{ width: '100%', marginTop: 10, background: '#f3f4f6', border: 'none', borderRadius: 'var(--radius-sm)', padding: 12, cursor: 'pointer', fontWeight: 600, color: '#374151' }}>
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: '#fff', borderRadius: 'var(--radius-2xl)', padding: '2rem', width: 360, maxWidth: '95vw' }}>
            <h3 style={{ marginBottom: '1rem' }}>Add Lead</h3>
            <input placeholder="Business name" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} style={modalInput} />
            <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={modalInput} />
            <input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} style={modalInput} />
            <select value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} style={{ ...modalInput, padding: 10 }}>
              {NICHES.map((n) => <option key={n} value={n}>{n.charAt(0).toUpperCase() + n.slice(1)}</option>)}
            </select>
            <select value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} style={{ ...modalInput, padding: 10 }}>
              <option value="">Select State</option>
              {US_STATES.map((s) => <option key={s}>{s}</option>)}
            </select>
            <select value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} style={{ ...modalInput, padding: 10 }}>
              {TAGS.map((t) => <option key={t}>{t}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-body)', color: '#374151', marginBottom: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.pooled} onChange={(e) => setForm({ ...form, pooled: e.target.checked })} />
              Add straight to the Lead Pool
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={doAddLead} style={{ flex: 1, background: GREEN, color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: 10, cursor: 'pointer', fontWeight: 600 }}>Save</button>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, background: '#f3f4f6', border: 'none', borderRadius: 'var(--radius-sm)', padding: 10, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
