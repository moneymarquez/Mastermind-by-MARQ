import type { ComponentType } from 'react';
import KpiTilesWidget from '../components/homeWidgets/KpiTilesWidget';
import MacrosWidget from '../components/homeWidgets/MacrosWidget';
import ScheduleWidget from '../components/homeWidgets/ScheduleWidget';
import NovaWidget from '../components/homeWidgets/NovaWidget';
import GoalsProgressWidget from '../components/homeWidgets/GoalsProgressWidget';
import CrmPipelineWidget from '../components/homeWidgets/CrmPipelineWidget';
import BudgetingSnapshotWidget from '../components/homeWidgets/BudgetingSnapshotWidget';
import type { HomeWidgetProps } from '../components/homeWidgets/types';

export type HomeWidgetKey = 'kpi-tiles' | 'macros' | 'schedule' | 'nova' | 'goals' | 'crm-pipeline' | 'budgeting';

export interface HomeWidgetDef {
  key: HomeWidgetKey;
  label: string;
  description: string;
  /** 'full' widgets always take their own full-width row (only kpi-tiles
   *  today). 'column' widgets flow into the desktop 3-column body (in
   *  their visible/ordered sequence) and stack single-column on mobile. */
  layout: 'full' | 'column';
  ownerOnly?: boolean;
  /** Off until the account has actually turned it on once from Edit
   *  widgets (see useHomeWidgetPrefs' `known` set) — for widgets added
   *  after the original fixed layout shipped, so nobody's Overview
   *  changes just because a new option became available. */
  defaultHidden?: boolean;
  Component: ComponentType<HomeWidgetProps>;
}

/** The Overview screen's widget catalog — what CAN show up on Home.
 *  home_widget_prefs (useHomeWidgetPrefs) layers each account's own
 *  visibility/order on top of this; with no prefs saved yet, every
 *  account sees exactly the original fixed layout: the four widgets
 *  from the pre-widget-system HomeScreen, in this order, and none of
 *  the three added below (they're defaultHidden). */
export const HOME_WIDGET_REGISTRY: HomeWidgetDef[] = [
  { key: 'kpi-tiles', label: 'Stat tiles', description: 'Call goal, sobriety streak, workouts, macros, leads, next event.', layout: 'full', Component: KpiTilesWidget },
  { key: 'macros', label: 'Macros today', description: 'Calorie ring, macro bars, last meals logged.', layout: 'column', Component: MacrosWidget },
  { key: 'schedule', label: "Today's schedule + dial pace", description: "Today's events and your last 7 days of calls.", layout: 'column', Component: ScheduleWidget },
  { key: 'nova', label: 'Nova', description: 'Proactive nudges and a shortcut into Nova chat.', layout: 'column', Component: NovaWidget },
  { key: 'goals', label: 'Goals progress', description: 'Your active goals and how close each one is.', layout: 'column', defaultHidden: true, Component: GoalsProgressWidget },
  { key: 'crm-pipeline', label: 'Client CRM pipeline', description: 'How many clients are in each stage right now.', layout: 'column', ownerOnly: true, defaultHidden: true, Component: CrmPipelineWidget },
  { key: 'budgeting', label: 'This month (Budgeting)', description: 'Income, expenses, and net for the current month.', layout: 'column', defaultHidden: true, Component: BudgetingSnapshotWidget },
];

export const DEFAULT_HOME_WIDGET_ORDER: HomeWidgetKey[] = HOME_WIDGET_REGISTRY.map((w) => w.key);

/** A widget is visible when it's not explicitly hidden, AND (if it's
 *  defaultHidden) the account has touched it at least once — `known`
 *  distinguishes "never saved a row" from "saved hidden:false", both of
 *  which read the same from `hidden` alone. */
export function isWidgetVisible(w: HomeWidgetDef, hidden: Set<string>, known: Set<string>): boolean {
  if (hidden.has(w.key)) return false;
  if (w.defaultHidden && !known.has(w.key)) return false;
  return true;
}
