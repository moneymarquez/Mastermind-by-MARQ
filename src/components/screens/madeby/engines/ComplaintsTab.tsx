import { useState } from 'react';
import Card from '../../../mm/Card';
import Chip from '../../../mm/Chip';
import { Empty } from '../../../mm/States';
import { api } from '../../../../lib/api';
import type { Cluster, EngineCard, EnginesState } from './types';

export default function ComplaintsTab({ state, onState }: { state: EnginesState; onState: (s: EnginesState) => void }) {
  const card = state.cards.find((c) => c.engine === 'complaint_scanner') as EngineCard | undefined;
  const [msg, setMsg] = useState('');
  const setStatus = async (c: Cluster, status: Cluster['status']) => {
    const r = await api('/api/engines/cluster-status', { body: { id: c.id, status } });
    if (r.error) return setMsg(r.error);
    onState({ ...state, clusters: state.clusters.map((x) => (x.id === c.id ? { ...x, status } : x)).filter((x) => x.status !== 'dismissed') });
  };
  const phase = card?.phase ?? 'find';
  const setPhase = async (p: 'find' | 'act') => { const r = await api('/api/engines/phase', { body: { phase: p } }); if (r.error) return setMsg(r.error); onState({ ...state, cards: state.cards.map((c) => (c.engine === 'complaint_scanner' ? { ...c, phase: p } : c)) }); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div role="group" aria-label="Phase" style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 999, overflow: 'hidden' }}>
          {(['find', 'act'] as const).map((p) => <button key={p} onClick={() => void setPhase(p)} aria-pressed={phase === p} style={{ height: 32, padding: '0 14px', border: 'none', background: phase === p ? 'var(--text)' : 'var(--surface)', color: phase === p ? 'var(--bg)' : 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{p === 'find' ? 'Phase 1: Find' : 'Phase 2: Act'}</button>)}
        </div>
        <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{phase === 'find' ? 'Finds and ranks complaints. Nothing is built or sent.' : 'Act is on: nothing happens without your approval on each action.'}</span>
      </div>
      {msg && <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{msg}</div>}
      {state.clusters.length === 0 && <Empty text="No complaint groups yet. Switch Complaint Scanner on in Engines, or press Run now." />}
      {state.clusters.map((c) => (
        <Card key={c.id} title={c.title} meta={`rank ${Math.round(c.rank_score)} · ${c.repeat_count} people`} action={<Chip k={c.tag === 'can_do_now' ? 'good' : 'accent'}>{c.tag === 'can_do_now' ? 'Made by Marq can do this now' : 'New opportunity'}</Chip>}>
          <div style={{ fontSize: 14.5, color: 'var(--text)', lineHeight: 1.5 }}>{c.plain}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {c.quotes.map((q, i) => (
              <blockquote key={i} style={{ margin: 0, padding: '6px 12px', borderLeft: '3px solid var(--border)', fontSize: 13.5, color: 'var(--text-secondary)' }}>
                “{q.text}” <a href={q.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: 12.5 }}>source{q.date ? ` · ${q.date.slice(0, 10)}` : ''}</a>
              </blockquote>
            ))}
          </div>
          {c.affected && <div style={{ fontSize: 13.5 }}><strong>Who's affected:</strong> {c.affected}</div>}
          {c.existing_fixes.length > 0 && <div style={{ fontSize: 13.5 }}><strong>Who's fixing it now:</strong> {c.existing_fixes.map((f) => `${f.name}${f.price ? ` (${f.price})` : ''}`).join(', ')}</div>}
          {c.easy_way && <div style={{ fontSize: 13.5 }}><strong>Easy way in:</strong> {c.easy_way}</div>}
          {c.smallest_test && <div style={{ fontSize: 13.5 }}><strong>Smallest test (under $10):</strong> {c.smallest_test}</div>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="mm-btn" style={{ height: 32, fontSize: 13 }} onClick={() => void setStatus(c, c.status === 'saved' ? 'new' : 'saved')}>{c.status === 'saved' ? 'Saved ✓' : 'Save'}</button>
            {phase === 'act' && <button className="mm-btn mm-btn--primary" style={{ height: 32, fontSize: 13 }} onClick={() => void setStatus(c, 'acting')}>{c.status === 'acting' ? 'Approved to try' : 'Approve the small test'}</button>}
            <button className="mm-btn" style={{ height: 32, fontSize: 13 }} onClick={() => void setStatus(c, 'dismissed')}>Dismiss</button>
          </div>
        </Card>
      ))}
      {state.coverage.length > 0 && <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Scanned so far: {state.coverage.map((c) => `${c.industry.split(' (')[0]} (${c.covered_on})`).join(' · ')}</div>}
    </div>
  );
}
