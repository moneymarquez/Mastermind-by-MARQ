import { useState } from 'react';
import type { CSSProperties } from 'react';
import LeadFlowDashboard from './leadflow/LeadFlowDashboard';
import LeadFlowFinder from './leadflow/LeadFlowFinder';
import LeadFlowPool from './leadflow/LeadFlowPool';
import LeadFlowWarRoom from './leadflow/LeadFlowWarRoom';
import LeadFlowPlaybook from './leadflow/LeadFlowPlaybook';
import LeadFlowReport from './leadflow/LeadFlowReport';
import LeadFlowHistory from './leadflow/LeadFlowHistory';
import LeadFlowMessages from './leadflow/LeadFlowMessages';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

type Tab = 'dashboard' | 'warroom' | 'leadpool' | 'leads' | 'playbook' | 'report' | 'history' | 'messages';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'warroom', label: 'War Room', icon: '⚔️' },
  { id: 'leadpool', label: 'Lead Pool', icon: '🎯' },
  { id: 'leads', label: 'Lead Finder', icon: '🔍' },
  { id: 'playbook', label: 'Pitch Playbook', icon: '📖' },
  { id: 'report', label: 'AI Sales Report', icon: '🤖' },
  { id: 'history', label: 'History', icon: '🕐' },
  { id: 'messages', label: 'Messages', icon: '💬' },
];

const GREEN = '#16a34a';

export default function LeadFlowScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const [tab, setTab] = useState<Tab>('dashboard');

  const panelStyle: CSSProperties = {
    background: '#fafafa',
    borderRadius: 20,
    border: '1px solid var(--border)',
    marginTop: 24,
    fontFamily: 'Inter, sans-serif',
    color: '#111',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 560,
  };

  const tabBarStyle: CSSProperties = {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    background: '#fff',
    borderBottom: '1px solid #f0f0f0',
    padding: '14px 20px',
    flexShrink: 0,
  };

  const bodyStyle: CSSProperties = tab === 'playbook'
    ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }
    : { flex: 1, minHeight: 0, overflowY: 'auto', padding: '2rem' };

  return (
    <div>
      <div style={homeHeadStyle}>LeadFlow</div>
      <div style={homeSubStyle}>Your own CRM — Dashboard, War Room, Lead Pool, Lead Finder, Pitch Playbook, AI reports, and more, live from your LeadFlow database.</div>

      <div style={panelStyle}>
        <div style={tabBarStyle}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9999,
                border: tab === t.id ? 'none' : '1px solid #e5e7eb',
                background: tab === t.id ? GREEN : '#fff',
                color: tab === t.id ? '#fff' : '#374151',
                cursor: 'pointer', fontSize: 13, fontWeight: tab === t.id ? 600 : 500, whiteSpace: 'nowrap',
              }}
            >
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        <div style={bodyStyle}>
          {tab === 'dashboard' && <LeadFlowDashboard onOpenFinder={() => setTab('leads')} />}
          {tab === 'warroom' && <LeadFlowWarRoom />}
          {tab === 'leadpool' && <LeadFlowPool />}
          {tab === 'leads' && <LeadFlowFinder />}
          {tab === 'playbook' && <LeadFlowPlaybook />}
          {tab === 'report' && <LeadFlowReport />}
          {tab === 'history' && <LeadFlowHistory />}
          {tab === 'messages' && <LeadFlowMessages />}
        </div>
      </div>
    </div>
  );
}
