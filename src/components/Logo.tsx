interface Props {
  isMobile: boolean;
  onClick: () => void;
}

export default function Logo({ isMobile, onClick }: Props) {
  return (
    <div
      style={{ position: 'absolute', top: 'calc(24px + env(safe-area-inset-top))', left: 20, cursor: 'pointer', zIndex: 41, lineHeight: 1.1 }}
      onClick={onClick}
    >
      <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em' }}>Masterminds</div>
      <div style={{ fontSize: isMobile ? 10 : 11, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.04em', marginTop: 2 }}>by MARQ</div>
    </div>
  );
}
