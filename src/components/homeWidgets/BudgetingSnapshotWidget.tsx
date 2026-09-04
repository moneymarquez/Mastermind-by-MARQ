import { useBudgeting, currentMonthKey } from '../../data/useBudgeting';
import type { HomeWidgetProps } from './types';
import { cardShell } from './types';

/** New in the widget-customization pass — off by default like the other
 *  new widgets. This month's income/expense/net at a glance, reusing
 *  useBudgeting's own getMonthSummary (same math the Budgeting screen
 *  itself uses) rather than recomputing anything here. */
export default function BudgetingSnapshotWidget({ onNavigate }: HomeWidgetProps) {
  const { loading, getMonthSummary } = useBudgeting();
  const summary = getMonthSummary(currentMonthKey());

  return (
    <div onClick={() => onNavigate('budgeting')} style={{ ...cardShell, padding: 20, gap: 14, cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: '-0.015em' }}>This month</div>
      </div>

      {loading ? (
        <div style={{ fontSize: 12.5, color: 'var(--mm-faint)' }}>Loading…</div>
      ) : (
        <>
          <div style={{ fontSize: 26, fontWeight: 600, fontFamily: 'var(--font-mono)', color: summary.net >= 0 ? 'var(--mm-text)' : 'var(--mm-faint)' }}>
            {summary.net >= 0 ? '+' : '−'}${Math.abs(Math.round(summary.net)).toLocaleString()}
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12.5 }}>
            <span style={{ color: 'var(--mm-faint)' }}>Income <span style={{ color: 'var(--mm-text)' }}>${Math.round(summary.totalIncome).toLocaleString()}</span></span>
            <span style={{ color: 'var(--mm-faint)' }}>Expenses <span style={{ color: 'var(--mm-text)' }}>${Math.round(summary.totalExpense).toLocaleString()}</span></span>
          </div>
        </>
      )}
    </div>
  );
}
