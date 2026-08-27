import type { CSSProperties, ReactElement } from 'react';
import Icon from '../Icon';
import { MODULE_REGISTRY } from '../modules.config';

interface Props {
  assistantName: string;
  selectedKeys: string[];
  onContinue: () => void;
  submitting: boolean;
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 18 };
const sectionTitle: CSSProperties = { fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--text)', marginBottom: 12 };

// Sample data is deliberately hardcoded here and nowhere else — this
// screen is the one explicitly-scoped exception to "no fake data" in the
// whole app: a guided preview meant to sell the product before payment,
// never a real route with real users' data. Nothing here reads or writes
// any table.
function DialingDemo() {
  const rows = [
    { name: 'Marcus Bell', outcome: 'Appointment set', time: '2:40 PM' },
    { name: 'Priya Shah', outcome: 'Call back Thursday', time: '2:12 PM' },
    { name: 'Dana Ruiz', outcome: 'Voicemail', time: '1:55 PM' },
  ];
  return (
    <div style={cardStyle}>
      <div style={sectionTitle}>Dialing — 14 / 40 calls today</div>
      {rows.map((r) => (
        <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--surface-3)', fontSize: 'var(--text-body-sm)' }}>
          <span style={{ color: 'var(--text)' }}>{r.name}</span>
          <span style={{ color: 'var(--text-secondary)' }}>{r.outcome}</span>
          <span style={{ color: 'var(--text-tertiary)' }}>{r.time}</span>
        </div>
      ))}
    </div>
  );
}

function SobrietyDemo() {
  return (
    <div style={cardStyle}>
      <div style={sectionTitle}>Sobriety</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>41 days</div>
      <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)', marginTop: 4 }}>Longest streak: 41 days — this is it.</div>
    </div>
  );
}

function BudgetingDemo() {
  const cats = [
    { name: 'Rent', spent: 1400, allocated: 1400 },
    { name: 'Groceries', spent: 310, allocated: 450 },
    { name: 'Marketing spend', spent: 210, allocated: 200 },
  ];
  return (
    <div style={cardStyle}>
      <div style={sectionTitle}>Budgeting — this month</div>
      {cats.map((c) => {
        const pct = Math.min(100, (c.spent / c.allocated) * 100);
        const over = c.spent > c.allocated;
        return (
          <div key={c.name} style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-small)' }}>
              <span style={{ color: 'var(--text)' }}>{c.name}</span>
              <span style={{ color: over ? 'var(--danger)' : 'var(--text-secondary)' }}>${c.spent} / ${c.allocated}</span>
            </div>
            <div style={{ height: 5, background: 'var(--border)', borderRadius: 'var(--radius-pill)', marginTop: 5 }}>
              <div style={{ height: '100%', width: `${pct}%`, background: over ? 'var(--danger)' : 'var(--text)', borderRadius: 'var(--radius-pill)' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GoalsDemo() {
  return (
    <div style={cardStyle}>
      <div style={sectionTitle}>Goals</div>
      <div style={{ fontSize: 'var(--text-body)', color: 'var(--text)', fontWeight: 600 }}>Hit $10k in monthly recurring revenue</div>
      <div style={{ height: 6, background: 'var(--border)', borderRadius: 'var(--radius-pill)', marginTop: 10 }}>
        <div style={{ height: '100%', width: '58%', background: 'var(--text)', borderRadius: 'var(--radius-pill)' }} />
      </div>
      <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: 6 }}>58% there, on pace for the Q4 deadline.</div>
    </div>
  );
}

function MacrosDemo() {
  return (
    <div style={cardStyle}>
      <div style={sectionTitle}>Macros & Meals — today</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>1,840 kcal</div>
      <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: 4 }}>142p / 180c / 60f — logged from 2 photos.</div>
    </div>
  );
}

function ScheduleDemo() {
  return (
    <div style={cardStyle}>
      <div style={sectionTitle}>Schedule — next up</div>
      <div style={{ fontSize: 'var(--text-body)', color: 'var(--text)' }}>2:30 PM — Client call, Riverside Detailing</div>
      <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)', marginTop: 4 }}>6:00 PM — Gym</div>
    </div>
  );
}

const DEMO_RENDERERS: Record<string, () => ReactElement> = {
  dialing: DialingDemo, sobriety: SobrietyDemo, budgeting: BudgetingDemo,
  goals: GoalsDemo, macros: MacrosDemo, schedule: ScheduleDemo,
};

function GenericDemo({ label, description }: { label: string; description: string }) {
  return (
    <div style={cardStyle}>
      <div style={sectionTitle}>{label}</div>
      <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{description}</div>
    </div>
  );
}

export default function PersonalizedDemo({ assistantName, selectedKeys, onContinue, submitting }: Props) {
  const selectedModules = MODULE_REGISTRY.filter((m) => selectedKeys.includes(m.key));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '40px 24px 140px' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <div style={{ fontSize: 'var(--text-stat)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em' }}>Masterminds by MARQ</div>
        <div style={{ fontSize: 'var(--text-body-lg)', color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.6, maxWidth: 560 }}>
          This is what your dashboard looks like, built out with {selectedModules.length} module{selectedModules.length === 1 ? '' : 's'} you picked.
          {' '}<strong style={{ color: 'var(--text)' }}>{assistantName}</strong> is already reading across all of it.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, marginTop: 32 }}>
          {selectedModules.map((m) => {
            const Renderer = DEMO_RENDERERS[m.key];
            return Renderer ? <Renderer key={m.key} /> : <GenericDemo key={m.key} label={m.label} description={m.description} />;
          })}
        </div>

        <div style={{ ...cardStyle, marginTop: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon name="sparkle" size={16} color="var(--warning)" />
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-quaternary)' }}>
            "Hey — {assistantName} here. I'll flag things before they become problems, not after. Ready when you are."
          </div>
        </div>
      </div>

      <div style={{ position: 'fixed', right: 32, bottom: 32 }}>
        <div
          onClick={() => !submitting && onContinue()}
          style={{
            width: 64, height: 64, borderRadius: '50%', background: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.6 : 1, boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          }}
          title="This is real — let's set it up"
        >
          <Icon name="arrow-up" size={22} color="var(--bg)" style={{ transform: 'rotate(90deg)' }} />
        </div>
      </div>
    </div>
  );
}
