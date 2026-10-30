import { useEffect, useState } from 'react';
import LeadFlowDashboard from './leadflow/LeadFlowDashboard';
import LeadFlowFinder from './leadflow/LeadFlowFinder';
import LeadFlowPool from './leadflow/LeadFlowPool';
import LeadFlowWarRoom from './leadflow/LeadFlowWarRoom';
import LeadFlowPlaybook from './leadflow/LeadFlowPlaybook';
import LeadFlowReport from './leadflow/LeadFlowReport';
import LeadFlowHistory from './leadflow/LeadFlowHistory';
import LeadFlowMessages from './leadflow/LeadFlowMessages';
import LeadFlowImport from './leadflow/LeadFlowImport';
import LeadFlowCallList from './leadflow/LeadFlowCallList';
import { LeadFlowCtx, useWidth } from './leadflow/layout';
import { useModule } from '../mm/Page';
import { PHONE_TAB_H } from '../shell/Shell';
import './leadflow/leadflow.css';
import { useLeadEngines, LeadEnginesTab, ENGINE_TABS } from './madeby/LeadEnginesScreen';
import type { EngineTab } from './madeby/LeadEnginesScreen';

// Internal ids are unchanged; labels and order follow the redesign.
type LfTab = 'dashboard' | 'warroom' | 'leadpool' | 'leads' | 'playbook' | 'report' | 'history' | 'messages' | 'import';
export type Tab = LfTab | Exclude<EngineTab, 'import'>;

// LeadFlow is Made by's lead machine (Made by journey, Oct 2026): the pool
// and finder, then what used to be the separate Lead Engines screen —
// Engines (Client Finder + Complaint Scanner), Outreach, Import, Setup — with
// the Call list (the cold-call kit, ranked every morning) second, after the
// Dashboard — so finding, contacting and dialing leads is one place. War Room,
// Sales report and Messages stay hidden from the tab bar (Marq's cleanup,
// Oct 2026), not deleted: their screens still render if anything links to
// them. Engine tabs need the lead-engines module (owner) on top of LeadFlow.
const TABS: { id: Tab; label: string; engines?: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  // The cold-call kit (Growth Blueprint phase 1): ranked, with a $ leak estimate and opener per lead.
  { id: 'calls', label: 'Call list', engines: true },
  { id: 'leadpool', label: 'Pool' },
  { id: 'leads', label: 'Finder' },
  { id: 'engines', label: 'Engines', engines: true },
  { id: 'outreach', label: 'Outreach', engines: true },
  { id: 'import', label: 'Import' },
  { id: 'setup', label: 'Setup', engines: true },
  { id: 'playbook', label: 'Playbook' },
  { id: 'history', label: 'History' },
];
const ENGINE_TAB_IDS = new Set<string>(ENGINE_TABS);
const isTab = (v: string | null | undefined): v is Tab => !!v && (TABS.some((t) => t.id === v) || ['warroom', 'report', 'messages'].includes(v));

/** LeadFlow: the owner-only cold-calling CRM. Its own design system
 *  (leadflow.css); the Masterminds sidebar and top bar stay as they are.
 *  `initialTab` opens a tab directly (e.g. the old lead-engines route →
 *  'engines'); `engines` is whether this account can use Lead Engines. */
export default function LeadFlowScreen({ initialTab, onTabConsumed, engines = true }: { initialTab?: string | null; onTabConsumed?: () => void; engines?: boolean } = {}) {
  const [tab, setTab] = useState<Tab>(() => (isTab(initialTab) && (engines || !ENGINE_TAB_IDS.has(initialTab)) ? initialTab : 'dashboard'));
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const { device, nav } = useModule();
  const phone = device === 'phone';
  const width = useWidth(root);
  const pad = phone ? 16 : 24;
  const eng = useLeadEngines(engines);
  const tabs = TABS.filter((t) => engines || !t.engines);
  const badge = (id: Tab) => (id === 'outreach' ? eng.needs : id === 'calls' ? eng.calls : 0);
  useEffect(() => {
    if (!initialTab) return;
    if (isTab(initialTab) && (engines || !ENGINE_TAB_IDS.has(initialTab))) setTab(initialTab);
    onTabConsumed?.();
  }, [initialTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Each tab opens at the top.
  useEffect(() => { document.getElementById('tour-content-panel')?.scrollTo({ top: 0 }); }, [tab]);

  return (
    <LeadFlowCtx.Provider value={{ width, headerSlot: slot, phone }}>
      <div ref={setRoot} className="leadflow" style={{ background: 'var(--lf-bg)', minHeight: '100%', display: 'flex', flexDirection: 'column', paddingBottom: phone ? `calc(${PHONE_TAB_H + 16}px + max(env(safe-area-inset-bottom), 20px))` : 0 }}>
        <header style={{ padding: `${phone ? 8 : 24}px ${pad}px 0` }}>
          {phone && <button className="lf-btn lf-btn--ghost lf-btn--sm" onClick={() => nav('modules')} style={{ marginLeft: -10, marginBottom: 4, color: 'var(--lf-text-tertiary)' }}>‹ All modules</button>}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: phone ? 22 : 24, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.2 }}>LeadFlow</h1>
              <div style={{ fontSize: 14, color: 'var(--lf-text-tertiary)', marginTop: 2 }}>Find, contact and call leads: the pool, the finder, the engines and outreach, and the daily call list.</div>
            </div>
            <div ref={setSlot} style={{ display: 'flex', gap: 8, flex: 'none' }} />
          </div>
        </header>
        <nav className="lf-tabs" role="tablist" aria-label="LeadFlow" style={{ padding: `0 ${pad}px`, marginTop: phone ? 8 : 16, gap: phone ? 20 : 24 }}>
          {tabs.map((t) => (
            <button key={t.id} role="tab" className="lf-tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} style={{ whiteSpace: 'nowrap' }}>
              {t.label}{badge(t.id) > 0 && <span style={{ marginLeft: 6, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{badge(t.id)}</span>}
            </button>
          ))}
        </nav>
        <main style={{ flex: 1, padding: `16px ${pad}px 32px`, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {tab === 'dashboard' && <LeadFlowDashboard onOpenFinder={() => setTab('leads')} />}
          {tab === 'warroom' && <LeadFlowWarRoom />}
          {tab === 'leadpool' && <LeadFlowPool />}
          {tab === 'leads' && <LeadFlowFinder />}
          {tab === 'playbook' && <LeadFlowPlaybook />}
          {tab === 'report' && <LeadFlowReport />}
          {tab === 'history' && <LeadFlowHistory onOpenPool={() => setTab('leadpool')} />}
          {tab === 'messages' && <LeadFlowMessages />}
          {tab === 'import' && <LeadFlowImport />}
          {tab === 'import' && engines && <LeadEnginesTab tab="import" eng={eng} phone={phone} onTab={setTab} />}
          {(tab === 'engines' || tab === 'outreach' || tab === 'setup') && engines && <LeadEnginesTab tab={tab} eng={eng} phone={phone} onTab={setTab} />}
          {tab === 'calls' && engines && (
            <LeadFlowCallList phone={phone}>
              {(eng.out?.calls.length || eng.out?.bookings.length) ? <LeadEnginesTab tab="calls" eng={eng} phone={phone} onTab={setTab} /> : null}
            </LeadFlowCallList>
          )}
        </main>
      </div>
    </LeadFlowCtx.Provider>
  );
}
