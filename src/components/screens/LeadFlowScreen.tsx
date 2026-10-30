import { Suspense, useEffect, useState } from 'react';
import LeadFlowDashboard from './leadflow/LeadFlowDashboard';
import LeadFlowFinder from './leadflow/LeadFlowFinder';
import LeadFlowPool from './leadflow/LeadFlowPool';
import LeadFlowWarRoom from './leadflow/LeadFlowWarRoom';
import LeadFlowPlaybook from './leadflow/LeadFlowPlaybook';
import LeadFlowReport from './leadflow/LeadFlowReport';
import LeadFlowHistory from './leadflow/LeadFlowHistory';
import LeadFlowMessages from './leadflow/LeadFlowMessages';
import LeadFlowImport from './leadflow/LeadFlowImport';
import { LeadFlowCtx, useWidth } from './leadflow/layout';
import { useModule, PageEmbedded } from '../mm/Page';
import { PHONE_TAB_H } from '../shell/Shell';
import { lazyScreen } from '../../lib/lazyScreen';
import './leadflow/leadflow.css';

const DialingV2 = lazyScreen(() => import('./v2/DialingV2'));

// Internal ids are unchanged; labels and order follow the redesign.
type Tab = 'dashboard' | 'dialing' | 'warroom' | 'leadpool' | 'leads' | 'playbook' | 'report' | 'history' | 'messages' | 'import';
export type LeadFlowTab = Tab;

// War Room, Sales report, Messages and Import are hidden from the tab bar
// (Marq's cleanup, Oct 2026), not deleted: their screens still render if
// anything links to them, and adding the row back restores the tab.
const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  // Dialing lives inside LeadFlow (Oct 2026); the standalone module stays for non-owner accounts.
  { id: 'dialing', label: 'Dialing' },
  { id: 'leadpool', label: 'Lead pool' },
  { id: 'leads', label: 'Lead finder' },
  { id: 'playbook', label: 'Playbook' },
  { id: 'history', label: 'History' },
];

/** LeadFlow: the owner-only cold-calling CRM. Its own design system
 *  (leadflow.css); the Masterminds sidebar and top bar stay as they are. */
export default function LeadFlowScreen({ initialTab = 'dashboard' }: { initialTab?: Tab } = {}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const { device } = useModule();
  const phone = device === 'phone';
  const width = useWidth(root);
  const pad = phone ? 16 : 24;

  // Each tab opens at the top.
  useEffect(() => { document.getElementById('tour-content-panel')?.scrollTo({ top: 0 }); }, [tab]);

  return (
    <LeadFlowCtx.Provider value={{ width, headerSlot: slot, phone }}>
      <div ref={setRoot} className="leadflow" style={{ background: 'var(--lf-bg)', minHeight: '100%', display: 'flex', flexDirection: 'column', paddingBottom: phone ? `calc(${PHONE_TAB_H + 16}px + max(env(safe-area-inset-bottom), 20px))` : 0 }}>
        <header style={{ padding: `${phone ? 8 : 24}px ${pad}px 0` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: phone ? 22 : 24, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.2 }}>LeadFlow</h1>
              <div style={{ fontSize: 14, color: 'var(--lf-text-tertiary)', marginTop: 2 }}>Your CRM: owner research, the working pool, and the daily call session.</div>
            </div>
            <div ref={setSlot} style={{ display: 'flex', gap: 8, flex: 'none' }} />
          </div>
        </header>
        <nav className="lf-tabs" role="tablist" aria-label="LeadFlow" style={{ padding: `0 ${pad}px`, marginTop: phone ? 8 : 16, gap: phone ? 20 : 24 }}>
          {TABS.map((t) => (
            <button key={t.id} role="tab" className="lf-tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </nav>
        <main style={{ flex: 1, padding: `16px ${pad}px 32px`, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {tab === 'dashboard' && <LeadFlowDashboard onOpenFinder={() => setTab('leads')} />}
          {tab === 'dialing' && <PageEmbedded.Provider value={true}><Suspense fallback={null}><DialingV2 /></Suspense></PageEmbedded.Provider>}
          {tab === 'warroom' && <LeadFlowWarRoom />}
          {tab === 'leadpool' && <LeadFlowPool />}
          {tab === 'leads' && <LeadFlowFinder />}
          {tab === 'playbook' && <LeadFlowPlaybook />}
          {tab === 'report' && <LeadFlowReport />}
          {tab === 'history' && <LeadFlowHistory onOpenPool={() => setTab('leadpool')} />}
          {tab === 'messages' && <LeadFlowMessages />}
          {tab === 'import' && <LeadFlowImport />}
        </main>
      </div>
    </LeadFlowCtx.Provider>
  );
}
