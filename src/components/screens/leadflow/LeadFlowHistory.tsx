import { useLeadflowHistory } from '../../../data/useLeadflow';
import type { LeadflowHistoryItem } from '../../../data/useLeadflow';
import { fmtIndustry, tagSignal, tagLabel } from './format';
import { Tag, NotConnected, EmptyState, SkeletonRows } from './ui';
import { useLfPhone } from './layout';

const COLS = '90px minmax(0,1.4fr) minmax(0,1fr) minmax(0,2fr) 110px';

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

/** Activity log: newest first (the Worker returns up to 200), grouped by day. */
export default function LeadFlowHistory({ onOpenPool }: { onOpenPool: () => void }) {
  const { history, loading, notConnected } = useLeadflowHistory();
  const phone = useLfPhone();
  const groups: { day: string; items: LeadflowHistoryItem[] }[] = [];
  for (const h of history) {
    const day = dayLabel(h.created_at);
    if (groups.at(-1)?.day !== day) groups.push({ day, items: [] });
    groups.at(-1)!.items.push(h);
  }
  const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <>
      {notConnected && <NotConnected />}
      <div className="lf-panel" style={{ overflow: 'hidden' }}>
        {!phone && <div className="lf-thead" style={{ gridTemplateColumns: COLS, padding: '0 16px', gap: 8 }}><span>Time</span><span>Action</span><span>Industry</span><span>Note</span><span>Tag</span></div>}
        {loading ? <SkeletonRows cols={COLS} rows={5} />
          : history.length === 0 ? (notConnected ? null : <EmptyState text="No activity yet. Calls and changes you log will show up here." action="Open lead pool" onAction={onOpenPool} />)
          : groups.map((g) => (
            <div key={g.day}>
              <div className="lf-group" style={{ padding: '0 16px' }}>{g.day}</div>
              {g.items.map((h) => phone ? (
                <div key={h.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--lf-border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="lf-mono" style={{ fontSize: 12, color: 'var(--lf-text-tertiary)' }}>{time(h.created_at)}</span>
                    <span className="lf-trunc" style={{ fontWeight: 500, flex: 1 }}>{h.action}</span>
                    {h.tag && <Tag s={tagSignal(h.tag)}>{tagLabel(h.tag)}</Tag>}
                  </div>
                  {(h.industry || h.note) && <div className="lf-label">{[fmtIndustry(h.industry), h.note].filter(Boolean).join(' · ')}</div>}
                </div>
              ) : (
                <div key={h.id} style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, alignItems: 'center', minHeight: 44, padding: '0 16px', borderBottom: '1px solid var(--lf-border)', fontSize: 14 }}>
                  <span className="lf-mono" style={{ fontSize: 12, color: 'var(--lf-text-tertiary)' }}>{time(h.created_at)}</span>
                  <span className="lf-trunc" style={{ fontWeight: 500 }}>{h.action}</span>
                  <span className="lf-cell-2 lf-trunc">{fmtIndustry(h.industry)}</span>
                  <span className="lf-cell-2 lf-trunc" title={h.note ?? undefined}>{h.note}</span>
                  <span>{h.tag && <Tag s={tagSignal(h.tag)}>{tagLabel(h.tag)}</Tag>}</span>
                </div>
              ))}
            </div>
          ))}
      </div>
    </>
  );
}
