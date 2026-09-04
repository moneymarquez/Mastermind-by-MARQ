import Icon from '../../Icon';
import { useNudges } from '../../data/useNudges';
import type { HomeWidgetProps } from './types';
import { cardShell } from './types';

/** The dark Nova card — proactive nudges (dismissible) + an "Open Nova"
 *  shortcut. Unchanged from before the widget system, just its own
 *  component now. */
export default function NovaWidget({ isMobile, onNavigate, onOpenNova, assistantName }: HomeWidgetProps) {
  const { nudges, dismiss: dismissNudge } = useNudges();

  return (
    <div style={{ ...cardShell, background: 'var(--mm-ink)', color: 'var(--mm-ink-text)', border: 'none', padding: 20, gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 10.5, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.66 }}>
        <Icon name="sparkle" size={16} />Nova
      </div>
      <div style={{ fontSize: 15, lineHeight: 1.5 }}>
        Ask {assistantName} anything about today, or across any module you've turned on.
      </div>

      {nudges.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {nudges.slice(0, 3).map((n) => (
            <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--mm-ink-soft)', border: '1px solid var(--mm-ink-line)' }}>
              <div
                style={{ fontSize: 12.5, opacity: 0.8, lineHeight: 1.45, cursor: n.target_screen ? 'pointer' : 'default' }}
                onClick={() => n.target_screen && onNavigate(n.target_screen)}
              >
                {n.message}
              </div>
              <span style={{ fontSize: 10.5, opacity: 0.6, cursor: 'pointer', flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); dismissNudge(n.id); }}>✕</span>
            </div>
          ))}
        </div>
      )}

      <div
        onClick={onOpenNova}
        style={{ marginTop: isMobile ? 0 : 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 15px', borderRadius: 12, background: 'var(--mm-ink-text)', color: 'var(--mm-ink)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
      >
        Open Nova<Icon name="arrow-right" size={16} />
      </div>
    </div>
  );
}
