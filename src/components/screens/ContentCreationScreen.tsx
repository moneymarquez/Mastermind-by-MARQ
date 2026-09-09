import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useClients } from '../../data/useClients';
import ClientSelector from '../ClientSelector';
import { CONTENT_101 } from '../../data/content101';
import MiniMarkdown from '../MiniMarkdown';
import { useContentGrowth } from '../../data/useContentGrowth';
import type { AccountState, ContentGrowthPlan, GrowthPlatform } from '../../data/useContentGrowth';
import ContentGrowthPlanView from './ContentGrowthPlanView';
import ContentSlate from './ContentSlate';
import ContentBuildOut from './ContentBuildOut';
import ContentPipelineBoard from './ContentPipelineBoard';
import ContentShotDayBatcher from './ContentShotDayBatcher';
import ContentHookLogForm from './ContentHookLogForm';
import ContentHookTrackRecord from './ContentHookTrackRecord';
import AccountAuditPanel from './AccountAuditPanel';
import { useContentIdeas } from '../../data/useContentIdeas';
import { useMarketing } from '../../data/useMarketing';
import { useHookLog, bestPillarFromHookLog } from '../../data/useHookLog';
import { useAccountAudits } from '../../data/useAccountAudits';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
  selectedClientId: string | null;
  onSelectClient: (id: string | null) => void;
  /** Opens the Nova panel and sends it a pre-composed prompt — same
   *  mechanism Marketing's "Build this with Nova" uses (Stage.tsx). */
  onAskNova?: (promptText: string) => void;
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 24 };
const sectionTitle: CSSProperties = { fontSize: 'var(--text-head)', fontWeight: 700, color: 'var(--text)', marginTop: 40, marginBottom: 14 };
const inputStyle: CSSProperties = {
  background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)', padding: '9px 12px',
  color: 'var(--text)', fontSize: 'var(--text-body-lg)', outline: 'none',
};
const primaryBtn: CSSProperties = {
  padding: '9px 18px', borderRadius: 'var(--radius-pill)', background: 'var(--text)', color: 'var(--bg)',
  fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: 'pointer', display: 'inline-block',
};

const PLATFORM_LABEL: Record<GrowthPlatform, string> = {
  instagram: 'Instagram', tiktok: 'TikTok', youtube_shorts: 'YouTube Shorts', youtube_long: 'YouTube (long form)',
  linkedin: 'LinkedIn', facebook: 'Facebook', twitter: 'Twitter/X',
};
const PHASE_LABEL: Record<ContentGrowthPlan['phase'], string> = {
  setup: 'Setup', volume: 'Volume', pattern_finding: 'Pattern finding', concentration: 'Concentration',
};

function NewPlanForm({ onCreate }: { onCreate: (input: { platform: GrowthPlatform; account_handle: string | null; target_followers: number | null; starting_followers: number | null; account_state: AccountState }) => void }) {
  const [platform, setPlatform] = useState<GrowthPlatform>('instagram');
  const [handle, setHandle] = useState('');
  const [target, setTarget] = useState('');
  const [starting, setStarting] = useState('');
  const [accountState, setAccountState] = useState<AccountState>('new');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!starting.trim()) return;
    setSaving(true);
    await onCreate({
      platform,
      account_handle: handle.trim() || null,
      target_followers: target.trim() ? Number(target) : null,
      starting_followers: Number(starting),
      account_state: accountState,
    });
    setSaving(false);
  };

  return (
    <div style={{ ...cardStyle, marginBottom: 14 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginBottom: 5 }}>Is this a new account, or one that's already posting?</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['new', 'existing'] as const).map((s) => (
            <div
              key={s}
              onClick={() => setAccountState(s)}
              style={{
                padding: '7px 14px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-small)', cursor: 'pointer', textTransform: 'capitalize',
                border: `1px solid ${accountState === s ? 'var(--text)' : 'var(--border)'}`,
                color: accountState === s ? 'var(--text)' : 'var(--text-secondary)',
              }}
            >
              {s === 'new' ? 'Starting fresh' : 'Already posting'}
            </div>
          ))}
        </div>
        {accountState === 'existing' && (
          <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 6 }}>
            You'll diagnose the account first — before anything gets slated.
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginBottom: 5 }}>Platform</div>
          <select style={{ ...inputStyle, width: 160 }} value={platform} onChange={(e) => setPlatform(e.target.value as GrowthPlatform)}>
            {(Object.keys(PLATFORM_LABEL) as GrowthPlatform[]).map((p) => <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginBottom: 5 }}>Handle</div>
          <input style={{ ...inputStyle, width: 140 }} placeholder="@handle" value={handle} onChange={(e) => setHandle(e.target.value)} />
        </div>
        <div>
          <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginBottom: 5 }}>Current followers</div>
          <input style={{ ...inputStyle, width: 130 }} type="number" placeholder="real count" value={starting} onChange={(e) => setStarting(e.target.value)} />
        </div>
        <div>
          <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginBottom: 5 }}>Target</div>
          <input style={{ ...inputStyle, width: 110 }} type="number" placeholder="e.g. 40000" value={target} onChange={(e) => setTarget(e.target.value)} />
        </div>
        <div style={{ ...primaryBtn, opacity: saving || !starting.trim() ? 0.6 : 1, pointerEvents: saving || !starting.trim() ? 'none' : 'auto' }} onClick={submit}>
          {saving ? 'Creating…' : '+ New growth plan'}
        </div>
      </div>
    </div>
  );
}

