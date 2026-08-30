import { buildNavData } from './data';

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

const SUB_SCREEN_BY_LABEL: Record<string, string> = {
  Notifications: 'notification-settings',
  Account: 'account-settings',
  'Prompt & Voice': 'prompt-voice-settings',
  'Manage modules': 'manage-modules',
  'Grant Access': 'grant-access',
  'Legal & FAQ': 'legal',
};

export function buildNavRows(
  screen: string,
  settingsExpanded: boolean,
  navigateTo: (id: string) => void,
  onSignOut: () => void,
  canAccess: (moduleKey: string) => boolean,
  isOwner: boolean
): NavRow[] {
  const rows: NavRow[] = [];
  buildNavData(canAccess, isOwner).forEach((g) => {
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
          const targetScreen = SUB_SCREEN_BY_LABEL[label];
          rows.push({
            kind: 'sub',
            key: `sub-${label}`,
            label,
            onClick: label === 'Sign Out' ? onSignOut : targetScreen ? () => navigateTo(targetScreen) : undefined,
          });
        });
      }
    });
  });
  return rows;
}
