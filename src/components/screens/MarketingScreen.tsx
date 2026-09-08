import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useMarketing } from '../../data/useMarketing';
import type { AssetType, CampaignStatus, PipelineStage } from '../../data/useMarketing';
import { useMarketingBriefs } from '../../data/useMarketingBriefs';
import type { MarketingBrief } from '../../data/useMarketingBriefs';
import MarketingBriefForm from './MarketingBriefForm';
import MarketingDiagnosisHeader from './MarketingDiagnosisHeader';
import MarketingPlaysSlate from './MarketingPlaysSlate';
import FreePlaysChecklist from './FreePlaysChecklist';
import MarketingBuildOut from './MarketingBuildOut';
import MarketingLaunchPanel from './MarketingLaunchPanel';
import { useMarketingPlays, isFreePlaysResolved } from '../../data/useMarketingPlays';
import type { BuildOutResult } from '../../lib/marketingBuildOut';
import { useClientMedia } from '../../data/useClientMedia';
import { askClaude, AiError } from '../../lib/ai';
import { useClients } from '../../data/useClients';
import ClientSelector from '../ClientSelector';
import { MARKETING_101 } from '../../data/marketing101';
import MiniMarkdown from '../MiniMarkdown';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
  selectedClientId: string | null;
  onSelectClient: (id: string | null) => void;
  /** Set by Client CRM's "Push to Marketing" button (schema_069's second
   *  entry point) — a client id whose first brief should be created and
   *  opened immediately on arrival. One-shot: consumed and cleared the
   *  moment this screen reads it, same pattern as Stage.tsx's clientFocus. */
  pendingBriefClientId?: string | null;
  onConsumePendingBrief?: () => void;
  /** Opens the Nova panel and sends it a pre-composed prompt (Stage.tsx). */
  onAskNova?: (promptText: string) => void;
}

const inputStyle: CSSProperties = {
  background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)', padding: '9px 12px',
  color: 'var(--text)', fontSize: 'var(--text-body-lg)', outline: 'none',
};
const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 18 };
const sectionTitle: CSSProperties = { fontSize: 'var(--text-head)', fontWeight: 700, color: 'var(--text)', marginTop: 40, marginBottom: 14 };
const ASSET_TYPE_LABEL: Record<AssetType, string> = { copy: 'Copy', creative: 'Creative', brand: 'Brand', reference: 'Reference' };
const STATUS_LABEL: Record<CampaignStatus, string> = { planned: 'Planned', running: 'Running', done: 'Done' };
const STATUS_COLOR: Record<CampaignStatus, string> = { planned: 'var(--text-secondary)', running: 'var(--warning)', done: 'var(--success)' };
const STAGE_LABEL: Record<PipelineStage, string> = { idea: 'Idea', drafted: 'Drafted', scheduled: 'Scheduled', published: 'Published' };
const STAGES: PipelineStage[] = ['idea', 'drafted', 'scheduled', 'published'];

