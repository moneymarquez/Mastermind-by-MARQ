import { useState } from 'react';
import { useLeadflowLeads } from '../../../data/useLeadflow';
import type { LeadflowLead } from '../../../data/useLeadflow';
import { GREEN, TAG_COLORS, US_STATES, NICHES } from './shared';
import NotConnectedBanner from './NotConnectedBanner';

const TAGS = ['Hot', 'Warm', 'Not Ready'];

export default function LeadFlowFinder() {
  const { leads, industries, loading, hasMore, notConnected, error, fetchLeads, addLead, updateLead } = useLeadflowLeads();
  const [industry, setIndustry] = useState('All');
  const [tag, setTag] = useState('All');
  const [state, setState] = useState('All');
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ business_name: '', phone: '', industry: NICHES[0], website_status: 'no_website', tag: 'Warm', state: '', pooled: false });
  const [pool, setPool] = useState<LeadflowLead[]>([]);
  const [poolMode, setPoolMode] = useState(false);
  const [poolIndex, setPoolIndex] = useState(0);

  const applyFilters = (ind: string, tg: string, st: string) => {
    setPage(0);
    fetchLeads(0, true, { industry: ind, tag: tg, state: st });
  };

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchLeads(next, false, { industry, tag, state });
  };

  const doAddLead = async () => {
    const created = await addLead(form);
    if (created) {
      setShowAdd(false);
      setForm({ business_name: '', phone: '', industry: NICHES[0], website_status: 'no_website', tag: 'Warm', state: '', pooled: false });
      if (form.pooled) setPool((prev) => [...prev, created]);
    }
  };

  const updateTag = async (id: number, newTag: string) => {
    await updateLead(id, { tag: newTag });
  };

  const togglePool = async (lead: LeadflowLead) => {
    const inPool = pool.find((p) => p.id === lead.id);
    await updateLead(lead.id, { pooled: !inPool });
    setPool(inPool ? pool.filter((p) => p.id !== lead.id) : [...pool, lead]);
  };

  const currentPoolLead = pool[poolIndex];

  return (
    <div>
      {notConnected && <NotConnectedBanner />}
      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 10, padding: '10px 16px', marginBottom: '1rem', fontSize: 13 }}>{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700 }}>Lead Finder</h1>
          <p style={{ color: '#6b7280' }}>Leads stored live from your LeadFlow database.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {pool.length > 0 && (
            <button onClick={() => { setPoolMode(true); setPoolIndex(0); }} style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', cursor: 'pointer', fontWeight: 600 }}>
              Call Pool ({pool.length})
            </button>
          )}
          <button onClick={() => setShowAdd(true)} style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', cursor: 'pointer', fontWeight: 600 }}>+ Add Lead</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <select value={industry} onChange={(e) => { setIndustry(e.target.value); applyFilters(e.target.value, tag, state); }} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb' }}>
          {industries.map((i) => <option key={i}>{i}</option>)}
        </select>
        <select value={tag} onChange={(e) => { setTag(e.target.value); applyFilters(industry, e.target.value, state); }} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb' }}>
          <option>All</option>
          {TAGS.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select value={state} onChange={(e) => { setState(e.target.value); applyFilters(industry, tag, e.target.value); }} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb' }}>
          <option>All</option>
          {US_STATES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {leads.map((lead) => (
        <div key={lead.id} style={{ background: '#fff', borderRadius: 10, padding: '1rem 1.25rem', marginBottom: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <strong>{lead.business_name}</strong>
              {lead.tag && <span style={{ marginLeft: 10, background: TAG_COLORS[lead.tag] + '22', color: TAG_COLORS[lead.tag], borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>{lead.tag}</span>}
              {lead.state && <span style={{ marginLeft: 8, background: '#e0e7ff', color: '#3730a3', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>{lead.state}</span>}
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                📞 {lead.phone || '–'} · {lead.industry || '–'} · {lead.website_status || '–'}
              </div>
              {lead.phone && <a href={`tel:${lead.phone}`} style={{ fontSize: 13, color: GREEN, fontWeight: 600, textDecoration: 'none' }}>📲 Call Now</a>}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => togglePool(lead)} style={{ background: pool.find((p) => p.id === lead.id) ? '#7c3aed' : '#f3f4f6', color: pool.find((p) => p.id === lead.id) ? '#fff' : '#374151', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                {pool.find((p) => p.id === lead.id) ? '✓ In Pool' : '+ Pool'}
              </button>
              <button onClick={() => setExpanded(expanded === lead.id ? null : lead.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>
                {expanded === lead.id ? '▲' : '▼'}
              </button>
            </div>
          </div>
          {expanded === lead.id && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TAGS.map((t) => (
                <button key={t} onClick={() => updateTag(lead.id, t)} style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${TAG_COLORS[t]}`, background: lead.tag === t ? TAG_COLORS[t] : '#fff', color: lead.tag === t ? '#fff' : TAG_COLORS[t], cursor: 'pointer', fontSize: 13 }}>{t}</button>
              ))}
            </div>
          )}
        </div>
      ))}

      {leads.length === 0 && !loading && !notConnected && <p style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem' }}>No leads match these filters.</p>}

      {hasMore && leads.length > 0 && (
        <button onClick={loadMore} disabled={loading} style={{ width: '100%', background: '#f3f4f6', border: 'none', borderRadius: 8, padding: 12, cursor: 'pointer', fontWeight: 600, color: '#374151' }}>
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}

      {poolMode && currentPoolLead && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '2rem', width: 380, maxWidth: '95vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: 800, fontSize: 18 }}>📋 Call Pool</h3>
              <span style={{ color: '#6b7280', fontSize: 13 }}>{poolIndex + 1} of {pool.length}</span>
            </div>
            <strong style={{ fontSize: 20 }}>{currentPoolLead.business_name}</strong>
            {currentPoolLead.state && <div style={{ marginTop: 4 }}><span style={{ background: '#e0e7ff', color: '#3730a3', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>{currentPoolLead.state}</span></div>}
            <div style={{ marginTop: 12, fontSize: 15, lineHeight: 1.8 }}>
              <div>📞 <strong>{currentPoolLead.phone || '–'}</strong></div>
              <div>🏢 {currentPoolLead.industry || '–'}</div>
              <div>🌐 {currentPoolLead.website_status || '–'}</div>
            </div>
            {currentPoolLead.phone && (
              <a href={`tel:${currentPoolLead.phone}`} style={{ display: 'block', marginTop: 12, background: GREEN, color: '#fff', borderRadius: 8, padding: 12, textAlign: 'center', fontWeight: 700, textDecoration: 'none', fontSize: 16 }}>📲 Call Now</a>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => setPoolIndex(Math.max(0, poolIndex - 1))} disabled={poolIndex === 0} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', cursor: 'pointer', background: poolIndex === 0 ? '#f9fafb' : '#fff' }}>← Prev</button>
              <button onClick={() => { if (poolIndex < pool.length - 1) setPoolIndex(poolIndex + 1); else setPoolMode(false); }} style={{ flex: 2, padding: 10, borderRadius: 8, border: 'none', background: GREEN, color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                {poolIndex < pool.length - 1 ? 'Next →' : 'Done ✓'}
              </button>
            </div>
            <button onClick={() => setPoolMode(false)} style={{ width: '100%', marginTop: 8, padding: 8, borderRadius: 8, border: '1px solid #e5e7eb', cursor: 'pointer', background: 'none', color: '#6b7280' }}>Close</button>
          </div>
        </div>
      )}

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '2rem', width: 360 }}>
            <h3 style={{ marginBottom: '1rem' }}>Add Lead</h3>
            <input placeholder="Business name" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 10, boxSizing: 'border-box' }} />
            <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 10, boxSizing: 'border-box' }} />
            <select value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 10 }}>
              {NICHES.map((n) => <option key={n} value={n}>{n.charAt(0).toUpperCase() + n.slice(1)}</option>)}
            </select>
            <select value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 10 }}>
              <option value="">Select State</option>
              {US_STATES.map((s) => <option key={s}>{s}</option>)}
            </select>
            <select value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 10 }}>
              {TAGS.map((t) => <option key={t}>{t}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', marginBottom: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.pooled} onChange={(e) => setForm({ ...form, pooled: e.target.checked })} />
              Add straight to Lead Pool (Call Pool)
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={doAddLead} style={{ flex: 1, background: GREEN, color: '#fff', border: 'none', borderRadius: 8, padding: 10, cursor: 'pointer', fontWeight: 600 }}>Save</button>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, background: '#f3f4f6', border: 'none', borderRadius: 8, padding: 10, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
