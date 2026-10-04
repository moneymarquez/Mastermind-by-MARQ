/** On/off switch (design handoff: Manage modules toggle). */
export default function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      style={{ width: 44, height: 26, borderRadius: 999, flex: 'none', border: 0, padding: 0, cursor: disabled ? 'default' : 'pointer', position: 'relative', background: on ? 'var(--accent)' : 'var(--surface-3)', opacity: disabled ? 0.6 : 1, transition: 'background .15s ease' }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: on ? '#fff' : 'var(--text-tertiary)', transition: 'left .15s ease' }} />
    </button>
  );
}
