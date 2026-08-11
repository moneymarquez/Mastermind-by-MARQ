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
          background: '#14161A', border: '1px solid #22262B', display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer', zIndex: 41,
        }}
        onClick={onToggle}
      >
        <Icon name="list" size={18} color="#F5F6F7" />
      </div>

      {open && (
        <>
          <div style={{ position: 'absolute', inset: 0, zIndex: 38 }} onClick={onClose} />
          <div
            style={{
              position: 'absolute', top: 'calc(74px + env(safe-area-inset-top))', right: 20, width: 250, maxHeight: '75%', overflowY: 'auto',
              background: '#101114', border: '1px solid #22262B', borderRadius: 16, padding: '12px 14px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)', animation: 'drawerIn 0.16s ease', zIndex: 39,
            }}
          >
            {rows.map((row) => {
              if (row.kind === 'header') {
                return (
                  <div key={row.key} style={{ padding: '14px 0 4px 10px', display: 'block' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#565b64', textTransform: 'uppercase' }}>
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
                    <span style={{ fontSize: 12.5, color: '#8A8F98' }}>{row.label}</span>
                  </div>
                );
              }
              return (
                <div key={row.key} className="nav-row" style={{ cursor: 'pointer', borderRadius: 999 }} onClick={row.onClick}>
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
                      borderRadius: 999, background: row.active ? '#F5F6F7' : 'transparent', transition: 'background 0.15s ease',
                    }}
                  >
                    <Icon name={row.icon!} size={17} color={row.active ? '#0A0B0D' : '#C7CAD1'} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 13.5, color: row.active ? '#0A0B0D' : '#C7CAD1', fontWeight: row.active ? 600 : 500 }}>
                      {row.label}
                    </span>
                    {row.collapsible && (
                      <Icon
                        name="caret-down"
                        size={12}
                        color="#565b64"
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
