import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Campaign, CampaignAsset, useCampaigns } from '../../../data/useCampaigns';
import type { CampaignContext, DerivedStatus, DialingResults, StepAnswer, StepDef } from '../../../data/campaignBuilder';
import {
  STEPS, stepByN, canOpenStep, firstIncompleteStep, isStepComplete, buildPlanMarkdown, generateAssetChecklist,
  scheduleOccurrences, hasChannel, deriveStatus, actualForMetric, dateOnly,
} from '../../../data/campaignBuilder';
import { interpretAnswer, prefillFromTranscript, polishPlan } from '../../../data/campaignAi';
import { AiError } from '../../../lib/ai';
import MiniMarkdown from '../../MiniMarkdown';
import CampaignStepCard, { cardStyle, inputStyle, primaryBtn, ghostBtn, labelStyle } from './CampaignStepCard';
import CampaignResults from './CampaignResults';

export type CockpitFocus = 'step' | 'assets' | 'results' | 'plan';

interface Props {
  campaign: Campaign;
  assets: CampaignAsset[];
  ctx: CampaignContext;
  api: ReturnType<typeof useCampaigns>;
  leadQueue: { last_called_at: string | null; status: string | null }[];
  /** The assigned client's kickoff transcript from the CRM, if any. */
  transcript: string | null;
  focus: CockpitFocus;
  initialStep?: number;
  onBack: () => void;
  onNavigate: (screen: string) => void;
}

export const STATUS_COLOR: Record<DerivedStatus['level'], string> = { on_track: 'var(--success)', needs_attention: 'var(--warning)', stalled: 'var(--danger)' };
export const STATUS_LABEL: Record<DerivedStatus['level'], string> = { on_track: 'On track', needs_attention: 'Needs attention', stalled: 'Stalled' };

export function StatusChip({ level }: { level: DerivedStatus['level'] }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-micro)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: STATUS_COLOR[level], border: `1px solid ${STATUS_COLOR[level]}`, borderRadius: 'var(--radius-pill)', padding: '3px 9px', whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLOR[level] }} />{STATUS_LABEL[level]}
    </span>
  );
}

const ASSET_NEXT: Record<CampaignAsset['status'], CampaignAsset['status']> = { needed: 'in_progress', in_progress: 'done', done: 'needed' };
const ASSET_LABEL: Record<CampaignAsset['status'], string> = { needed: 'Needed', in_progress: 'In progress', done: 'Done' };
const ASSET_COLOR: Record<CampaignAsset['status'], string> = { needed: 'var(--text-tertiary)', in_progress: 'var(--warning)', done: 'var(--success)' };

/** One campaign, everything on one screen: where it stands, the next
 *  incomplete step front and center, then the plan, the asset checklist,
 *  the schedule and results. Finished steps reopen from the rail. */
