import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { PlayDeliverable } from '../../data/usePlayDeliverables';
import { isOverdue } from '../../data/usePlayDeliverables';

interface Props {
  deliverables: PlayDeliverable[];
  loading: boolean;
  clientNameById: Map<string, string>;
  onMarkDone: (id: string) => void;
}

const badgeStyle = (overdue: boolean): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 'var(--radius-pill)',
  border: `1px solid ${overdue ? 'var(--danger)' : 'var(--border)'}`,
  color: overdue ? 'var(--danger)' : 'var(--text-secondary)',
  fontSize: 'var(--text-small)', fontWeight: 600, cursor: 'pointer', flexShrink: 0,
});
const panelStyle: CSSProperties = {
  marginTop: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 16,
};
const row: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderTop: '1px solid var(--border)' };
const ghostBtn: CSSProperties = {
  padding: '4px 10px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
  fontSize: 'var(--text-micro)', cursor: 'pointer', flexShrink: 0,
};

/** Build order item 9's badge — "top-right count of open
 *  play_deliverables, red when overdue, tap to expand by client."
 *  Marketing tab only for now, per the build prompt's own sequencing
 *  ("app-wide later" is explicitly a different, later step, not this
 *  one). Account-wide count; the expansion groups by client so the
 *  operator can see whose work is actually piling up. */
export default function MarketingDeliverablesBadge({ deliverables, loading, clientNameById, onMarkDone }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (loading) return null;

  const open = deliverables.filter((d) => d.status === 'open');
  if (open.length === 0) return null;

  const overdue = open.some(isOverdue);

  const byClient = new Map<string, PlayDeliverable[]>();
  for (const d of open) {
    const list = byClient.get(d.client_id) ?? [];
    list.push(d);
    byClient.set(d.client_id, list);
  }

  return (
    <div>
      <span style={badgeStyle(overdue)} onClick={() => setExpanded((e) => !e)}>
        {open.length} open{overdue ? ' — overdue' : ''}
      </span>
      {expanded && (
        <div style={panelStyle}>
          {[...byClient.entries()].map(([clientId, items]) => (
            <div key={clientId} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 'var(--text-body-sm)', fontWeight: 700, color: 'var(--text)' }}>{clientNameById.get(clientId) ?? 'Unknown client'}</div>
              {items.map((d) => (
                <div key={d.id} style={row}>
                  <div>
                    <div style={{ fontSize: 'var(--text-body-sm)', color: isOverdue(d) ? 'var(--danger)' : 'var(--text)', fontWeight: 600 }}>{d.title}</div>
                    {d.description && <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 2 }}>{d.description}</div>}
                    {d.due_date && <div style={{ fontSize: 'var(--text-micro)', color: isOverdue(d) ? 'var(--danger)' : 'var(--text-tertiary)', marginTop: 2 }}>Due {d.due_date}</div>}
                  </div>
                  <span style={ghostBtn} onClick={() => onMarkDone(d.id)}>Done</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
