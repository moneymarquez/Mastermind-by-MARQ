import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import ModulePicker from '../../onboarding/ModulePicker';
import { useModuleAccess } from '../../data/useModuleAccess';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
  currentUserId: string;
  isOwner: boolean;
}

export default function ManageModulesScreen({ homeHeadStyle, homeSubStyle, currentUserId, isOwner }: Props) {
  const { loading, enabledKeys, saveModuleSelections } = useModuleAccess(currentUserId, isOwner);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!loading) setSelected(new Set(enabledKeys));
    // Only sync from the loaded value once — don't clobber in-progress edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    await saveModuleSelections([...selected]);
    setSaving(false);
    setSaved(true);
  };

  if (isOwner) {
    return (
      <div>
        <div style={homeHeadStyle}>Manage modules</div>
        <div style={homeSubStyle}>Your account always has everything on — this screen doesn't apply to you.</div>
      </div>
    );
  }

  return (
    <div>
      <div style={homeHeadStyle}>Manage modules</div>
      <div style={homeSubStyle}>Turn sections on or off — this only changes what shows up in your nav, your data is never touched.</div>

      <div style={{ marginTop: 24, maxWidth: 760 }}>
        {!loading && <ModulePicker selected={selected} onToggle={toggle} />}
      </div>

      <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: '11px 22px', borderRadius: 999, border: 'none', background: 'var(--text)', color: 'var(--bg)',
            fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {saved && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Saved.</span>}
      </div>
    </div>
  );
}
