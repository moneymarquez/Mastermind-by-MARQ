import type { CSSProperties } from 'react';
import Icon from '../../Icon';

interface StatCard {
  icon: string;
  value: string;
  caption: string;
  valueStyle: CSSProperties;
}

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
  statGridStyle: CSSProperties;
  statCards: StatCard[];
}

export default function HomeScreen({ homeHeadStyle, homeSubStyle, statGridStyle, statCards }: Props) {
  return (
    <div>
      <div style={homeHeadStyle}>Welcome back, Cristopher</div>
      <div style={homeSubStyle}>Here's where things stand today.</div>
      <div style={statGridStyle}>
        {statCards.map((card, i) => (
          <div key={i} style={{ background: '#14161A', border: '1px solid #22262B', borderRadius: 14, padding: 20, position: 'relative', minWidth: 0 }}>
            <Icon name={card.icon} size={18} color="#565b64" style={{ position: 'absolute', top: 16, right: 16 }} />
            <div style={card.valueStyle}>{card.value}</div>
            <div style={{ fontSize: 12.5, color: '#8A8F98', marginTop: 6 }}>{card.caption}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