// Content 101's own words: "growth = volume × hit rate × retention," "no
// substitute for a defined viewer," "diagnose before prescribing." Nova
// gets asked to run that framework against this plan's real state, not
// asked to freelance.
function composeGrowthPrompt(plan: ContentGrowthPlan, clientName: string, planCheckins: { checkin_date: string; follower_count: number; posts_count: number | null; what_worked: string | null; what_to_change: string | null }[]): string {
  const current = planCheckins[0]?.follower_count ?? plan.starting_followers ?? 0;
  const lines: string[] = [];
  lines.push(`Help me grow ${clientName}'s ${PLATFORM_LABEL[plan.platform]} account${plan.account_handle ? ` (${plan.account_handle})` : ''}. (client_id: ${plan.client_id}, plan_id: ${plan.id})`);
  lines.push(`Current followers: ${current}${plan.target_followers ? ` — target: ${plan.target_followers}` : ''}`);
  lines.push(`Phase: ${PHASE_LABEL[plan.phase]}`);
  if (plan.niche_viewer) lines.push(`Viewer: ${plan.niche_viewer}`);
  else lines.push(`Viewer: not defined yet — this needs to happen before anything else, per Content 101.`);
  if (plan.pillars.length) lines.push(`Pillars: ${plan.pillars.join(', ')}`);
  if (planCheckins.length) {
    lines.push('');
    lines.push('Recent check-ins:');
    planCheckins.slice(0, 4).forEach((c) => {
      lines.push(`- ${c.checkin_date}: ${c.follower_count} followers${c.posts_count != null ? `, ${c.posts_count} posts` : ''}${c.what_worked ? ` — worked: ${c.what_worked}` : ''}${c.what_to_change ? ` — change: ${c.what_to_change}` : ''}`);
    });
  } else {
    lines.push('No check-ins logged yet — this is week one.');
  }
  lines.push('');
  lines.push("Using Content 101, tell me exactly what to do this week for this phase. If the viewer or pillars above are missing or too blurry, fix those first — nothing else in the doc works until that's nailed down.");
  return lines.join('\n');
}

