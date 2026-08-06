import Icon from '../../Icon';

interface Props {
  dialCount: number;
  dialGoal: number;
  onLogCall: () => void;
}

export default function DialingScreen({ dialCount, dialGoal, onLogCall }: Props) {
  return (
    <div>
      <div style={{ fontSize: 32, fontWeight: 600, color: '#F5F6F7', letterSpacing: '-0.01em' }}>Dialing</div>
      <div style={{ fontSize: 14, color: '#8A8F98', marginTop: 6 }}>Today's session</div>
      <div style={{ background: '#14161A', border: '1px solid #22262B', borderRadius: 14, padding: 32, marginTop: 28, maxWidth: 420 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 44, fontWeight: 600, color: '#F5F6F7' }}>
          {dialCount} <span style={{ fontSize: 22, color: '#565b64' }}>/ {dialGoal}</span>
        </div>
        <div style={{ height: 8, background: '#22262B', borderRadius: 999, marginTop: 18, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, (dialCount / dialGoal) * 100)}%`, background: '#F5F6F7', borderRadius: 999 }} />
        </div>
        <div
          style={{ display: 'inline-flex', alignItems: 'center', marginTop: 22, padding: '10px 18px', borderRadius: 999, border: '1px solid #F5F6F7', color: '#F5F6F7', fontSize: 13, cursor: 'pointer' }}
          onClick={onLogCall}
        >
          <Icon name="phone-call" style={{ marginRight: 8 }} color="#F5F6F7" />
          Log a call
        </div>
      </div>
    </div>
  );
}
