import { WORKERS, AUTONOMY_LABEL } from '../../../data/ecom';
import { E, Badge, TeachingEmpty, label } from './ecomShared';

/** §9 "Rooms": one room per worker. Phase 1 shows the roster from the
 *  config with every light off, so the structure is visible before the
 *  Anthropic key exists. Phase 3 lights them up. */
export default function WorkersTab() {
  return (
    <div>
      <TeachingEmpty what="Every worker is off until the Anthropic API key is connected." connection="Anthropic API key (Settings → Connections)" phase={3} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, marginTop: 14 }}>
        {WORKERS.map((w) => (
          <div key={w.key} style={{ ...E.card, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, opacity: 0.85 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#d1d5db', flexShrink: 0 }} title="Off" />
              <span style={{ fontWeight: 700, color: E.text, fontSize: 'var(--text-body)', flex: 1 }}>{w.name}</span>
              {w.key === 'orchestrator' && <Badge color="#7c3aed">Brain</Badge>}
            </div>
            <div style={{ fontSize: 'var(--text-body)', color: E.muted, lineHeight: 1.45 }}>{w.role}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Badge color="#2563eb">{w.model}</Badge>
              <Badge color="#6b7280">{AUTONOMY_LABEL[0]}</Badge>
              <Badge color="#b45309">Phase {w.phase}</Badge>
            </div>
            {w.tools.length > 0 && <div style={{ fontSize: 'var(--text-caption)', color: E.faint }}>Tools: {w.tools.join(', ')}</div>}
            <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 8, display: 'flex', gap: 12, fontSize: 'var(--text-caption)', color: E.faint }}>
              <span><span style={label}>Today</span> 0</span>
              <span><span style={label}>Approval</span> —</span>
              <span><span style={label}>Cost</span> $0.00</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 'var(--text-caption)', color: E.faint, marginTop: 14, lineHeight: 1.5 }}>
        Everyone starts at L0 · Draft: every output goes to your approvals. Promotion needs two weeks at 80%+ approval with clean spot-checks, and never applies to money.
      </div>
    </div>
  );
}
