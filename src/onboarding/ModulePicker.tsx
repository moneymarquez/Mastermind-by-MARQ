import type { CSSProperties } from 'react';
import { MODULE_REGISTRY } from '../modules.config';
import type { ModuleCategory } from '../modules.config';
import Icon from '../Icon';

interface Props {
  selected: Set<string>;
  onToggle: (key: string) => void;
}

const CATEGORY_ORDER: ModuleCategory[] = ['Personal', 'Cold Calling', 'Clients', 'Scaling', 'Side Hustles', null];
const CATEGORY_LABEL: Record<string, string> = {
  Personal: 'Personal',
  'Cold Calling': 'Cold Calling',
  Clients: 'Clients',
  Scaling: 'Scaling',
  'Side Hustles': 'Side Hustles',
};

const cardStyle = (active: boolean): CSSProperties => ({
  display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderRadius: 'var(--radius-lg)', cursor: 'pointer',
  border: `1px solid ${active ? 'var(--text)' : 'var(--border)'}`, background: active ? '#F5F6F71a' : 'var(--surface)',
  transition: 'border-color 0.12s ease, background 0.12s ease',
});

export default function ModulePicker({ selected, onToggle }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {CATEGORY_ORDER.map((cat) => {
        const items = MODULE_REGISTRY.filter((m) => m.category === cat);
        if (items.length === 0) return null;
        return (
          <div key={cat ?? 'uncategorized'}>
            {cat && (
              <div style={{ fontSize: 'var(--text-tiny)', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 12 }}>
                {CATEGORY_LABEL[cat]}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
              {items.map((m) => {
                // Owner-only modules (the whole Scaling category right now)
                // render as a locked preview — visible so onboarding still
                // shows what the platform can do, but not clickable and
                // never added to `selected`, so they can't end up selected
                // for a non-owner account no matter what.
                if (m.ownerOnly) {
                  return (
                    <div key={m.key} style={{ ...cardStyle(false), cursor: 'default', opacity: 0.55 }}>
                      <Icon name="lock" size={16} color="var(--text-tertiary)" style={{ marginTop: 1, flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Icon name={m.icon} size={14} color="var(--text-tertiary)" />
                          <div style={{ fontSize: 'var(--text-body-lg)', fontWeight: 600, color: 'var(--text-secondary)' }}>{m.label}</div>
                        </div>
                        <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 4, lineHeight: 1.5 }}>{m.description}</div>
                        <div style={{ fontSize: 'var(--text-nano)', color: 'var(--text-tertiary)', marginTop: 4 }}>Owner-managed — not available on this account.</div>
                      </div>
                    </div>
                  );
                }
                const active = selected.has(m.key);
                return (
                  <div key={m.key} style={cardStyle(active)} onClick={() => onToggle(m.key)}>
                    <div style={{
                      width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1,
                      border: `1px solid ${active ? 'var(--text)' : '#3a3d43'}`, background: active ? 'var(--text)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-tiny)', color: 'var(--bg)', fontWeight: 700,
                    }}>
                      {active ? '✓' : ''}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Icon name={m.icon} size={14} color={active ? 'var(--text)' : 'var(--text-secondary)'} />
                        <div style={{ fontSize: 'var(--text-body-lg)', fontWeight: 600, color: 'var(--text)' }}>{m.label}</div>
                      </div>
                      <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>{m.description}</div>
                      {m.requiresAI && (
                        <div style={{ fontSize: 'var(--text-nano)', color: 'var(--text-tertiary)', marginTop: 4 }}>Needs the Anthropic key funded for its AI features.</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
