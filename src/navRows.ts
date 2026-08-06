import { NAV_DATA } from './data';

export interface NavRow {
  kind: 'header' | 'item' | 'sub';
  key: string;
  label: string;
  icon?: string;
  active?: boolean;
  collapsible?: boolean;
  expanded?: boolean;
  onClick?: () => void;
}

export function buildNavRows(screen: string, settingsExpanded: boolean, navigateTo: (id: string) => void): NavRow[] {
  const rows: NavRow[] = [];
  NAV_DATA.forEach((g) => {
    if (g.group) {
      rows.push({ kind: 'header', key: `header-${g.group}`, label: g.group });
    }
    g.items.forEach((it) => {
      const active = screen === it.id;
      rows.push({
        kind: 'item',
        key: it.id,
        label: it.label,
        icon: it.icon,
        active,
        collapsible: it.collapsible,
        expanded: it.collapsible && it.id === 'settings' ? settingsExpanded : false,
        onClick: () => navigateTo(it.id),
      });
      if (it.collapsible && it.id === 'settings' && settingsExpanded) {
        (it.sub || []).forEach((label) => {
          rows.push({ kind: 'sub', key: `sub-${label}`, label });
        });
      }
    });
  });
  return rows;
}
