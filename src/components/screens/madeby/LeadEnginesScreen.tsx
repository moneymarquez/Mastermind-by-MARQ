import { useCallback, useEffect, useState } from 'react';
import { Empty } from '../../mm/States';
import { api } from '../../../lib/api';
import EnginesTab from './engines/EnginesTab';
import OutreachTab from './engines/OutreachTab';
import CallListTab from './engines/CallListTab';
import ComplaintsTab from './engines/ComplaintsTab';
import ImportTab from './engines/ImportTab';
import SetupTab from './engines/SetupTab';
import type { EnginesState, OutreachState } from './engines/types';

/** Lead Engines (Addendum 6) — now tabs inside LeadFlow (Made by journey,
 *  Oct 2026): Client Finder and Complaint Scanner with on/off and daily
 *  budgets (Engines), the cold-email outreach, call list, the one-time
 *  scraper import and the booking-page setup. The old `lead-engines` route
 *  redirects to LeadFlow → Engines (data/madebyJourney.ts). */
export type EngineTab = 'engines' | 'outreach' | 'calls' | 'import' | 'setup';
export const ENGINE_TABS: EngineTab[] = ['engines', 'outreach', 'calls', 'import', 'setup'];

/** Loads engine + outreach state once for all the engine tabs. */
export function useLeadEngines(enabled: boolean) {
  const [st, setSt] = useState<EnginesState | null>(null);
  const [out, setOut] = useState<OutreachState | null>(null);
  const [err, setErr] = useState('');
  const [drafting, setDrafting] = useState(false);
  const loadEngines = useCallback(async () => { const r = await api<EnginesState>('/api/engines/state'); if (r.error) setErr(r.error); else { setErr(''); setSt(r); } }, []);
  const loadOut = useCallback(async () => { const r = await api<OutreachState>('/api/outreach/overview'); if (r.error) setErr(r.error); else setOut(r); }, []);
  useEffect(() => { if (enabled) { void loadEngines(); void loadOut(); } }, [enabled, loadEngines, loadOut]);
  const draft = async () => { setDrafting(true); await api('/api/outreach/draft', { body: { limit: 10 } }); setDrafting(false); await loadOut(); };
  const needs = out?.replies.filter((r) => r.action_state === 'needs_read' && !r.corrected_to).length ?? 0;
  return { st, setSt, out, err, drafting, draft, loadOut, needs, calls: out?.calls.length ?? 0 };
}

/** One engine tab's body. Engines shows both engines (Client Finder, then the Complaint Scanner). */
export function LeadEnginesTab({ tab, eng, phone, onTab }: { tab: EngineTab; eng: ReturnType<typeof useLeadEngines>; phone: boolean; onTab: (t: EngineTab) => void }) {
  const { st, setSt, out, err, drafting, draft, loadOut } = eng;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
      {err && <Empty text={err} />}
      {tab === 'engines' && st && <EnginesTab state={st} onState={setSt} onDraft={() => { void draft().then(() => onTab('outreach')); }} drafting={drafting} phone={phone} />}
      {tab === 'engines' && st && <ComplaintsTab state={st} onState={setSt} />}
      {tab === 'outreach' && out && <OutreachTab data={out} reload={() => void loadOut()} phone={phone} />}
      {tab === 'calls' && out && <CallListTab data={out} reload={() => void loadOut()} />}
      {tab === 'import' && <ImportTab />}
      {tab === 'setup' && out && <SetupTab data={out} reload={() => void loadOut()} />}
      {!err && ((tab === 'engines' && !st) || (['outreach', 'calls', 'setup'].includes(tab) && !out)) && <Empty text="Loading…" />}
    </div>
  );
}
