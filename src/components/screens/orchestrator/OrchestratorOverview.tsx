import Card from '../../mm/Card';
import Stat from '../../mm/Stat';
import Chip from '../../mm/Chip';
import { Page, useModule } from '../../mm/Page';
import PortalCards from '../home/PortalCards';
import TrustTrendCard from './TrustTrendCard';
import ClaudeInboxCard from './ClaudeInboxCard';
import { useToday } from '../../../data/useToday';
import { portalLanding } from '../../../portals.config';
import type { PortalKey } from '../../../portals.config';

const usd = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const PORTAL_OF: Record<string, string> = { ecom: 'E-commerce', ecommerce: 'E-commerce', content: 'Content', marketing: 'Made by', madeby: 'Made by', master: 'HQ' };

/** Orchestrator's landing: every business at a glance (Made by, E-commerce,
 *  Content, and Government Contracts once it's built), money in vs AI spend
 *  this week, problems, and what's waiting. Each card opens its portal; the
 *  tools that run the system live in the sidebar under Command, Financial
 *  and Growth. */
export default function OrchestratorOverview() {
  const { device, nav } = useModule();
  const phone = device === 'phone';
  const t = useToday();
  const businesses: PortalKey[] = ['madeby', 'ecommerce', 'content'];
  const b = t.board;

  return (
    <Page title="Orchestrator" sub="Every business at a glance. Open one to work it." back="Today" backTo="today"
      right={{ t: 'HQ', onClick: () => nav('hq') }}>
      <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr 1fr' : 'repeat(4,minmax(0,1fr))', gap: 12 }}>
        <Stat hero label="Money in · this week" value={b ? usd(b.totalIn) : '…'} pill={b ? `Net ${usd(b.net)}` : undefined} k={b && b.net > 0 ? 'good' : 'neutral'} />
        <Stat label="AI spend · this week" value={b ? usd(b.totalSpend) : '…'} pill="All workers" />
        <Stat label="Waiting on you" value={String(t.approvals.length)} pill="Approvals" k={t.approvals.length ? 'warn' : 'neutral'} onClick={() => nav('today')} />
        <Stat label="Problems" value={String(t.flags.length)} pill={t.flags.length ? 'Fix in HQ' : 'All clear'} k={t.flags.length ? 'bad' : 'good'} onClick={() => nav('hq')} />
      </div>

      <PortalCards portals={businesses} phone={phone} onOpen={(k) => nav(portalLanding(k))} />

      <Card title="Office & Classroom" meta="Live" action={<button className="mm-btn mm-btn--primary" style={{ height: 32 }} onClick={() => nav('board')}>Open</button>}>
        <span style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Every worker at their desk (or waving a flag at you), and every workstream in Phase 1–5 with what's waiting on you first.
        </span>
      </Card>

      <Card title="GovCon" meta="Learning phase" action={<button className="mm-btn mm-btn--primary" style={{ height: 32 }} onClick={() => nav('govcon')}>Open</button>}>
        <span style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Three public contracts a day: read them, quiz yourself on who they hit and how, write your prediction, and check it at 30 and 90 days. Winners can go straight to LeadFlow.
        </span>
      </Card>

      <ClaudeInboxCard />

      <TrustTrendCard />

      {b && b.rows.some((r) => r.moneyIn || r.aiSpend) && (
        <Card title="By business, this week" meta={`Net ${usd(b.net)}`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) repeat(3,minmax(0,1fr))', gap: '8px 10px', fontSize: 14 }}>
            {['', 'In', 'AI spend', 'Net'].map((h) => <span key={h} style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: h ? 'right' : 'left' }}>{h}</span>)}
            {b.rows.filter((r) => r.moneyIn || r.aiSpend).map((r) => [
              <span key={`${r.portal}-n`}>{r.portal}</span>,
              <span key={`${r.portal}-i`} style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{usd(r.moneyIn)}</span>,
              <span key={`${r.portal}-s`} style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{usd(r.aiSpend)}</span>,
              <span key={`${r.portal}-t`} style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: r.net < 0 ? 'var(--danger)' : 'var(--text)' }}>{usd(r.net)}</span>,
            ])}
          </div>
        </Card>
      )}

      {t.flags.length > 0 && (
        <Card title="Problems" meta={String(t.flags.length)} action={<button className="mm-btn" style={{ height: 32 }} onClick={() => nav('hq')}>Open HQ</button>}>
          {t.flags.map((f) => (
            <div key={f.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 14 }}>
              <Chip k="bad">{PORTAL_OF[f.domain] ?? f.domain}</Chip>
              <span style={{ flex: 1, minWidth: 0 }}>{f.message.split('\n')[0]}</span>
            </div>
          ))}
        </Card>
      )}
    </Page>
  );
}
