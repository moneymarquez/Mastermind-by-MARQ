import { useLeadflowHistory } from '../../../data/useLeadflow';
import { TAG_COLORS } from './shared';
import NotConnectedBanner from './NotConnectedBanner';

export default function LeadFlowHistory() {
  const { history, loading, notConnected } = useLeadflowHistory();

  return (
    <div>
      {notConnected && <NotConnectedBanner />}
      <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>History</h1>
      <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>Every lead touch and action, newest first.</p>
      <div style={{ background: '#fff', borderRadius: 'var(--radius-lg)', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
        {history.map((item, i) => (
          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1rem 0', borderBottom: i < history.length - 1 ? '1px solid #f3f4f6' : 'none', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#16a34a', marginTop: 5, flexShrink: 0 }} />
              <div>
                <strong>{item.action}</strong>
                <div style={{ fontSize: 'var(--text-body)', color: '#6b7280' }}>{item.industry} · {new Date(item.created_at).toLocaleString()}</div>
                <div style={{ fontSize: 'var(--text-label)', color: '#374151', marginTop: 4 }}>{item.note}</div>
              </div>
            </div>
            {item.tag && (
              <span style={{ background: (TAG_COLORS[item.tag] ?? '#6b7280') + '22', color: TAG_COLORS[item.tag] ?? '#6b7280', borderRadius: 'var(--radius-3xl)', padding: '4px 12px', fontSize: 'var(--text-small)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {item.tag === 'Hot' ? '🔥' : item.tag === 'Warm' ? '⚡' : '❌'} {item.tag}
              </span>
            )}
          </div>
        ))}
        {history.length === 0 && !loading && !notConnected && <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>No activity yet.</p>}
      </div>
    </div>
  );
}
