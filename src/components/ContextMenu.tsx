import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface Props {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

const MENU_WIDTH = 180;
const ITEM_HEIGHT = 36;

/** A generic right-click menu — a full-screen transparent overlay behind
 *  it closes it on any outside click or a second right-click, same trick
 *  NovaPanel's mobile sheet uses for its own backdrop. Position is
 *  clamped to the viewport so a click near the right/bottom edge doesn't
 *  render off-screen. */
export default function ContextMenu({ x, y, items, onClose }: Props) {
  const [pos, setPos] = useState({ x, y });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const menuHeight = items.length * ITEM_HEIGHT + 12;
    setPos({
      x: Math.min(x, window.innerWidth - MENU_WIDTH - 10),
      y: Math.min(y, window.innerHeight - menuHeight - 10),
    });
  }, [x, y, items.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const overlayStyle: CSSProperties = { position: 'fixed', inset: 0, zIndex: 200 };
  const menuStyle: CSSProperties = {
    position: 'fixed', left: pos.x, top: pos.y, zIndex: 201, width: MENU_WIDTH,
    background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
    boxShadow: '0 12px 32px rgba(0,0,0,0.35)', padding: 6, display: 'flex', flexDirection: 'column', gap: 2,
  };

  return (
    <>
      <div style={overlayStyle} onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div ref={ref} style={menuStyle}>
        {items.map((it, i) => (
          <div
            key={i}
            onClick={() => { it.onClick(); onClose(); }}
            style={{
              padding: '8px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--text-body-sm)',
              color: it.danger ? 'var(--danger)' : 'var(--text)', height: ITEM_HEIGHT - 8, display: 'flex', alignItems: 'center',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-4)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            {it.label}
          </div>
        ))}
      </div>
    </>
  );
}
