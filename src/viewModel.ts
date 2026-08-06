import type { CSSProperties } from 'react';
import { STATUS_COLORS } from './data';
import { computeGeometry } from './geometry';
import { buildNavRows } from './navRows';
import type { AppState } from './state';
import type { Lead } from './types';

export function buildViewModel(state: AppState, navigateTo: (id: string) => void) {
  const s = state;
  const dir = s.direction;
  const isMobile = s.device === 'mobile';
  const geo = computeGeometry(s, isMobile);
  const { circleSize, stageWidth, stageHeight, groupBloomItems, itemBloomItems, boxLeft, boxTop, boxW, boxH, cx, cy } = geo;

  const navRows = buildNavRows(s.screen, s.settingsExpanded, navigateTo);

  const contentStyle: CSSProperties = {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    overflowY: 'auto',
    padding: isMobile ? `${circleSize + 36}px 20px 140px` : `100px 40px 60px ${circleSize + 64}px`,
  };

  const homeHeadStyle: CSSProperties = { fontSize: isMobile ? 24 : 32, fontWeight: 600, color: '#F5F6F7', letterSpacing: '-0.01em' };
  const homeSubStyle: CSSProperties = { fontSize: 14, color: '#8A8F98', marginTop: 6 };

  const statDefs = [
    { icon: 'ph-phone-call', value: `${s.dialCount} / ${s.dialGoal}`, caption: "Today's call goal" },
    { icon: 'ph-heart', value: '128 days', caption: 'Sobriety streak' },
    { icon: 'ph-fork-knife', value: '1,840 kcal', caption: "Today's macros" },
    { icon: 'ph-flame', value: 'Priya Nandan', caption: 'Hottest lead · $12,000' },
    { icon: 'ph-calendar-blank', value: '2:30 PM', caption: 'Reyes Fuel Stop call' },
  ];
  const statCards = statDefs.map((d) => ({
    icon: d.icon,
    value: d.value,
    caption: d.caption,
    valueStyle: {
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: d.value.length > 10 ? 20 : 26,
      fontWeight: 600,
      color: '#F5F6F7',
      marginTop: 8,
    } as CSSProperties,
  }));
  const statGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16,
    marginTop: 28,
  };

  const filterChips = ['All', 'New', 'Contacted', 'Qualified', 'Closed'];

  const filteredLeads = s.leads
    .filter((l) => s.leadFilter === 'All' || l.status === s.leadFilter)
    .map((l) => {
      const sc = STATUS_COLORS[l.status as keyof typeof STATUS_COLORS];
      return {
        ...l,
        valueDisplay: l.value ? `$${l.value.toLocaleString()}` : '—',
        statusStyle: {
          fontSize: 11.5, padding: '4px 10px', borderRadius: 999,
          border: `1px solid ${sc.border}`, background: sc.bg, color: sc.color,
          fontWeight: 500, justifySelf: 'start',
        } as CSSProperties,
      };
    });

  const selectedLeadRaw: Lead = s.leads.find((l) => l.id === s.selectedLeadId) || s.leads[0];
  const scSel = STATUS_COLORS[selectedLeadRaw.status as keyof typeof STATUS_COLORS];
  const selectedLead = {
    ...selectedLeadRaw,
    valueDisplay: selectedLeadRaw.value ? `$${selectedLeadRaw.value.toLocaleString()}` : '—',
    statusStyle: {
      fontSize: 12, padding: '4px 12px', borderRadius: 999,
      border: `1px solid ${scSel.border}`, background: scSel.bg, color: scSel.color, fontWeight: 500,
    } as CSSProperties,
  };

  const dirCaptions: Record<number, string> = {
    1: 'Direction 1 — compact core: smaller circle, tighter bloom.',
    2: 'Direction 2 — bold core: larger circle, widest bloom spread.',
    3: 'Direction 3 — balanced core: medium circle and bloom.',
  };

  return {
    isMobile, dir, geo,
    navRows,
    contentStyle,
    homeHeadStyle, homeSubStyle,
    statCards, statGridStyle,
    filterChips, filteredLeads, selectedLead,
    dirCaptions,
    stageWidth, stageHeight, circleSize,
    bloomArea: {
      left: cx + circleSize / 2 + boxLeft,
      top: cy + circleSize / 2 + boxTop,
      width: boxW,
      height: boxH,
    },
    groupBloomItems, itemBloomItems,
    cx, cy,
  };
}
