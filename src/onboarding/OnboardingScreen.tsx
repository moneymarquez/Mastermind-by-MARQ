import { useState } from 'react';
import ModulePicker from './ModulePicker';
import { SELECTABLE_MODULE_KEYS } from '../modules.config';

interface Props {
  onComplete: (selectedKeys: string[]) => Promise<void>;
}

export default function OnboardingScreen({ onComplete }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(SELECTABLE_MODULE_KEYS));
  const [saving, setSaving] = useState(false);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const submit = async () => {
    setSaving(true);
    await onComplete([...selected]);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '48px 24px 120px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 760 }}>
        <div style={{ fontSize: 'var(--text-stat)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em', marginBottom: 2 }}>Masterminds by MARQ</div>
        <div style={{ fontSize: 'var(--text-display)', fontWeight: 700, color: 'var(--text)', marginTop: 24, marginBottom: 6 }}>What do you want turned on?</div>
        <div style={{ fontSize: 'var(--text-body-lg)', color: 'var(--text-secondary)', marginBottom: 32, maxWidth: 520, lineHeight: 1.6 }}>
          Pick whatever's relevant to you — you can change this anytime from Settings → Manage modules. Everything's
          selected by default; deselect anything you don't want cluttering your nav.
        </div>

        <ModulePicker selected={selected} onToggle={toggle} />

        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: 'linear-gradient(180deg, transparent, var(--bg) 40%)', padding: '32px 24px 24px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 760, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)' }}>{selected.size} of {SELECTABLE_MODULE_KEYS.length} selected</div>
            <button
              onClick={submit}
              disabled={saving}
              style={{
                padding: '12px 28px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--text)', color: 'var(--bg)',
                fontSize: 'var(--text-body-lg)', fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
