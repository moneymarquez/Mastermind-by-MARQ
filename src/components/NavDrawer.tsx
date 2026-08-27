import type { NavRow } from '../navRows';
import Icon from '../Icon';

interface Props {
  open: boolean;
  rows: NavRow[];
  onToggle: () => void;
  onClose: () => void;
}

export default function NavDrawer({ open, rows, onToggle, onClose }: Props) {
  return (
    <>
      <div
        data-testid="hamburger"
        style={{
          position: 'absolute', top: 'calc(24px + env(safe-area-inset-top))', right: 20, width: 42, height: 42, borderRadius: '50%',
          background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer', zIndex: 41,
        }}
        onClick={onToggle}
      >
        <Icon name="list" size={18} color="var(--text)" />
      </div>

      {open && (
        <>
          <div style={{ position: 'absolute', inset: 0, zIndex: 38 }} onClick={onClose} />
          <div
            style={{
              position: 'absolute', top: 'calc(74px + env(safe-area-inset-top))', right: 20, width: 250, maxHeight: '75%', overflowY: 'auto',
              background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-2xl)', padding: '12px 14px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)', animation: 'drawerIn 0.16s ease', zIndex: 39,
            }}
          >
            {rows.map((row) => {
              if (row.kind === 'header') {
                return (
                  <div key={row.key} style={{ padding: '14px 0 4px 10px', display: 'block' }}>
                    <span style={{ fontSize: 'var(--text-nano)', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                      {row.label}
                    </span>
                  </div>
                );
              }
              if (row.kind === 'sub') {
                return (
                  <div
                    key={row.key}
                    style={{ display: 'block', padding: '7px 10px 7px 38px', cursor: row.onClick ? 'pointer' : 'default' }}
                    onClick={row.onClick}
                  >
                    <span style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)' }}>{row.label}</span>
                  </div>
                );
              }
              return (
                <div key={row.key} className="nav-row" style={{ cursor: 'pointer', borderRadius: 'var(--radius-pill)' }} onClick={row.onClick}>
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
                      borderRadius: 'var(--radius-pill)', background: row.active ? 'var(--text)' : 'transparent', transition: 'background 0.15s ease',
                    }}
                  >
                    <Icon name={row.icon!} size={17} color={row.active ? 'var(--bg)' : 'var(--text-quaternary)'} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 'var(--text-body-lg)', color: row.active ? 'var(--bg)' : 'var(--text-quaternary)', fontWeight: row.active ? 600 : 500 }}>
                      {row.label}
                    </span>
                    {row.collapsible && (
                      <Icon
                        name="caret-down"
                        size={12}
                        color="var(--text-tertiary)"
                        style={{
                          marginLeft: 'auto',
                          transform: row.expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease',
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