export default function ContentCreationScreen({ homeHeadStyle, homeSubStyle, selectedClientId, onSelectClient, onAskNova }: Props) {
  const { clients, loading, error, createClient } = useClients();
  const selected = clients.find((c) => c.id === selectedClientId) ?? null;
  const growth = useContentGrowth();
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [showReference, setShowReference] = useState(false);
  const [referenceTab, setReferenceTab] = useState<'fundamentals' | 'plays'>('fundamentals');

  const clientPlans = selectedClientId ? growth.plans.filter((p) => p.client_id === selectedClientId) : [];
  const activePlan = growth.plans.find((p) => p.id === activePlanId) ?? null;
  const ideasApi = useContentIdeas(activePlan?.id ?? null);
  const m = useMarketing();
  const planPipeline = activePlan ? m.pipeline.filter((p) => p.plan_id === activePlan.id) : [];
  const hookLogApi = useHookLog();
  const planIdeaIds = new Set(ideasApi.ideas.map((i) => i.id));
  const hookLogBestPillar = bestPillarFromHookLog(hookLogApi.entries, planIdeaIds);
  // Published pipeline items with a real idea behind them and no log yet —
  // "prompts the hook_log entry for each published post."
  const loggedIdeaIds = new Set(hookLogApi.entries.map((e) => e.idea_id));
  const unloggedPublished = planPipeline
    .filter((p) => p.stage === 'published' && p.idea_id && !loggedIdeaIds.has(p.idea_id))
    .map((p) => ideasApi.ideas.find((i) => i.id === p.idea_id))
    .filter((i): i is NonNullable<typeof i> => !!i);
  const auditsApi = useAccountAudits(activePlan?.id ?? null);
  // "Before anything gets slated" — an existing account is gated behind
  // a completed diagnosis, same shape page_purpose gates the slate.
  const needsAudit = activePlan?.account_state === 'existing' && auditsApi.audits.length === 0 && !auditsApi.loading;
  const latestAudit = auditsApi.audits[0] ?? null;

  return (
    <div>
      <div style={homeHeadStyle}>Content Creation</div>
      <div style={homeSubStyle}>Per-client social growth plans — platform, target, phase, and real weekly check-ins.</div>

      <ContentHookTrackRecord entries={hookLogApi.entries} loading={hookLogApi.loading} />

      <div style={{ marginTop: 20 }}>
        <ClientSelector
          clients={clients}
          loading={loading}
          error={error}
          selectedId={selectedClientId}
          onSelect={onSelectClient}
          onCreate={createClient}
          emptyHint="Pick a client to start a growth plan for their account."
        />
      </div>

      {selectedClientId && selected ? (
        <>
          {activePlan && activePlan.account_state === 'existing' && (
            <>
              <div style={sectionTitle}>Account diagnosis</div>
              <AccountAuditPanel
                plan={activePlan}
                audits={auditsApi.audits}
                loading={auditsApi.loading}
                onSave={(handle, postsReviewed, statedViewer, result) => auditsApi.saveAudit(activePlan.client_id, activePlan.id, handle, postsReviewed, statedViewer, result)}
              />
            </>
          )}
          {activePlan ? (
            <ContentGrowthPlanView
              plan={activePlan}
              checkins={growth.checkins}
              clientName={selected.business_name}
              currentGap={latestAudit?.primary_gap}
              onUpdate={(patch) => growth.updatePlan(activePlan.id, patch)}
              onDelete={() => { growth.removePlan(activePlan.id); setActivePlanId(null); }}
              onClose={() => setActivePlanId(null)}
              onAddCheckin={(input) => growth.addCheckin(activePlan.id, input)}
              onRemoveCheckin={growth.removeCheckin}
              onAskNova={() => onAskNova?.(composeGrowthPrompt(activePlan, selected.business_name, growth.checkins.filter((c) => c.plan_id === activePlan.id)))}
            />
          ) : null}
          {activePlan && (
            <>
              <div style={sectionTitle}>Content slate</div>
              <ContentSlate
                plan={activePlan}
                clientName={selected.business_name}
                ideas={ideasApi.ideas}
                loading={ideasApi.loading}
                needsAudit={needsAudit}
                auditSeed={latestAudit?.primary_gap ? { testList: latestAudit.test, primaryGap: latestAudit.primary_gap } : null}
                lastCheckin={growth.checkins.filter((c) => c.plan_id === activePlan.id)[0]}
                hookLogBestPillar={hookLogBestPillar}
                onGenerateSlate={(drafts) => ideasApi.saveSlate(activePlan.client_id, activePlan.id, drafts)}
                onPick={(id) => ideasApi.pickIdea(id)}
              />
              {ideasApi.ideas.some((i) => i.status === 'picked') && (
                <>
                  <div style={sectionTitle}>Build out</div>
                  <ContentBuildOut
                    plan={activePlan}
                    clientName={selected.business_name}
                    pickedIdea={ideasApi.ideas.find((i) => i.status === 'picked') ?? null}
                    onSave={(id, patch) => ideasApi.updateIdea(id, patch)}
                  />
                </>
              )}
              <div style={sectionTitle}>Shot day</div>
              <ContentShotDayBatcher
                items={planPipeline.filter((p) => p.stage === 'idea' || p.stage === 'drafted')}
                ideas={ideasApi.ideas}
                onMarkAllFilmed={(ids) => ids.forEach((id) => m.updatePipelineItem(id, { stage: 'filmed' }))}
              />
              <div style={sectionTitle}>Pipeline</div>
              <ContentPipelineBoard
                items={planPipeline}
                loading={m.loading}
                pickableIdeas={ideasApi.ideas.filter((i) => i.status === 'picked' || i.status === 'published')}
                onAdd={(title, ideaId) => m.addPipelineItem(title, activePlan.client_id, activePlan.id, ideaId)}
                onMoveStage={(id, stage) => m.updatePipelineItem(id, { stage })}
                onRemove={(id) => m.removePipelineItem(id)}
              />
              {unloggedPublished.length > 0 && (
                <>
                  <div style={sectionTitle}>Log published posts</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {unloggedPublished.map((idea) => (
                      <ContentHookLogForm key={idea.id} idea={idea} onLog={(i, input) => hookLogApi.logHook(i, input)} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
          {!activePlan && (
            <>
              {growth.error && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--danger)', marginBottom: 10 }}>{growth.error}</div>}
              {clientPlans.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                  {clientPlans.map((p) => {
                    const latest = growth.checkins.find((c) => c.plan_id === p.id);
                    const current = latest?.follower_count ?? p.starting_followers ?? 0;
                    return (
                      <div key={p.id} style={{ ...cardStyle, padding: 14, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }} onClick={() => setActivePlanId(p.id)}>
                        <div>
                          <div style={{ fontSize: 'var(--text-body-sm)', fontWeight: 600, color: 'var(--text)' }}>
                            {PLATFORM_LABEL[p.platform]}{p.account_handle ? ` — ${p.account_handle}` : ''}
                          </div>
                          <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 3 }}>
                            {current.toLocaleString()} followers{p.target_followers ? ` of ${p.target_followers.toLocaleString()}` : ''}
                          </div>
                        </div>
                        <span style={{ fontSize: 'var(--text-micro)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '3px 9px', flexShrink: 0 }}>
                          {PHASE_LABEL[p.phase]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {!growth.loading && clientPlans.length === 0 && (
                <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)', marginBottom: 14 }}>
                  No growth plan yet for {selected.business_name} — start one with their real current follower count below.
                </div>
              )}
              <NewPlanForm onCreate={async (input) => { const p = await growth.createPlan({ client_id: selectedClientId, ...input }); if (p) setActivePlanId(p.id); }} />
            </>
          )}
        </>
      ) : (
        <div style={{ ...cardStyle, maxWidth: 560 }}>
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>
            Select a client above to start or manage their growth plan.
          </div>
        </div>
      )}

      <div style={sectionTitle}>Content 101</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div
          style={{ padding: '7px 14px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-small)', cursor: 'pointer', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          onClick={() => setShowReference((v) => !v)}
        >
          {showReference ? 'Hide' : 'Show'} reference
        </div>
        {showReference && (
          <>
            <div
              style={{ padding: '7px 14px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-small)', cursor: 'pointer', border: `1px solid ${referenceTab === 'fundamentals' ? 'var(--text)' : 'var(--border)'}`, color: referenceTab === 'fundamentals' ? 'var(--text)' : 'var(--text-secondary)' }}
              onClick={() => setReferenceTab('fundamentals')}
            >
              Fundamentals
            </div>
            <div
              style={{ padding: '7px 14px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-small)', cursor: 'pointer', border: `1px solid ${referenceTab === 'plays' ? 'var(--text)' : 'var(--border)'}`, color: referenceTab === 'plays' ? 'var(--text)' : 'var(--text-secondary)' }}
              onClick={() => setReferenceTab('plays')}
            >
              The Plays
            </div>
          </>
        )}
      </div>
      {!showReference && (
        <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>
          Your own content-creation training material — distribution mechanics, hooks, niches, formats, and the Made by Marq specific play. Nova can also draw on this here.
        </div>
      )}
      {showReference && (
        <div style={{ ...cardStyle, maxWidth: 760 }}>
          <MiniMarkdown text={referenceTab === 'fundamentals' ? CONTENT_101.fundamentals : CONTENT_101.plays} />
        </div>
      )}
    </div>
  );
}
