import type { PointerEvent } from 'react';
import type { GroupBloomItem, ItemBloomItem } from '../geometry';
import Icon from '../Icon';

interface Props {
  cx: number;
  cy: number;
  circleSize: number;
  dragging: boolean;
  radialOpen: boolean;
  radialLevel2: boolean;
  bloomArea: { left: number; top: number; width: number; height: number };
  groupBloomItems: GroupBloomItem[];
  itemBloomItems: ItemBloomItem[];
  onPointerDown: (e: PointerEvent) => void;
  onPointerMove: (e: PointerEvent) => void;
  onPointerUp: () => void;
  onGroupEnter: (name: string) => void;
  onItemClick: (id: string) => void;
  onRadialLeave: () => void;
}

export default function RadialMenu({
  cx, cy, circleSize, dragging, radialOpen, radialLevel2, bloomArea,
  groupBloomItems, itemBloomItems, onPointerDown, onPointerMove, onPointerUp, onGroupEnter, onItemClick, onRadialLeave,
}: Props) {
  return (
    <>
      <div
        data-testid="radial-circle"
        style={{
          position: 'absolute', left: cx, top: cy, width: circleSize, height: circleSize,
          borderRadius: '50%', background: '#F5F6F7', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: dragging ? 'grabbing' : 'grab', zIndex: 40, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', touchAction: 'none',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <Icon name="sparkle" size={Math.round(circleSize * 0.4)} color="#0A0B0D" />
      </div>

      {radialOpen && (
        <div
          style={{ position: 'absolute', left: bloomArea.left, top: bloomArea.top, width: bloomArea.width, height: bloomArea.height, zIndex: 35 }}
          onMouseLeave={onRadialLeave}
        >
          {groupBloomItems.map((g) => (
            <div
              key={g.key}
              onMouseEnter={g.isGroup ? () => onGroupEnter(g.groupName!) : undefined}
              onClick={g.isGroup ? () => onGroupEnter(g.groupName!) : () => onItemClick(g.itemId!)}
              style={{
                position: 'absolute', left: g.pos.x, top: g.pos.y,
                transform: g.active ? 'translate(-50%,-50%) scale(1.12)' : 'translate(-50%,-50%)',
                fontSize: 16, fontWeight: 800, letterSpacing: '0.01em', cursor: 'pointer', whiteSpace: 'nowrap',
                color: g.active ? '#F5F6F7' : '#c7cad1',
                textShadow: g.active ? '0 0 22px rgba(245,246,247,0.9), 0 0 8px rgba(245,246,247,0.7)' : '0 2px 10px rgba(0,0,0,0.5)',
                animation: 'bloomPop 0.25s ease',
                transition: 'color 0.15s ease, transform 0.15s ease, text-shadow 0.15s ease',
                zIndex: 25, pointerEvents: 'auto',
              }}
            >
              {g.label}
            </div>
          ))}
          {radialLevel2 &&
            itemBloomItems.map((it) => (
              <div
                key={it.id}
                onClick={() => onItemClick(it.id)}
                style={{
                  position: 'absolute', left: it.pos.x, top: it.pos.y, transform: 'translate(-50%,-50%)',
                  display: 'flex', alignItems: 'center', gap: 7, padding: '8px 13px', borderRadius: 999,
                  fontSize: 12, fontWeight: 500, background: '#1a1c21', color: '#e9e9ed', border: '1px solid #2b2f36',
                  cursor: 'pointer', whiteSpace: 'nowrap', animation: 'bloomPop 0.24s ease',
                  boxShadow: '0 6px 18px rgba(0,0,0,0.4)', zIndex: 24, pointerEvents: 'auto',
                }}
              >
                <Icon name={it.icon} size={13} />
                <span>{it.label}</span>
              </div>
            ))}
        </div>
      )}
    </>
  );
}
