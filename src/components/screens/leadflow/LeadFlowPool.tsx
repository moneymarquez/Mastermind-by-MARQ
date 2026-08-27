import { useState } from 'react';
import { useLeadflowPool } from '../../../data/useLeadflow';
import { GREEN } from './shared';
import NotConnectedBanner from './NotConnectedBanner';

export default function LeadFlowPool() {
  const { pool, loading, notConnected, removeFromPool } = useLeadflowPool();
  const [sortBy, setSortBy] = useState<'industry' | 'reviews'>('industry');

  const sorted = [...pool].sort((a, b) => {
    if (sortBy === 'industry') return (a.industry || '').localeCompare(b.industry || '');
    return (b.review_count || 0) - (a.review_count || 0);
  });

  return (
    <div>
      {notConnected && <NotConnectedBanner />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: 4 }}>Lead Pool</h1>
          <p style={{ color: '#9ca3af', fontSize: 'var(--text-subhead)' }}>{pool.length} leads ready to call</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setSortBy('industry')} style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid #e5e7eb', background: sortBy === 'industry' ? GREEN : '#fff', color: sortBy === 'industry' ? '#fff' : '#374151', cursor: 'pointer', fontWeight: 500 }}>By Industry</button>
          <button onClick={() => setSortBy('reviews')} style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid #e5e7eb', background: sortBy === 'reviews' ? GREEN : '#fff', color: sortBy === 'reviews' ? '#fff' : '#374151', cursor: 'pointer', fontWeight: 500 }}>By Reviews</button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#9ca3af' }}>Loading pool...</p>
      ) : pool.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 'var(--radius-2xl)', padding: '3rem', textAlign: 'center', border: '1px solid #f3f4f6' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🎯</div>
          <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Your pool is empty</h3>
          <p style={{ color: '#9ca3af' }}>Go to Lead Finder and click "+ Pool" on any lead to add them here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map((lead) => (
            <div key={lead.id} style={{ background: '#fff', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-subhead)' }}>{lead.business_name}</div>
                <div style={{ fontSize: 'var(--text-body)', color: '#9ca3af', marginTop: 2 }}>{lead.industry} · {lead.state} {lead.review_count ? `· ⭐ ${lead.review_count} reviews` : ''}</div>
                {lead.phone && <a href={`tel:${lead.phone}`} style={{ fontSize: 'var(--text-body)', color: GREEN, fontWeight: 600, textDecoration: 'none', marginTop: 4, display: 'block' }}>📞 {lead.phone}</a>}
              </div>
              <button onClick={() => removeFromPool(lead.id)} style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid #fee2e2', background: '#fff', color: '#ef4444', cursor: 'pointer', fontSize: 'var(--text-body)', fontWeight: 500 }}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
