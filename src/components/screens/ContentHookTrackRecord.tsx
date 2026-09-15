import type { CSSProperties } from 'react';
import type { HookLogEntry } from '../../data/useHookLog';
import { rankHookTypes } from '../../data/useHookLog';

interface Props {
  entries: HookLogEntry[];
  loading: boolean;
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 20, marginTop: 20 };
const row: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--border)' };

const HOOK_TYPE_LABEL: Record<string, string> = {
  question: 'Question', bold_claim: 'Bold claim', story_open: 'Story open', controversy: 'Controversy',
  proof_receipt: 'Proof/receipt', direct_callout: 'Direct callout', how_to: 'How-to',
};

/** Cross-account hook-type track record — content's version of
 *  Marketing's MarketingTrackRecord. hook_type is a fixed taxonomy
 *  shared across every client's plans (unlike pillar, which is free
 *  text per plan and only meaningful reordering a single plan's own
 *  slate — see contentIdeaEngine.ts), so ranking it account-wide is
 *  meaningful here. Same "worthless below ~30" honesty as the logging
 *  form itself. */
export default function ContentHookTrackRecord({ entries, loading }: Props) {
  if (loading || entries.length === 0) return null;

  const ranked = rankHookTypes(entries);
  const thin = entries.length < 30;

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--text)' }}>Hook track record</div>
      <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 4, marginBottom: 8 }}>
        {thin
          ? `Only ${entries.length} post${entries.length === 1 ? '' : 's'} logged so far — worthless as a real signal below ~30. That's expected, not broken.`
          : `Based on ${entries.length} logged posts across every account.`}
      </div>
      <div>
        {ranked.map((r) => (
          <div key={r.hook_type} style={row}>
            <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text)' }}>{HOOK_TYPE_LABEL[r.hook_type] ?? r.hook_type}</div>
            <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)' }}>
              {r.worked} worked{r.didnt_work > 0 ? `, ${r.didnt_work} didn't` : ''}{r.inconclusive > 0 ? `, ${r.inconclusive} inconclusive` : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
