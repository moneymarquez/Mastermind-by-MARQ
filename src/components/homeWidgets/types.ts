import type { CSSProperties } from 'react';

/** Every Overview widget gets the same prop shape whether it needs all of
 *  these or not — a generic registry loop (HomeScreen.tsx) is what renders
 *  them, so a heterogeneous per-widget prop type would mean the loop can't
 *  be generic. Unused props are simply ignored by widgets that don't need
 *  them (e.g. MacrosWidget never touches onOpenNova). */
export interface HomeWidgetProps {
  isMobile: boolean;
  onNavigate: (screen: string) => void;
  onOpenNova: () => void;
  assistantName: string;
}

export const cardShell: CSSProperties = {
  borderRadius: 18, background: 'var(--mm-panel-solid)', border: '1px solid var(--mm-line)', display: 'flex', flexDirection: 'column', minHeight: 0,
};
