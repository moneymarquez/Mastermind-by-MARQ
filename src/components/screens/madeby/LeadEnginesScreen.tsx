import { useCallback, useEffect, useState } from 'react';
import { Page, Tabs, useModule } from '../../mm/Page';
import { Empty } from '../../mm/States';
import { api } from '../../../lib/api';
import EnginesTab from './engines/EnginesTab';
import OutreachTab from './engines/OutreachTab';
import CallListTab from './engines/CallListTab';
import ComplaintsTab from './engines/ComplaintsTab';
import ImportTab from './engines/ImportTab';
import SetupTab from './engines/SetupTab';
import type { EnginesState, OutreachState } from './engines/types';

type Tab = 'engines' | 'outreach' | 'calls' | 'complaints' | 'import' | 'setup';

/** Lead Engines (Addendum 6): Client Finder and Complaint Scanner with on/off and daily budgets, then the cold-email outreach, call list, booking page and the one-time import. */
export default function LeadEnginesScreen() {
  const phone = useModule().device === 'phone';
  const [tab, setTab] = useState<Tab>('engines');
  const [st, setSt] = useState<EnginesState | null>(null);
  const [out, setOut] = useState<OutreachState | null>(null);
  const [err, setErr] = useState('');
  const [drafting, setDrafting] = useState(false);
  const loadEngines = useCallback(async () => { const r = await api<EnginesState>('/api/engines/state'); if (r.error) setErr(r.error); else { setErr(''); setSt(r); } }, []);
  const loadOut = useCallback(async () => { const r = await api<OutreachState>('/api/outreach/overview'); if (r.error) setErr(r.error); else setOut(r); }, []);
  useEffect(() => { void loadEngines(); void loadOut(); }, [loadEngines, loadOut]);
  const draft = async () => { setDrafting(true); await api('/api/outreach/draft', { body: { limit: 10 } }); setDrafting(false); await loadOut(); setTab('outreach'); };
  const needs = out?.replies.filter((r) => r.action_state === 'needs_read' && !r.corrected_to).length ?? 0;
  return (
    <Page title="Lead Engines" sub="Two engines that find leads and complaints for you, each with its own on/off and daily budget." back="Made by Marq" backTo="modules">
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: 'engines', label: 'Engines' }, { id: 'outreach', label: 'Outreach', badge: needs || undefined }, { id: 'calls', label: 'Call list', badge: out?.calls.length || undefined }, { id: 'complaints', label: 'Complaints' }, { id: 'import', label: 'Import' }, { id: 'setup', label: 'Setup' }]} />
      {err && <Empty text={err} />}
      {tab === 'engines' && st && <EnginesTab state={st} onState={setSt} onDraft={() => void draft()} drafting={drafting} phone={phone} />}
      {tab === 'outreach' && out && <OutreachTab data={out} reload={() => void loadOut()} phone={phone} />}
      {tab === 'calls' && out && <CallListTab data={out} reload={() => void loadOut()} />}
      {tab === 'complaints' && st && <ComplaintsTab state={st} onState={setSt} />}
      {tab === 'import' && <ImportTab />}
      {tab === 'setup' && out && <SetupTab data={out} reload={() => void loadOut()} />}
      {!err && ((['engines', 'complaints'].includes(tab) && !st) || (['outreach', 'calls', 'setup'].includes(tab) && !out)) && <Empty text="Loading…" />}
    </Page>
  );
}
