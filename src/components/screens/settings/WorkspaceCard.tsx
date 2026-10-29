import { useState } from 'react';
import { api } from '../../../lib/api';
import Card from '../../mm/Card';
import { Sheet } from '../../mm/Page';
import { useTravelMode, setTravelMode } from '../../../data/useTravelMode';

const LABEL: Record<string, string> = { leads: 'leads', lead_findings: 'website findings', lead_outreach: 'unsent email drafts', ecom_products: 'products (not linked to a brand)', ai_approvals: 'pending approvals (brand steps kept)', complaint_clusters: 'complaint clusters' };

/** Settings → Workspace (owner): Travel mode, Fresh start, Archive. */
export default function WorkspaceCard({ nav }: { nav: (screen: string) => void }) {
  const travel = useTravelMode();
  const [err, setErr] = useState('');
  const [sheet, setSheet] = useState(false);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [step, setStep] = useState<'idle' | 'loading' | 'working' | 'done'>('idle');
  const [result, setResult] = useState('');

  const openFresh = async () => {
    setSheet(true); setStep('loading'); setCounts(null); setResult('');
    const r = await api<{ counts: Record<string, number>; error?: string }>('/api/archive/preview', { method: 'GET' });
    if (r.error) { setResult(r.error); setStep('idle'); return; }
    setCounts(r.counts); setStep('idle');
  };
  const run = async () => {
    setStep('working');
    const r = await api<{ ok?: boolean; batch?: string; error?: string }>('/api/archive/fresh-start', { body: {} });
    if (r.error || !r.ok) { setResult(r.error ?? 'Fresh start failed.'); setStep('idle'); return; }
    setResult(`Done. Everything is in Archive → ${r.batch}.`); setStep('done');
  };
  const total = counts ? Object.values(counts).reduce((s, n) => s + n, 0) : 0;
  const row = { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid var(--border)' } as const;

  return (
    <Card title="Workspace">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 15, fontWeight: 500 }}>Travel mode</span>
          <span style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.45 }}>Only production shows: E-commerce, Made by, daily calls, health and Orchestrator. Hides Dispatch, Money moves, Feed, Opening/closing, Contacts, Cold calling and Content. Workers keep running.</span>
        </div>
        <button role="switch" aria-checked={travel} aria-label="Travel mode" onClick={async () => { setErr(''); const e = await setTravelMode(!travel); if (e) setErr(e); }}
          style={{ width: 44, height: 26, borderRadius: 999, flex: 'none', border: 0, padding: 0, cursor: 'pointer', position: 'relative', background: travel ? 'var(--accent)' : 'var(--surface-3)' }}>
          <span style={{ position: 'absolute', top: 3, left: travel ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: travel ? '#fff' : 'var(--text-tertiary)', transition: 'left 150ms ease' }} />
        </button>
      </div>
      {err && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{err}</span>}
      <button type="button" style={{ ...row, background: 'none', border: 0, borderTop: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' }} onClick={() => void openFresh()}>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 500 }}>Fresh start</span><span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Archive leads & products</span>
      </button>
      <button type="button" style={{ ...row, background: 'none', border: 0, borderTop: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' }} onClick={() => nav('archive')}>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 500 }}>Archive</span><span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Search and restore</span>
      </button>

      {sheet && (
        <Sheet title="Fresh start" onClose={() => { if (step !== 'working') setSheet(false); }}>
          <span style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--text-secondary)' }}><strong style={{ color: 'var(--text)' }}>Nothing is deleted.</strong> These move to the Archive, where you can search them and restore one item or everything. Playbooks, worker settings, budgets, connections, brands you're building, the Ledger and AI cost history stay exactly as they are.</span>
          {step === 'loading' && <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Counting…</span>}
          {counts && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.entries(counts).map(([t, n]) => (
                <div key={t} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14.5 }}><span>{LABEL[t] ?? t}</span><strong style={{ fontVariantNumeric: 'tabular-nums' }}>{n.toLocaleString()}</strong></div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14.5, borderTop: '1px solid var(--border)', paddingTop: 6 }}><span>Total</span><strong>{total.toLocaleString()}</strong></div>
            </div>
          )}
          {result && <span style={{ fontSize: 14, color: step === 'done' ? 'var(--success)' : 'var(--danger)' }}>{result}</span>}
          {step === 'done' ? (
            <button className="mm-btn mm-btn--primary" style={{ height: 48 }} onClick={() => { setSheet(false); nav('archive'); }}>Open the Archive</button>
          ) : (
            <button className="mm-btn mm-btn--primary" style={{ height: 48 }} disabled={!counts || step === 'working' || total === 0} onClick={() => void run()}>{step === 'working' ? 'Archiving…' : `Archive ${total.toLocaleString()} items`}</button>
          )}
          <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>After this: run Product Scout for a full new scrape, and Find leads starts on Kansas City.</span>
        </Sheet>
      )}
    </Card>
  );
}
