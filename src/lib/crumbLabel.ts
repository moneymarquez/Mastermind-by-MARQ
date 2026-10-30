import { useEffect, useSyncExternalStore } from 'react';

// A screen with its own tab bar can name the tab it is showing, so the top
// bar's crumb reads "Content › Accounts" instead of the module's sidebar
// name. Cleared when the screen unmounts.
let label: { screen: string; text: string } | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function useSetCrumbLabel(screen: string, text: string | null): void {
  useEffect(() => {
    label = text ? { screen, text } : null; emit();
    return () => { if (label?.screen === screen) { label = null; emit(); } };
  }, [screen, text]);
}
export function useCrumbLabel(screen: string): string | null {
  const v = useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => label);
  return v && v.screen === screen ? v.text : null;
}
