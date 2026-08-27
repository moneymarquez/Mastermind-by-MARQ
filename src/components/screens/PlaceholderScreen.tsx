import Icon from '../../Icon';

interface Props {
  isMobile: boolean;
  label: string;
  note?: string;
}

export default function PlaceholderScreen({ isMobile, label, note }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingTop: isMobile ? 60 : 80 }}>
      <Icon name="circle-dashed" size={40} color="#3a3d43" style={{ marginBottom: 18 }} />
      <div style={{ fontSize: 'var(--text-title)', fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 'var(--text-label)', color: 'var(--text-secondary)', marginTop: 6, maxWidth: 420 }}>{note || 'This section is coming soon.'}</div>
    </div>
  );
}
