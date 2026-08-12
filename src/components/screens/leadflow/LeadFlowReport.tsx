import { useState } from 'react';
import { generateLeadflowReport } from '../../../data/useLeadflow';
import { GREEN } from './shared';

export default function LeadFlowReport() {
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    setLoading(true);
    setError('');
    const res = await generateLeadflowReport();
    if (res.error) setError(res.error);
    else setReport(res.text ?? 'Could not generate report.');
    setLoading(false);
  };

  return (
    <div>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>AI Sales Report</h1>
      <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>A mentor-style daily debrief based on your live pipeline.</p>
      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 10, padding: '10px 16px', marginBottom: '1rem', fontSize: 13 }}>{error}</div>}
      {!report ? (
        <div style={{ background: '#fff', borderRadius: 16, padding: '3rem', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
          <div style={{ fontSize: 48, marginBottom: '1rem' }}>🤖</div>
          <h3 style={{ marginBottom: 8 }}>Generate today's report</h3>
          <p style={{ color: '#6b7280', marginBottom: '2rem' }}>Your AI sales mentor reviews your pipeline and recent activity, then tells you what went well, what to fix, and your top 3 priorities for tomorrow.</p>
          <button onClick={generate} disabled={loading} style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 10, padding: '14px 32px', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
            {loading ? 'Generating...' : '⚙️ Generate Daily Report'}
          </button>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 16, padding: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 8 }}>
            <div><strong>Daily Sales Report</strong><br /><span style={{ color: '#6b7280', fontSize: 13 }}>{new Date().toLocaleString()}</span></div>
            <button onClick={generate} disabled={loading} style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer' }}>{loading ? 'Regenerating...' : 'Regenerate'}</button>
          </div>
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, color: '#374151' }}>{report}</div>
        </div>
      )}
    </div>
  );
}
