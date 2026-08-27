interface Props {
  isMobile: boolean;
  onClick: () => void;
}

export default function Logo({ isMobile, onClick }: Props) {
  return (
    <div
      // This sits outside the scrollable content area (a sibling in Stage,
      // not a child), so it stays fixed in place while page content
      // scrolls underneath it. Without a backdrop, scrolled-past text was
      // showing straight through the logo's transparent background —
      // this blurred panel keeps it legible regardless of what's beneath.
      style={{
        position: 'absolute', top: 'calc(24px + env(safe-area-inset-top))', left: 20, cursor: 'pointer', zIndex: 41, lineHeight: 1.1,
        padding: '6px 10px', margin: '-6px -10px', borderRadius: 'var(--radius-md)',
        background: 'color-mix(in srgb, var(--bg) 78%, transparent)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      }}
      onClick={onClick}
    >
      <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em' }}>Masterminds</div>
      <div style={{ fontSize: isMobile ? 10 : 11, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.04em', marginTop: 2 }}>by MARQ</div>
    </div>
  );
}