function AssetCard({ asset, onUpdate, onDelete }: { asset: { id: string; name: string; asset_type: AssetType; content: string | null; tags: string[] }; onUpdate: (patch: { content?: string }) => void; onDelete: () => void }) {
  const [content, setContent] = useState(asset.content ?? '');
  const [busy, setBusy] = useState<'draft' | 'polish' | null>(null);
  const [error, setError] = useState('');

  const runAi = async (mode: 'draft' | 'polish') => {
    setBusy(mode);
    setError('');
    try {
      const text = await askClaude({
        system:
          "You are Nova, helping organize and write marketing material for Cristopher's business inside Mastermind by MARQ's Marketing section. " +
          'Be direct and usable — output only the copy itself, no preamble or explanation.',
        messages: [{
          role: 'user',
          content: mode === 'draft'
            ? `Draft marketing copy for an asset called "${asset.name}" (type: ${ASSET_TYPE_LABEL[asset.asset_type]}). ${content ? `Notes so far: ${content}` : 'No notes yet — use your judgment on angle.'}`
            : `Revise and polish this marketing copy, keeping the same core message but tightening it:\n\n${content}`,
        }],
        maxTokens: 600,
      });
      setContent(text);
      onUpdate({ content: text });
    } catch (e) {
      setError(e instanceof AiError ? e.message : 'AI request failed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <div style={{ fontSize: 'var(--text-body-lg)', fontWeight: 600, color: 'var(--text)' }}>{asset.name}</div>
          <span style={{ fontSize: 'var(--text-micro)', fontWeight: 700, color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '2px 8px', marginTop: 6, display: 'inline-block' }}>
            {ASSET_TYPE_LABEL[asset.asset_type]}
          </span>
        </div>
        <span style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={onDelete}>Delete</span>
      </div>
      <textarea
        style={{ ...inputStyle, width: '100%', minHeight: 90, resize: 'vertical', marginTop: 12, boxSizing: 'border-box' }}
        value={content}
        placeholder="Notes, copy, or a link to what this asset covers"
        onChange={(e) => setContent(e.target.value)}
        onBlur={() => onUpdate({ content })}
      />
      {error && <div style={{ fontSize: 'var(--text-caption)', color: 'var(--danger)', marginTop: 6 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <div style={{ fontSize: 'var(--text-caption)', color: busy ? 'var(--text-tertiary)' : 'var(--text-secondary)', cursor: busy ? 'default' : 'pointer' }} onClick={() => !busy && runAi('draft')}>
          {busy === 'draft' ? 'Drafting…' : 'AI: draft'}
        </div>
        <div style={{ fontSize: 'var(--text-caption)', color: busy ? 'var(--text-tertiary)' : 'var(--text-secondary)', cursor: busy ? 'default' : 'pointer' }} onClick={() => !busy && runAi('polish')}>
          {busy === 'polish' ? 'Polishing…' : 'AI: polish'}
        </div>
      </div>
    </div>
  );
}

// Every real field from the brief, handed to Nova as plain facts — not a
// summary it has to infer from. The client_id/brief_id are spelled out
// explicitly so a write_data call it makes afterward can stamp them
// exactly, rather than guessing or looking them up itself.
function composeBriefPrompt(brief: MarketingBrief, clientName: string): string {
  const lines: string[] = [];
  lines.push(`Build a marketing campaign for ${clientName} from this brief. (client_id: ${brief.client_id}, brief_id: ${brief.id})`);
  if (brief.primary_leak) lines.push(`Leak we're fixing: ${brief.primary_leak}`);
  if (brief.goal) lines.push(`Goal: ${brief.goal}`);
  if (brief.budget_amount != null) lines.push(`Budget: $${brief.budget_amount}${brief.budget_period ? ` / ${brief.budget_period}` : ''}`);
  if (brief.budget_notes) lines.push(`Budget notes: ${brief.budget_notes}`);
  if (brief.timeline) lines.push(`Timeline: ${brief.timeline}`);
  if (brief.target_audience) lines.push(`Audience: ${brief.target_audience}`);
  if (brief.positioning_statement) lines.push(`Positioning: ${brief.positioning_statement}`);
  if (brief.must_avoid) lines.push(`Must avoid: ${brief.must_avoid}`);
  if (brief.avg_transaction_value != null) lines.push(`Avg transaction value: $${brief.avg_transaction_value}`);
  if (brief.repeat_customer_pct != null) lines.push(`Repeat customers: ${brief.repeat_customer_pct}%`);
  if (brief.customer_ltv_notes) lines.push(`Customer LTV: ${brief.customer_ltv_notes}`);
  if (brief.revenue_sources) lines.push(`Current sources of business: ${brief.revenue_sources}`);
  if (brief.last_price_change) lines.push(`Pricing: ${brief.last_price_change}`);
  if (brief.gross_margin) lines.push(`Gross margin: ${brief.gross_margin}`);
  if (brief.competitor_diff) lines.push(`Vs. competitor: ${brief.competitor_diff}`);
  if (brief.contact_to_customer_rate) lines.push(`Contact-to-customer rate: ${brief.contact_to_customer_rate}`);
  if (brief.capacity_constraint) lines.push(`Capacity: ${brief.capacity_constraint}`);
  if (brief.biggest_constraint) lines.push(`Biggest constraint: ${brief.biggest_constraint}`);
  lines.push('');
  lines.push(
    "Using Marketing 101, diagnose whether the leak above is really the right one to fix first, recommend channels that fit it and the budget, " +
    'then walk me through the plan. Once I say go, create a marketing_campaigns row (with this client_id and brief_id, a real name, and notes) ' +
    'and a few marketing_content_pipeline ideas (same client_id and brief_id) to kick it off.',
  );
  return lines.join('\n');
}

export default function MarketingScreen({ homeHeadStyle, homeSubStyle, selectedClientId, onSelectClient, pendingBriefClientId, onConsumePendingBrief, onAskNova }: Props) {
  const m = useMarketing();
  const clientsApi = useClients();
  const briefsApi = useMarketingBriefs();
  const [assetFilter, setAssetFilter] = useState<AssetType | null>(null);
  const [newAssetName, setNewAssetName] = useState('');
  const [newAssetType, setNewAssetType] = useState<AssetType>('copy');
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newPipelineTitle, setNewPipelineTitle] = useState('');
  const [showReference, setShowReference] = useState(false);
  const [referenceTab, setReferenceTab] = useState<'fundamentals' | 'plays'>('fundamentals');
  const [activeBriefId, setActiveBriefId] = useState<string | null>(null);
  const [creatingBrief, setCreatingBrief] = useState(false);

  // Scoped to the selected client when one's picked; otherwise the
  // pre-client-selector "unscoped" bucket (client_id null) — see
  // schema_070. Never a mix of the two, so picking a client actually
  // means something here now instead of being a no-op shell.
  const scopedAssets = m.assets.filter((a) => a.client_id === selectedClientId);
  const filteredAssets = assetFilter ? scopedAssets.filter((a) => a.asset_type === assetFilter) : scopedAssets;
  const scopedCampaigns = m.campaigns.filter((c) => c.client_id === selectedClientId);
  const scopedPipeline = m.pipeline.filter((p) => p.client_id === selectedClientId);
  const clientBriefs = selectedClientId ? briefsApi.briefs.filter((b) => b.client_id === selectedClientId) : [];
  const activeBrief = briefsApi.briefs.find((b) => b.id === activeBriefId) ?? null;
  const selectedClientName = clientsApi.clients.find((c) => c.id === selectedClientId)?.business_name ?? '';
  // Diagnosis header and the plays slate both hang off the same "current"
  // brief for the client — the most recently updated one — not whichever
  // brief happens to be open for editing below.
  const currentBrief = clientBriefs[0] ?? null;
  const playsApi = useMarketingPlays(currentBrief?.id ?? null);
  const activePlay = playsApi.plays.find((p) => (p.category === 'paid' || p.category === 'offline') && p.status === 'active') ?? null;
  const clientMediaApi = useClientMedia(selectedClientId);
  const buildOutAssets = activePlay ? m.assets.filter((a) => a.play_id === activePlay.id) : [];
  const buildOutMedia = activePlay ? clientMediaApi.media.filter((med) => med.play_id === activePlay.id) : [];

  /** Saves a generated build-out as tagged marketing_assets rows — one for
   *  the three variants (stored as JSON so export blocks can rebuild the
   *  structured headline/body pairs later), one each for caption/GBP
   *  description when the model produced them, and one for creative
   *  direction + the shot list together. */
  const saveBuildOut = async (play: (typeof playsApi.plays)[number], result: BuildOutResult) => {
    await m.addAsset({ name: `${play.title} — 3 variants`, asset_type: 'copy', content: JSON.stringify(result.variants), tags: ['build-out', 'variants'], client_id: play.client_id, play_id: play.id });
    if (result.caption) await m.addAsset({ name: `${play.title} — caption`, asset_type: 'copy', content: result.caption, tags: ['build-out', 'caption'], client_id: play.client_id, play_id: play.id });
    if (result.gbp_description) await m.addAsset({ name: `${play.title} — GBP description`, asset_type: 'copy', content: result.gbp_description, tags: ['build-out', 'gbp'], client_id: play.client_id, play_id: play.id });
    const shotList = result.shot_list.map((s) => `- ${s}`).join('\n');
    await m.addAsset({ name: `${play.title} — creative direction & shot list`, asset_type: 'creative', content: `${result.creative_direction}\n\nShot list:\n${shotList}`, tags: ['build-out', 'creative'], client_id: play.client_id, play_id: play.id });
  };

  // Entry point 2 — Client CRM's "Push to Marketing" button. Fires once
  // per push: create a fresh brief for that client, open it, then consume
  // the pending flag so a later re-render (or navigating away and back)
  // doesn't create a second one.
  useEffect(() => {
    if (!pendingBriefClientId) return;
    onConsumePendingBrief?.();
    briefsApi.createBrief(pendingBriefClientId).then((b) => { if (b) setActiveBriefId(b.id); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingBriefClientId]);

  const startNewBrief = async () => {
    if (!selectedClientId) return;
    setCreatingBrief(true);
    const b = await briefsApi.createBrief(selectedClientId);
    setCreatingBrief(false);
    if (b) setActiveBriefId(b.id);
  };

  return (
    <div>
      <div style={homeHeadStyle}>Marketing</div>
      <div style={homeSubStyle}>Assets, campaigns, and the content pipeline — owner-only.</div>

      <div style={{ marginTop: 20 }}>
        <ClientSelector
          clients={clientsApi.clients}
          loading={clientsApi.loading}
          error={clientsApi.error}
          selectedId={selectedClientId}
          onSelect={onSelectClient}
          onCreate={clientsApi.createClient}
          emptyHint="Assets, campaigns, and the pipeline below are scoped to whichever client is picked here."
        />
      </div>

      {selectedClientId && currentBrief && (
        <div style={{ marginTop: 20 }}>
          <MarketingDiagnosisHeader
            brief={currentBrief}
            clientName={selectedClientName}
            onSetLeak={(leak, note) => briefsApi.updateBrief(currentBrief.id, { primary_leak: leak, leak_note: note })}
          />
        </div>
      )}

      {selectedClientId && currentBrief && currentBrief.primary_leak && (
        <>
          <div style={sectionTitle}>Plays</div>
          {!currentBrief.business_model ? (
            <MarketingPlaysSlate
              brief={currentBrief}
              clientName={selectedClientName}
              plays={[]}
              loading={false}
              locked
              onSetBusinessModel={(model) => briefsApi.updateBrief(currentBrief.id, { business_model: model })}
              onGenerateSlate={() => {}}
              onPick={() => {}}
            />
          ) : (
            <>
              <FreePlaysChecklist
                brief={currentBrief}
                clientName={selectedClientName}
                plays={playsApi.plays.filter((p) => p.category === 'free')}
                loading={playsApi.loading}
                onGenerate={(drafts) => playsApi.saveChecklist(currentBrief.client_id, currentBrief.id, drafts)}
                onMarkDone={(id) => playsApi.markDone(id)}
                onSkip={(id, reason) => playsApi.skipPlay(id, reason)}
                onReorder={(ids) => playsApi.reorderFreePlays(ids)}
              />
              <div style={{ marginTop: 24 }}>
                <MarketingPlaysSlate
                  brief={currentBrief}
                  clientName={selectedClientName}
                  plays={playsApi.plays.filter((p) => p.category === 'paid' || p.category === 'offline')}
                  loading={playsApi.loading}
                  locked={!isFreePlaysResolved(playsApi.plays)}
                  onSetBusinessModel={(model) => briefsApi.updateBrief(currentBrief.id, { business_model: model })}
                  onGenerateSlate={(drafts) => playsApi.saveSlate(currentBrief.client_id, currentBrief.id, drafts)}
                  onPick={(id) => playsApi.pickPlay(id)}
                />
              </div>
              {activePlay && (
                <>
                  <div style={sectionTitle}>Build out</div>
                  <MarketingBuildOut
                    brief={currentBrief}
                    clientName={selectedClientName}
                    activePlay={activePlay}
                    assets={buildOutAssets}
                    media={buildOutMedia}
                    mediaLoading={clientMediaApi.loading}
                    onSave={saveBuildOut}
                    onUploadMedia={(file) => clientMediaApi.uploadMedia(file, 'marketing', null, undefined, activePlay.id)}
                    onRemoveMedia={(id, path) => clientMediaApi.removeMedia(id, path)}
                    mediaUrl={clientMediaApi.mediaUrl}
                  />
                  <div style={sectionTitle}>Launch</div>
                  <MarketingLaunchPanel
                    play={activePlay}
                    onUpdate={(patch) => playsApi.updatePlay(activePlay.id, patch)}
                  />
                </>
              )}
            </>
          )}
        </>
      )}

      {selectedClientId && (
        <>
          <div style={sectionTitle}>Brief</div>
          {activeBrief ? (
            <MarketingBriefForm
              brief={activeBrief}
              onUpdate={(patch) => briefsApi.updateBrief(activeBrief.id, patch)}
              onDelete={() => { briefsApi.removeBrief(activeBrief.id); setActiveBriefId(null); }}
              onClose={() => setActiveBriefId(null)}
              onBuildWithNova={onAskNova ? () => onAskNova(composeBriefPrompt(activeBrief, selectedClientName)) : undefined}
            />
          ) : (
            <>
              {briefsApi.error && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--danger)', marginBottom: 10 }}>{briefsApi.error}</div>}
              {clientBriefs.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                  {clientBriefs.map((b) => (
                    <div key={b.id} style={{ ...cardStyle, padding: 14, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }} onClick={() => setActiveBriefId(b.id)}>
                      <div>
                        <div style={{ fontSize: 'var(--text-body-sm)', fontWeight: 600, color: 'var(--text)' }}>
                          {b.goal || (b.primary_leak ? `${b.primary_leak[0].toUpperCase()}${b.primary_leak.slice(1)} leak` : 'Untitled brief')}
                        </div>
                        <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 3 }}>
                          Updated {new Date(b.updated_at).toLocaleDateString()}
                        </div>
                      </div>
                      <span style={{ fontSize: 'var(--text-micro)', fontWeight: 700, textTransform: 'uppercase', color: b.status === 'ready' ? 'var(--success)' : 'var(--text-tertiary)', border: `1px solid ${b.status === 'ready' ? 'var(--success)' : 'var(--border)'}`, borderRadius: 'var(--radius-pill)', padding: '3px 9px', flexShrink: 0 }}>
                        {b.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {!briefsApi.loading && clientBriefs.length === 0 && (
                <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)', marginBottom: 14 }}>
                  No brief yet for this client — nothing downstream (campaigns, assets, content) can be generated until one exists.
                </div>
              )}
              <div
                style={{ display: 'inline-block', padding: '9px 18px', borderRadius: 'var(--radius-pill)', background: 'var(--text)', color: 'var(--bg)', fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: creatingBrief ? 'default' : 'pointer', opacity: creatingBrief ? 0.6 : 1 }}
                onClick={() => !creatingBrief && startNewBrief()}
              >
                {creatingBrief ? 'Creating…' : '+ New brief'}
              </div>
            </>
          )}
        </>
      )}

      <div style={sectionTitle}>Assets</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ padding: '7px 14px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-small)', cursor: 'pointer', border: `1px solid ${!assetFilter ? 'var(--text)' : 'var(--border)'}`, color: !assetFilter ? 'var(--text)' : 'var(--text-secondary)' }} onClick={() => setAssetFilter(null)}>All</div>
        {(['copy', 'creative', 'brand', 'reference'] as const).map((t) => (
          <div key={t} style={{ padding: '7px 14px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-small)', cursor: 'pointer', border: `1px solid ${assetFilter === t ? 'var(--text)' : 'var(--border)'}`, color: assetFilter === t ? 'var(--text)' : 'var(--text-secondary)' }} onClick={() => setAssetFilter(t)}>
            {ASSET_TYPE_LABEL[t]}
          </div>
        ))}
      </div>
      <div style={{ ...cardStyle, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <input style={{ ...inputStyle, flex: 1, minWidth: 160 }} placeholder="Asset name" value={newAssetName} onChange={(e) => setNewAssetName(e.target.value)} />
        <select style={{ ...inputStyle, width: 130 }} value={newAssetType} onChange={(e) => setNewAssetType(e.target.value as AssetType)}>
          {(['copy', 'creative', 'brand', 'reference'] as const).map((t) => <option key={t} value={t}>{ASSET_TYPE_LABEL[t]}</option>)}
        </select>
        <div
          style={{ padding: '9px 18px', borderRadius: 'var(--radius-pill)', background: 'var(--text)', color: 'var(--bg)', fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: 'pointer' }}
          onClick={async () => { if (!newAssetName.trim()) return; await m.addAsset({ name: newAssetName.trim(), asset_type: newAssetType, client_id: selectedClientId }); setNewAssetName(''); }}
        >
          Add asset
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {filteredAssets.map((a) => (
          <AssetCard key={a.id} asset={a} onUpdate={(patch) => m.updateAsset(a.id, patch)} onDelete={() => m.removeAsset(a.id)} />
        ))}
      </div>
      {!m.loading && filteredAssets.length === 0 && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>No assets yet.</div>}

      <div style={sectionTitle}>Campaigns</div>
      <div style={{ ...cardStyle, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <input style={{ ...inputStyle, flex: 1, minWidth: 160 }} placeholder="Campaign name" value={newCampaignName} onChange={(e) => setNewCampaignName(e.target.value)} />
        <div
          style={{ padding: '9px 18px', borderRadius: 'var(--radius-pill)', background: 'var(--text)', color: 'var(--bg)', fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: 'pointer' }}
          onClick={async () => { if (!newCampaignName.trim()) return; await m.addCampaign({ name: newCampaignName.trim(), status: 'planned', client_id: selectedClientId }); setNewCampaignName(''); }}
        >
          Add campaign
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {scopedCampaigns.map((c) => (
          <div key={c.id} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 'var(--text-body-lg)', fontWeight: 600, color: 'var(--text)' }}>{c.name}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['planned', 'running', 'done'] as const).map((s) => (
                  <div
                    key={s}
                    onClick={() => m.updateCampaign(c.id, { status: s })}
                    style={{
                      padding: '4px 12px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-tiny)', fontWeight: 600, cursor: 'pointer',
                      border: `1px solid ${c.status === s ? STATUS_COLOR[s] : 'var(--border)'}`,
                      color: c.status === s ? STATUS_COLOR[s] : 'var(--text-tertiary)',
                    }}
                  >
                    {STATUS_LABEL[s]}
                  </div>
                ))}
                <span style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)', cursor: 'pointer', marginLeft: 6 }} onClick={() => m.removeCampaign(c.id)}>Delete</span>
              </div>
            </div>
            <textarea
              style={{ ...inputStyle, width: '100%', minHeight: 50, resize: 'vertical', marginTop: 10, boxSizing: 'border-box' }}
              placeholder="Performance notes, what's running, results so far…"
              defaultValue={c.notes ?? ''}
              onBlur={(e) => m.updateCampaign(c.id, { notes: e.target.value })}
            />
          </div>
        ))}
        {!m.loading && scopedCampaigns.length === 0 && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>No campaigns yet.</div>}
      </div>

      <div style={sectionTitle}>Content pipeline</div>
      <div style={{ ...cardStyle, display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
        <input style={{ ...inputStyle, flex: 1 }} placeholder="New content idea" value={newPipelineTitle} onChange={(e) => setNewPipelineTitle(e.target.value)} />
        <div
          style={{ padding: '9px 18px', borderRadius: 'var(--radius-pill)', background: 'var(--text)', color: 'var(--bg)', fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: 'pointer' }}
          onClick={async () => { if (!newPipelineTitle.trim()) return; await m.addPipelineItem(newPipelineTitle.trim(), selectedClientId); setNewPipelineTitle(''); }}
        >
          Add idea
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {STAGES.map((stage) => (
          <div key={stage}>
            <div style={{ fontSize: 'var(--text-tiny)', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>{STAGE_LABEL[stage]}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {scopedPipeline.filter((p) => p.stage === stage).map((p) => (
                <div key={p.id} style={{ ...cardStyle, padding: 12 }}>
                  <div style={{ fontSize: 'var(--text-body-sm)', fontWeight: 600, color: 'var(--text)' }}>{p.title}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {STAGES.filter((s) => s !== stage).map((s) => (
                      <span key={s} style={{ fontSize: 'var(--text-nano)', color: 'var(--text-tertiary)', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '2px 8px' }} onClick={() => m.updatePipelineItem(p.id, { stage: s })}>
                        → {STAGE_LABEL[s]}
                      </span>
                    ))}
                    <span style={{ fontSize: 'var(--text-nano)', color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={() => m.removePipelineItem(p.id)}>Delete</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={sectionTitle}>Marketing 101</div>
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
          Your own marketing training material — diagnosis, offer, positioning, and channel playbooks. Nova can also draw on this here and in Content Creation.
        </div>
      )}
      {showReference && (
        <div style={{ ...cardStyle, maxWidth: 760 }}>
          <MiniMarkdown text={referenceTab === 'fundamentals' ? MARKETING_101.fundamentals : MARKETING_101.plays} />
        </div>
      )}
    </div>
  );
}
