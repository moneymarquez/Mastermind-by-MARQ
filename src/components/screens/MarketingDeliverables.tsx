import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { MarketingPlay } from '../../data/useMarketingPlays';
import type { PlayDeliverable } from '../../data/usePlayDeliverables';
import { isOverdue } from '../../data/usePlayDeliverables';

interface Props {
  play: MarketingPlay;
  /** Already filtered to this play's id. */
  deliverables: PlayDeliverable[];
  onAdd: (title: string, description: string, dueDate: string | null) => void;
  onMarkDone: (id: string) => void;
  onRemove: (id: string) => void;
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 20 };
const inputStyle: CSSProperties = {
  background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)',
  padding: '8px 11px', color: 'var(--text)', fontSize: 'var(--text-body-sm)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};
const row: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderTop: '1px solid var(--border)' };
const ghostBtn: CSSProperties = {
  padding: '5px 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
  fontSize: 'var(--text-small)', cursor: 'pointer', flexShrink: 0,
};
const primaryBtn: CSSProperties = {
  padding: '7px 14px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--text)', color: 'var(--bg)',
  fontSize: 'var(--text-small)', fontWeight: 600, cursor: 'pointer',
};

/** The other half of build order item 9 — where deliverables actually
 *  get created, tied to the play they came from. Plain todos with an
 *  optional due date; the badge (MarketingDeliverablesBadge) reads
 *  whatever gets added here, account-wide. */
export default function MarketingDeliverables({ play, deliverables, onAdd, onMarkDone, onRemove }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [adding, setAdding] = useState(false);

  const open = deliverables.filter((d) => d.status === 'open');

  const submit = () => {
    if (!title.trim()) return;
    onAdd(title, description, dueDate || null);
    setTitle('');
    setDescription('');
    setDueDate('');
    setAdding(false);
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>Deliverables — {play.title}</div>
        {!adding && <span style={ghostBtn} onClick={() => setAdding(true)}>+ Add</span>}
      </div>

      {adding && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input style={inputStyle} placeholder="e.g. Shoot the storefront photos" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          <input style={inputStyle} placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <input style={{ ...inputStyle, width: 160 }} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ ...primaryBtn, opacity: title.trim() ? 1 : 0.5, pointerEvents: title.trim() ? 'auto' : 'none' }} onClick={submit}>Add</span>
            <span style={ghostBtn} onClick={() => setAdding(false)}>Cancel</span>
          </div>
        </div>
      )}

      {open.length === 0 ? (
        <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)', marginTop: 12 }}>Nothing open for this play.</div>
      ) : (
        <div style={{ marginTop: 8 }}>
          {open.map((d) => (
            <div key={d.id} style={row}>
              <div>
                <div style={{ fontSize: 'var(--text-body-sm)', color: isOverdue(d) ? 'var(--danger)' : 'var(--text)', fontWeight: 600 }}>{d.title}</div>
                {d.description && <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 2 }}>{d.description}</div>}
                {d.due_date && <div style={{ fontSize: 'var(--text-micro)', color: isOverdue(d) ? 'var(--danger)' : 'var(--text-tertiary)', marginTop: 2 }}>Due {d.due_date}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={ghostBtn} onClick={() => onMarkDone(d.id)}>Done</span>
                <span style={ghostBtn} onClick={() => onRemove(d.id)}>✕</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
