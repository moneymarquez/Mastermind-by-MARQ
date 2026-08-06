import Icon from '../Icon';

interface Props {
  isMobile: boolean;
}

const REMINDERS = ['Call Priya back re: contract', 'Renew LLC filing — due Fri'];

export default function RemindersBox({ isMobile }: Props) {
  return (
    <div
      style={{
        position: 'absolute', right: 20, bottom: 20, width: isMobile ? 180 : 210,
        background: '#14161A', border: '1px solid #22262B', borderRadius: 14, padding: '14px 16px', zIndex: 20,
      }}
    >
      <div style={{ fontSize: 11.5, fontWeight: 600, color: '#8A8F98', display: 'flex', alignItems: 'center' }}>
        <Icon name="bell" style={{ marginRight: 6 }} color="#8A8F98" />
        Reminders
      </div>
      {REMINDERS.map((text) => (
        <div key={text} style={{ fontSize: 12, color: '#C7CAD1', padding: '6px 0', borderTop: '1px solid #1c1e23' }}>
          {text}
        </div>
      ))}
    </div>
  );
}
