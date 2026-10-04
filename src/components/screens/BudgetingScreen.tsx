import { useState } from 'react';
import { useBudgeting, currentMonthKey } from '../../data/useBudgeting';
import type { Device } from '../shell/Shell';
import BudgetOverview from './budget/BudgetOverview';
import BudgetTools from './budget/BudgetTools';
import { BackRow } from '../mm/Page';

/** Budgeting (design handoff: Budget): the overview, then the working tools. */
export default function BudgetingScreen({ device }: { device: Device }) {
  const budgeting = useBudgeting();
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: device === 'phone' ? 20 : 16 }}>
      {device === 'phone' && <div style={{ marginBottom: -20 }}><BackRow /></div>}
      <BudgetOverview device={device} b={budgeting} monthKey={monthKey} setMonthKey={setMonthKey} />
      <BudgetTools b={budgeting} monthKey={monthKey} />
    </div>
  );
}
