import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Campaign } from '../../../data/useCampaigns';
import { fetchDialingResults } from '../../../data/useCampaigns';
import type { DialingResults, ManualResults } from '../../../data/campaignBuilder';
import { METRIC_LABEL, actualForMetric } from '../../../data/campaignBuilder';
import RollingText from '../../fx/RollingText';
import { cardStyle, inputStyle, labelStyle, primaryBtn } from './CampaignStepCard';

/** Leads called from the Dialing queue also count — same rule as the
 *  Dialing counter. Pure so the merge can be checked without a browser. */
export function dialingResultsFromLeads(leads: { last_called_at: string | null; status: string | null }[], startDate: string): Pick<DialingResults, 'dials' | 'conversations'> {
  const start = new Date(`${startDate}T00:00:00`).getTime();
  const called = leads.filter((l) => l.last_called_at && new Date(l.last_called_at).getTime() >= start);
  return {
    dials: called.length,
    conversations: called.filter((l) => ['callback', 'interested', 'not_interested', 'client'].includes(l.status ?? '')).length,
  };
}

interface Props {
  campaign: Campaign;
  leadQueue: { last_called_at: string | null; status: string | null }[];
  onSave: (results: ManualResults) => Promise<void>;
  onAutoLoaded?: (auto: DialingResults | null) => void;
  onMarkDone?: () => void;
}

const NUM_FIELDS: { key: keyof ManualResults; label: string }[] = [
  { key: 'spend', label: 'Spend ($)' }, { key: 'leads', label: 'Leads' }, { key: 'calls', label: 'Calls / conversations' },
  { key: 'appointments', label: 'Appointments' }, { key: 'closes', label: 'Closes' }, { key: 'revenue', label: 'Revenue ($)' },
];

/** Results, two ways. Manual: what ran, what it cost, what came back.
 *  Automatic (internal cold calling): dials, conversations, appointments
 *  and closes read from Dialing's own outcomes and the CRM — the user
 *  owns that data, so no integration stands between it and this panel.
 *  External platforms (Meta etc.) will fill the same fields later. */
export default function CampaignResults({ campaign, leadQueue, onSave, onAutoLoaded, onMarkDone }: Props) {
  const [draft, setDraft] = useState<ManualResults>(campaign.results ?? {});
  const [saving, setSaving] = useState(false);
  const [auto, setAuto] = useState<DialingResults | null>(null);
  const [autoLoading, setAutoLoading] = useState(false);
  const isAuto = campaign.results_source === 'internal_dialing' && !!campaign.start_date;

  useEffect(() => { setDraft(campaign.results ?? {}); }, [campaign.id, campaign.results]);

  useEffect(() => {
    if (!isAuto || !campaign.start_date) { setAuto(null); onAutoLoaded?.(null); return; }
    let live = true;
    setAutoLoading(true);
    fetchDialingResults(campaign.start_date, campaign.end_date).then((r) => {
      if (!live) return;
      const fromLeads = dialingResultsFromLeads(leadQueue, campaign.start_date!);
      const merged = { ...r, dials: r.dials + fromLeads.dials, conversations: r.conversations + fromLeads.conversations };
      setAuto(merged);
      onAutoLoaded?.(merged);
      setAutoLoading(false);
    }).catch(() => { if (live) { setAutoLoading(false); } });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id, campaign.start_date, campaign.end_date, isAuto, leadQueue.length]);

  const actual = actualForMetric(campaign.target_metric, draft, auto);
  const target = campaign.target_value;
  const tile: CSSProperties = { flex: '1 1 110px', padding: '12px 14px', borderRadius: 'var(--radius-lg)', background: 'var(--surface-2)', border: '1px solid var(--border)' };
  const num: CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 600, color: 'var(--text)' };

  const save = async () => {
    setSaving(true);
    const cleaned: ManualResults = { what_ran: draft.what_ran?.trim() || undefined };
    for (const f of NUM_FIELDS) {
      const v = draft[f.key];
      if (v !== undefined && v !== null && String(v) !== '') (cleaned as Record<string, unknown>)[f.key] = Number(v);
    }
    await onSave(cleaned);
    setSaving(false);
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 'var(--text-head)', fontWeight: 700, color: 'var(--text)' }}>Results</div>
        {campaign.target_metric && (
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)' }}>
            Target: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{target ?? '—'}</span> {METRIC_LABEL[campaign.target_metric] ?? campaign.target_metric}
            {actual !== null && <> · so far <span style={{ fontFamily: 'var(--font-mono)', color: actual >= (target ?? Infinity) ? 'var(--success)' : 'var(--text)' }}>{actual}</span></>}
          </div>
        )}
      </div>

      {isAuto && (
        <div style={{ marginTop: 14 }}>
          <div style={{ ...labelStyle, marginBottom: 8 }}>From Dialing, since {campaign.start_date}{campaign.end_date ? ` to ${campaign.end_date}` : ''} · automatic</div>
          {autoLoading && !auto && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>Reading call outcomes…</div>}
          {auto && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                { label: 'Dials', v: auto.dials }, { label: 'Conversations', v: auto.conversations },
                { label: 'Appointments', v: auto.appointments }, { label: 'Closes (sent to CRM)', v: auto.closes }, { label: 'Calling days', v: auto.days },
              ].map((t) => (
                <div key={t.label} style={tile}>
                  <div style={num}><RollingText text={String(t.v)} /></div>
                  <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: 2 }}>{t.label}</div>
                </div>
              ))}
            </div>
          )}
          {auto && auto.dials === 0 && <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 8 }}>Nothing logged on the Dialing screen since the start date yet. Outcomes you log there show up here on their own.</div>}
        </div>
      )}

      <div style={{ ...labelStyle, marginTop: 16, marginBottom: 8 }}>{isAuto ? 'Add by hand — cost, revenue, anything Dialing can\'t see' : 'Log by hand'}</div>
      <input
        style={{ ...inputStyle, width: '100%' }}
        placeholder="What ran (e.g. 8 calling sessions, 2 texts to the list)"
        value={draft.what_ran ?? ''}
        onChange={(e) => setDraft((d) => ({ ...d, what_ran: e.target.value }))}
      />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
        {NUM_FIELDS.map((f) => (
          <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 110px', minWidth: 110 }}>
            <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)' }}>{f.label}</span>
            <input
              style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
              type="number"
              inputMode="decimal"
              value={draft[f.key] === undefined || draft[f.key] === null ? '' : String(draft[f.key])}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value === '' ? undefined : Number(e.target.value) }))}
            />
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <button style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save results'}</button>
        {onMarkDone && campaign.status === 'running' && (
          <button style={{ ...primaryBtn, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-2)' }} onClick={onMarkDone}>Mark campaign done</button>
        )}
      </div>
    </div>
  );
}
