import type { PointerEvent } from 'react';
import Icon from '../Icon';

interface Props {
  cx: number;
  cy: number;
  circleSize: number;
  dragging: boolean;
  novaOpen: boolean;
  onPointerDown: (e: PointerEvent) => void;
  onPointerMove: (e: PointerEvent) => void;
  onPointerUp: () => void;
}

/** The draggable circle, top-left of the stage — a pure Nova open/close toggle. */
export default function NovaTrigger({ cx, cy, circleSize, dragging, novaOpen, onPointerDown, onPointerMove, onPointerUp }: Props) {
  return (
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
      <Icon name={novaOpen ? 'x' : 'sparkle'} size={Math.round(circleSize * 0.4)} color="#0A0B0D" />
    </div>
  );
}