export default function CampaignCockpit({ campaign, assets, ctx, api, leadQueue, transcript, focus, initialStep, onBack, onNavigate }: Props) {
  const first = firstIncompleteStep(campaign.answers);
  const [activeStep, setActiveStep] = useState<number>(initialStep ?? Math.min(STEPS.length, first));
  const [saving, setSaving] = useState(false);
  const [auto, setAuto] = useState<DialingResults | null>(null);
  const [showSteps, setShowSteps] = useState(first <= STEPS.length || !!initialStep);
  const [newAsset, setNewAsset] = useState('');
  const [aiBusy, setAiBusy] = useState<'transcript' | 'polish' | null>(null);
  const [aiError, setAiError] = useState('');
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [transcriptDraft, setTranscriptDraft] = useState(transcript ?? '');
  const [copied, setCopied] = useState(false);
  const refs = { step: useRef<HTMLDivElement>(null), assets: useRef<HTMLDivElement>(null), results: useRef<HTMLDivElement>(null), plan: useRef<HTMLDivElement>(null) };

  useEffect(() => {
    if (focus === 'step') return;
    const t = window.setTimeout(() => refs[focus].current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, campaign.id]);

  const step: StepDef = stepByN(activeStep);
  const planAssets = assets.map((a) => ({ name: a.name, status: a.status }));
  const generatedPlan = useMemo(() => buildPlanMarkdown(campaign, ctx, planAssets), [campaign, ctx, assets]); // eslint-disable-line react-hooks/exhaustive-deps
  const plan = campaign.plan_md ?? generatedPlan;
  const actual = actualForMetric(campaign.target_metric, campaign.results ?? {}, auto);
  const status = deriveStatus({
    status: campaign.status, answers: campaign.answers, last_activity_at: campaign.last_activity_at, launched_at: campaign.launched_at,
    start_date: campaign.start_date, target_metric: campaign.target_metric, target_value: campaign.target_value, isInternal: ctx.isInternal,
    assets: planAssets, actual, now: new Date(),
  });
  const occurrences = scheduleOccurrences(campaign.answers.schedule);
  const done = campaign.status !== 'planned' || first > STEPS.length;

  const handleSave = async (def: StepDef, answer: StepAnswer) => {
    setSaving(true);
    try {
      const nextAnswers = { ...campaign.answers, [def.id]: answer };
      const nextCtx: CampaignContext = { ...ctx, answers: nextAnswers };
      const extra: Partial<Campaign> = {};
      if (def.id === 'budget') { extra.budget_amount = Number(answer.data?.amount ?? 0); extra.budget_period = String(answer.data?.period ?? 'total'); }
      if (def.id === 'measurement') { extra.target_metric = answer.choice ?? null; extra.target_value = Number(answer.data?.target ?? 0) || null; }
      if (def.id === 'review') {
        extra.plan_md = null; // the plan restates the steps; a re-review regenerates it
        if (answer.choice === 'launch') {
          const occ = scheduleOccurrences(nextAnswers.schedule);
          const by = nextAnswers.measurement?.data?.by_date;
          extra.status = 'running';
          extra.launched_at = new Date().toISOString();
          extra.start_date = occ[0]?.date ?? dateOnly(new Date());
          extra.end_date = by ? String(by) : occ[occ.length - 1]?.date ?? null;
        }
      }
      await api.saveAnswer(campaign, def.id, answer, extra);
      if (def.id === 'assets') await api.replaceAssets({ ...campaign, answers: nextAnswers }, generateAssetChecklist(nextCtx));
      if (def.id === 'schedule') await api.writeSchedule(campaign, scheduleOccurrences(answer), hasChannel(nextCtx, 'cold_calling'), answer.custom ?? null);
      if (answer.custom && answer.custom !== campaign.answers[def.id]?.custom) {
        interpretAnswer(def.title, answer.custom, nextCtx).then((s) => api.annotateAnswer(campaign.id, def.id, s)).catch(() => { /* informational only */ });
      }
      const nextFirst = firstIncompleteStep(nextAnswers);
      if (nextFirst > STEPS.length) setShowSteps(false);
      else setActiveStep(nextFirst);
    } finally {
      setSaving(false);
    }
  };

  const readTranscript = async () => {
    if (!transcriptDraft.trim()) return;
    setAiBusy('transcript');
    setAiError('');
    try {
      const found = await prefillFromTranscript(transcriptDraft, ctx);
      const answers = { ...campaign.answers };
      let n = 0;
      for (const [k, v] of Object.entries(found)) {
        const key = k as keyof typeof found;
        if (answers[key]?.done_at) continue; // never overwrite a confirmed step
        answers[key] = { ...(answers[key] ?? {}), custom: v, prefilled: true };
        n++;
      }
      await api.update(campaign.id, { answers });
      setTranscriptOpen(false);
      if (n === 0) setAiError('The transcript didn\'t say enough to fill any step.');
    } catch (e) {
      setAiError(e instanceof AiError ? e.message : 'Could not read the transcript.');
    } finally {
      setAiBusy(null);
    }
  };

  const polish = async () => {
    setAiBusy('polish');
    setAiError('');
    try {
      const md = await polishPlan(generatedPlan, ctx);
      await api.update(campaign.id, { plan_md: md });
    } catch (e) {
      setAiError(e instanceof AiError ? e.message : 'Could not polish the plan.');
    } finally {
      setAiBusy(null);
    }
  };

  const copyPlan = async () => {
    try { await navigator.clipboard.writeText(plan); setCopied(true); window.setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };
  const downloadPlan = () => {
    const blob = new Blob([plan], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${campaign.name.replace(/[^\w\- ]+/g, '').trim() || 'campaign'}.md`; a.click();
    URL.revokeObjectURL(url);
  };

  const act = () => {
    switch (status.next.kind) {
      case 'step': case 'launch': setShowSteps(true); setActiveStep(status.next.step ?? first); refs.step.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); break;
      case 'assets': refs.assets.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); break;
      case 'results': refs.results.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); break;
      case 'plan': refs.plan.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); break;
      case 'dialing': onNavigate('dialing'); break;
    }
  };

  const sectionTitle: CSSProperties = { fontSize: 'var(--text-head)', fontWeight: 700, color: 'var(--text)', marginTop: 28, marginBottom: 10 };
  const needed = assets.filter((a) => a.status !== 'done').length;

  return (
    <div>
      <span style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={onBack}>← All campaigns</span>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 'var(--text-title)', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>{campaign.name}</div>
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginTop: 4, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>{ctx.isInternal ? 'Made by MARQ' : ctx.clientName}</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: campaign.status === 'running' ? 'var(--success)' : 'var(--text)' }}>{status.progress}</span>
            <StatusChip level={status.level} />
            <span style={{ color: 'var(--text-tertiary)' }}>{status.reason}</span>
          </div>
        </div>
        <button style={primaryBtn} onClick={act}>{status.next.label} →</button>
      </div>

      {/* Step rail — the whole flow at a glance, locked steps dimmed. */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 16 }}>
        {STEPS.map((s) => {
          const complete = isStepComplete(s.id, campaign.answers);
          const open = canOpenStep(s.n, campaign.answers, campaign.skip_gating);
          const active = showSteps && s.n === activeStep;
          return (
            <div
              key={s.id}
              onClick={() => { if (open) { setShowSteps(true); setActiveStep(s.n); } }}
              title={open ? s.title : 'Finish the earlier steps first'}
              style={{ padding: '5px 10px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-caption)', fontWeight: 600, cursor: open ? 'pointer' : 'not-allowed', opacity: open ? 1 : 0.45, border: `1px solid ${active ? 'var(--text)' : complete ? 'var(--success)' : 'var(--border)'}`, color: active ? 'var(--text)' : complete ? 'var(--success)' : 'var(--text-secondary)' }}
            >
              {complete ? '✓ ' : `${s.n} `}{s.short}
            </div>
          );
        })}
        <label style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', cursor: 'pointer' }} title="Off for a first campaign; on once you know the flow.">
          <input type="checkbox" checked={campaign.skip_gating} onChange={(e) => api.update(campaign.id, { skip_gating: e.target.checked })} />
          Skip ahead
        </label>
      </div>

      {(!done || showSteps) && (
        <div ref={refs.step} style={{ marginTop: 16 }}>
          {!done && activeStep <= 5 && (
            <div style={{ marginBottom: 10 }}>
              {!transcriptOpen ? (
                <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', textDecoration: 'underline', cursor: 'pointer' }} onClick={() => setTranscriptOpen(true)}>
                  {transcript ? 'Prefill the steps from the kickoff-call transcript' : 'Prefill the steps from a call transcript'}
                </span>
              ) : (
                <div style={{ ...cardStyle, padding: 14 }}>
                  <div style={{ ...labelStyle, marginBottom: 6 }}>Call transcript</div>
                  <textarea style={{ ...inputStyle, width: '100%', minHeight: 120 }} value={transcriptDraft} onChange={(e) => setTranscriptDraft(e.target.value)} placeholder="Paste the discovery call. Steps it answers get prefilled; you still confirm each one." />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button style={{ ...primaryBtn, opacity: aiBusy ? 0.6 : 1 }} disabled={!!aiBusy} onClick={readTranscript}>{aiBusy === 'transcript' ? 'Reading…' : 'Read transcript'}</button>
                    <button style={ghostBtn} onClick={() => setTranscriptOpen(false)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}
          <CampaignStepCard
            key={`${campaign.id}:${step.id}`}
            step={step}
            ctx={ctx}
            answer={campaign.answers[step.id]}
            saving={saving}
            isLast={step.n === STEPS.length}
            onSave={(a) => handleSave(step, a)}
            onBack={step.n > 1 ? () => setActiveStep(step.n - 1) : undefined}
          />
          {done && <span style={{ display: 'inline-block', marginTop: 8, fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={() => setShowSteps(false)}>Hide steps</span>}
        </div>
      )}
      {done && !showSteps && (
        <div style={{ marginTop: 12 }}>
          <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', textDecoration: 'underline', cursor: 'pointer' }} onClick={() => { setShowSteps(true); setActiveStep(STEPS.length); }}>Edit the plan steps</span>
        </div>
      )}
      {aiError && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--danger)', marginTop: 8 }}>{aiError}</div>}

      {campaign.launched_at && (
        <div ref={refs.results}>
          <div style={sectionTitle}>Results</div>
          <CampaignResults
            campaign={campaign}
            leadQueue={leadQueue}
            onSave={(r) => api.saveResults(campaign, r)}
            onAutoLoaded={setAuto}
            onMarkDone={() => api.update(campaign.id, { status: 'done' })}
          />
        </div>
      )}

      <div ref={refs.assets}>
        <div style={{ ...sectionTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span>Assets{assets.length ? ` · ${assets.length - needed}/${assets.length} done` : ''}</span>
          {campaign.answers.assets?.done_at && (
            <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', textDecoration: 'underline', cursor: 'pointer', fontWeight: 400 }} onClick={() => api.replaceAssets(campaign, generateAssetChecklist(ctx))}>Regenerate from the steps</span>
          )}
        </div>
        {assets.length === 0 ? (
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>The checklist is written at step 6 from the channels and hook you pick — nothing to make by hand.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {assets.map((a) => (
              <div key={a.id} style={{ ...cardStyle, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div
                  onClick={() => api.updateAsset(a.id, { status: ASSET_NEXT[a.status] })}
                  title="Tap to advance: needed → in progress → done"
                  style={{ fontSize: 'var(--text-micro)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: ASSET_COLOR[a.status], border: `1px solid ${ASSET_COLOR[a.status]}`, borderRadius: 'var(--radius-pill)', padding: '3px 9px', cursor: 'pointer', flexShrink: 0, marginTop: 2, minWidth: 86, textAlign: 'center' }}
                >
                  {ASSET_LABEL[a.status]}
                </div>
                <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', textDecoration: a.status === 'done' ? 'line-through' : undefined, opacity: a.status === 'done' ? 0.7 : 1 }}>{a.name}</div>
                  {a.content && <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.45 }}>{a.content}</div>}
                  <input
                    style={{ ...inputStyle, width: '100%', marginTop: 8, padding: '6px 10px', fontSize: 'var(--text-caption)' }}
                    placeholder="Link to the file, doc, or where it lives"
                    defaultValue={a.external_url ?? ''}
                    onBlur={(e) => { const v = e.target.value.trim() || null; if (v !== (a.external_url ?? null)) api.updateAsset(a.id, { external_url: v }); }}
                  />
                </div>
                <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', cursor: 'pointer', marginTop: 4 }} onClick={() => api.removeAsset(a.id)}>Remove</span>
              </div>
            ))}
          </div>
        )}
        {campaign.answers.assets?.done_at && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10, maxWidth: 480 }}>
            <input style={{ ...inputStyle, flex: 1 }} placeholder="Add an asset the checklist missed" value={newAsset} onChange={(e) => setNewAsset(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newAsset.trim()) { api.addAsset(campaign, newAsset.trim()); setNewAsset(''); } }} />
            <button style={ghostBtn} onClick={() => { if (newAsset.trim()) { api.addAsset(campaign, newAsset.trim()); setNewAsset(''); } }}>Add</button>
          </div>
        )}
      </div>

      <div style={sectionTitle}>Schedule</div>
      {occurrences.length === 0 ? (
        <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>Set at step 7. The sessions go onto your Schedule and into the Daily Plan.</div>
      ) : (
        <div style={{ ...cardStyle, padding: 14 }}>
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text)' }}>
            {occurrences.length} session{occurrences.length === 1 ? '' : 's'} · {occurrences[0].start_time}–{occurrences[0].end_time} · {occurrences[0].date} → {occurrences[occurrences.length - 1].date}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {occurrences.slice(0, 12).map((o) => (
              <span key={o.date} style={{ fontSize: 'var(--text-caption)', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '2px 8px' }}>{o.date.slice(5)}</span>
            ))}
            {occurrences.length > 12 && <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)' }}>+{occurrences.length - 12} more</span>}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', textDecoration: 'underline', cursor: 'pointer' }} onClick={() => onNavigate('schedule')}>Open Schedule</span>
            <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', textDecoration: 'underline', cursor: 'pointer' }} onClick={() => api.writeSchedule(campaign, occurrences, hasChannel(ctx, 'cold_calling'), campaign.answers.schedule?.custom ?? null)}>Rewrite to the calendar</span>
          </div>
        </div>
      )}

      <div ref={refs.plan}>
        <div style={{ ...sectionTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span>Campaign plan</span>
          <span style={{ display: 'flex', gap: 10, fontWeight: 400 }}>
            <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', textDecoration: 'underline', cursor: 'pointer' }} onClick={copyPlan}>{copied ? 'Copied' : 'Copy'}</span>
            <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', textDecoration: 'underline', cursor: 'pointer' }} onClick={downloadPlan}>Download .md</span>
            {done && (
              campaign.plan_md
                ? <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', textDecoration: 'underline', cursor: 'pointer' }} onClick={() => api.update(campaign.id, { plan_md: null })}>Back to the generated plan</span>
                : <span style={{ fontSize: 'var(--text-caption)', color: aiBusy ? 'var(--text-tertiary)' : 'var(--text-secondary)', textDecoration: 'underline', cursor: aiBusy ? 'default' : 'pointer' }} onClick={() => !aiBusy && polish()}>{aiBusy === 'polish' ? 'Polishing…' : 'Polish with Nova'}</span>
            )}
          </span>
        </div>
        <div style={{ ...cardStyle, paddingTop: 4 }}>
          {first === 1 && !campaign.plan_md
            ? <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)', paddingTop: 14 }}>The plan writes itself as the steps get answered. It is the output, not the starting point.</div>
            : <MiniMarkdown text={plan} />}
        </div>
      </div>

      <div style={{ marginTop: 28, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        {campaign.status === 'running' && <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', textDecoration: 'underline', cursor: 'pointer' }} onClick={() => api.update(campaign.id, { status: 'planned', launched_at: null })}>Pause (back to planning)</span>}
        {campaign.status === 'done' && <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', textDecoration: 'underline', cursor: 'pointer' }} onClick={() => api.update(campaign.id, { status: 'running' })}>Reopen</span>}
        <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={() => { if (window.confirm(`Delete "${campaign.name}" and its checklist and calendar entries?`)) { api.remove(campaign.id); onBack(); } }}>Delete campaign</span>
      </div>
    </div>
  );
}
