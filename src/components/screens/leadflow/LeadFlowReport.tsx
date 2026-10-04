import { useState } from 'react';
import type { ReactNode } from 'react';
import { generateLeadflowReport } from '../../../data/useLeadflow';
import { Banner, PanelHead } from './ui';
import { HeaderAction, useLfPhone } from './layout';

/** The model's report is plain text with headings and bullets; render it as a
 *  reading column. Headings are lines that end in ':' or start with '#'. */
function renderReport(text: string): ReactNode[] {
  return text.split('\n').map((raw, i) => {
    const line = raw.trim();
    if (!line) return null;
    const h = line.match(/^#{1,4}\s*(.*)$/) ?? line.match(/^\*\*(.+?)\*\*:?$/) ?? (line.length < 60 && /:$/.test(line) && !/^[-•*\d]/.test(line) ? [line, line.replace(/:$/, '')] : null);
    if (h) return <div key={i} style={{ fontSize: 15, fontWeight: 500, color: 'var(--lf-text)', marginTop: i ? 8 : 0 }}>{h[1].replace(/\*\*/g, '')}</div>;
    return <div key={i}>{line.replace(/\*\*/g, '').replace(/^[-*]\s+/, '• ')}</div>;
  });
}

export default function LeadFlowReport() {
  const phone = useLfPhone();
  const [report, setReport] = useState<string | null>(null);
  const [at, setAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    setLoading(true);
    setError('');
    const res = await generateLeadflowReport();
    if (res.error) setError(res.error);
    else { setReport(res.text ?? 'Could not generate report.'); setAt(new Date()); }
    setLoading(false);
  };
  // The Worker answers with this when no AI key is funded; say so instead of
  // offering a button that can't work.
  const aiOff = /anthropic|api key|not configured|credit/i.test(error);

  if (!report) {
    return (
      <>
        {!aiOff && <HeaderAction><button className="lf-btn lf-btn--primary" onClick={generate} disabled={loading}>{loading ? 'Generating…' : "Generate today's report"}</button></HeaderAction>}
        <div className="lf-panel" style={{ padding: phone ? 20 : 32, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 500 }}>Sales report</div>
          <div style={{ fontSize: 14, color: 'var(--lf-text-secondary)', maxWidth: 560 }}>A mentor-style daily debrief based on your live pipeline: what went well, what to improve, and your top 3 priorities for tomorrow.</div>
          {aiOff
            ? <Banner s="wait" title="AI isn't funded yet">The report needs the AI key on the Worker. Everything else in LeadFlow works without it.</Banner>
            : <button className="lf-btn lf-btn--primary" onClick={generate} disabled={loading}>{loading ? 'Generating…' : "Generate today's report"}</button>}
          {error && !aiOff && <Banner s="stop">{error}</Banner>}
        </div>
      </>
    );
  }
  return (
    <div className="lf-panel">
      <PanelHead title={<>Daily debrief <span className="lf-mono" style={{ fontSize: 12, color: 'var(--lf-text-tertiary)', fontWeight: 400, marginLeft: 8 }}>{at?.toISOString().slice(0, 10)}</span></>}
        right={<button className="lf-btn lf-btn--ghost lf-btn--sm" onClick={generate} disabled={loading}>{loading ? 'Regenerating…' : 'Regenerate'}</button>} />
      {error && <div style={{ padding: '12px 16px 0' }}><Banner s="stop">{error}</Banner></div>}
      <div style={{ padding: phone ? '20px 16px' : '24px 32px' }}>
        <div style={{ maxWidth: 680, fontSize: 15, lineHeight: 1.6, color: 'var(--lf-text-secondary)', display: 'flex', flexDirection: 'column', gap: 6 }}>{renderReport(report)}</div>
      </div>
    </div>
  );
}
