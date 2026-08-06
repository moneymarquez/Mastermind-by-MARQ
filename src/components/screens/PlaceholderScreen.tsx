import Icon from '../../Icon';

interface Props {
  isMobile: boolean;
  label: string;
}

export default function PlaceholderScreen({ isMobile, label }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingTop: isMobile ? 60 : 80 }}>
      <Icon name="circle-dashed" size={40} color="#3a3d43" style={{ marginBottom: 18 }} />
      <div style={{ fontSize: 20, fontWeight: 600, color: '#F5F6F7', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 14, color: '#8A8F98', marginTop: 6 }}>This section is coming soon.</div>
    </div>
  );
}
