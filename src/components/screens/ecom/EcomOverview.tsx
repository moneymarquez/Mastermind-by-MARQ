import type { Brand } from '../../../data/ecom';
import { STEPS, stepStatus, nextStep, deriveHealth, HEALTH_LABEL } from '../../../data/ecom';
import type { Approval } from '../../../data/useEcom';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import type { ChipKind } from '../../mm/Chip';
import Row from '../../mm/Row';
import Stat from '../../mm/Stat';
import { useModule } from '../../mm/Page';

const usd = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const HK: Record<string, ChipKind> = { building: 'accent', testing: 'warn', growing: 'good', stalled: 'warn', killed: 'neutral' };

/** The E-commerce dashboard (design handoff: MM Wide): revenue and orders
 *  over 30 days from real orders, brands by health, approvals waiting,
 *  and the most active brand's 10-step pipeline. */
export default function EcomOverview({ brands, orders30d, approvals, onOpenBrand, onOpenApprovals }: {
  brands: Brand[]; orders30d: Record<string, { count: number; total: number }>; approvals: Approval[];
  onOpenBrand: (id: string) => void; onOpenApprovals: () => void;
}) {
  const { device, novaOpen } = useModule();
  const phone = device === 'phone';
  const now = new Date();
  const all = Object.values(orders30d);
  const revenue = all.reduce((s, o) => s + o.total, 0);
  const orders = all.reduce((s, o) => s + o.count, 0);
  const pending = approvals.filter((a) => a.status === 'pending');
  const health = (b: Brand) => deriveHealth(b, orders30d[b.id]?.count ?? 0, now);
  const live = brands.filter((b) => health(b) !== 'killed');
  const focus = live[0] ?? null; // brands arrive sorted by last activity
  const cur = focus ? nextStep(focus) : 0;

  const stats = [
    <Stat key="r" label="Revenue · 30 days" value={usd(revenue)} pill={brands.length > 1 ? 'All brands' : 'From orders'} k={revenue > 0 ? 'good' : 'neutral'} />,
    <Stat key="o" label="Orders · 30 days" value={String(orders)} pill={orders ? `${usd(revenue / orders)} average` : 'None yet'} />,
    <Stat key="b" label="Brands" value={String(live.length)} pill={live.length ? `${live.filter((b) => health(b) === 'growing').length} growing` : 'Start one'} />,
    <Stat key="w" label="Waiting on you" value={String(pending.length)} pill="Approvals" k={pending.length ? 'warn' : 'neutral'} onClick={onOpenApprovals} />,
  ];

  const pipeline = focus && (
    <Card title={focus.name} meta={`Step ${cur} of 10`} wide={!phone}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {STEPS.map((s, i) => {
          const st = stepStatus(focus, s.n), now_ = s.n === cur, done = st === 'done';
          return (
            <div key={s.n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minHeight: 30 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', alignSelf: 'stretch', width: 12 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', marginTop: 4, flex: 'none', background: done ? 'var(--accent)' : now_ ? 'var(--surface)' : 'var(--surface-3)', border: now_ ? '2px solid var(--accent)' : 'none', boxSizing: 'border-box' }} />
                {i < STEPS.length - 1 && <span style={{ flex: 1, width: 2, background: done ? 'var(--accent)' : 'var(--surface-3)' }} />}
              </div>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', gap: 8, paddingBottom: 8, minWidth: 0 }}>
                <span style={{ fontSize: 14, color: done || now_ ? 'var(--text)' : 'var(--text-tertiary)', fontWeight: now_ ? 600 : 400 }}>{s.title}</span>
                {now_ && <Chip k={st === 'waiting' ? 'warn' : 'accent'}>{st === 'waiting' ? 'Waiting on you' : 'Now'}</Chip>}
              </div>
            </div>
          );
        })}
      </div>
      <button className="mm-btn" style={{ height: 40 }} onClick={() => onOpenBrand(focus.id)}>Open {focus.name}</button>
    </Card>
  );
  const approvalCard = (
    <Card title="Approvals" meta={String(pending.length)} flush wide={!phone}>
      {pending.length ? <div>{pending.slice(0, 4).map((a, n) => <Row key={a.id} first={n === 0} name={a.title} chip={a.is_money ? 'Money · needs you' : 'Needs approval'} k="warn" amt={a.amount_usd != null ? usd(a.amount_usd) : undefined} onClick={onOpenApprovals} />)}</div>
        : <div style={{ padding: '10px 0 14px', fontSize: 14, color: 'var(--text-tertiary)' }}>Nothing waiting. Workers queue anything with money or a public face here first.</div>}
      {pending.length > 0 && <button className="mm-btn mm-btn--primary" style={{ margin: '4px 0 14px', height: 40 }} onClick={onOpenApprovals}>Review all</button>}
    </Card>
  );
  const brandCard = (
    <Card title="Brands" meta={String(brands.length)} flush wide={!phone}>
      {brands.length ? <div>{brands.slice(0, 5).map((b, n) => { const h = health(b); return <Row key={b.id} first={n === 0} name={b.name} meta={`Step ${nextStep(b)} of 10`} chip={HEALTH_LABEL[h]} k={HK[h]} amt={orders30d[b.id]?.total ? usd(orders30d[b.id].total) : undefined} onClick={() => onOpenBrand(b.id)} />; })}</div>
        : <div style={{ padding: '10px 0 14px', fontSize: 14, color: 'var(--text-tertiary)' }}>No brands yet.</div>}
    </Card>
  );

  if (phone) return <><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{stats[0]}{stats[3]}</div>{approvalCard}{pipeline}</>;
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>{stats}</div>
      <div style={{ display: 'grid', gridTemplateColumns: device === 'desktop' && !novaOpen ? 'repeat(3,minmax(0,1fr))' : 'repeat(2,minmax(0,1fr))', gap: 16, alignItems: 'start' }}>
        {pipeline}{approvalCard}{brandCard}
      </div>
    </>
  );
}
