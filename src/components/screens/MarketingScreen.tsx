import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useMarketing } from '../../data/useMarketing';
import type { AssetType, CampaignStatus, PipelineStage } from '../../data/useMarketing';
import { askClaude, AiError } from '../../lib/ai';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
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

export default function MarketingScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const m = useMarketing();
  const [assetFilter, setAssetFilter] = useState<AssetType | null>(null);
  const [newAssetName, setNewAssetName] = useState('');
  const [newAssetType, setNewAssetType] = useState<AssetType>('copy');
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newPipelineTitle, setNewPipelineTitle] = useState('');

  const filteredAssets = assetFilter ? m.assets.filter((a) => a.asset_type === assetFilter) : m.assets;

  return (
    <div>
      <div style={homeHeadStyle}>Marketing</div>
      <div style={homeSubStyle}>Assets, campaigns, and the content pipeline — owner-only.</div>

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
          onClick={async () => { if (!newAssetName.trim()) return; await m.addAsset({ name: newAssetName.trim(), asset_type: newAssetType }); setNewAssetName(''); }}
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
          onClick={async () => { if (!newCampaignName.trim()) return; await m.addCampaign({ name: newCampaignName.trim(), status: 'planned' }); setNewCampaignName(''); }}
        >
          Add campaign
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {m.campaigns.map((c) => (
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
        {!m.loading && m.campaigns.length === 0 && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>No campaigns yet.</div>}
      </div>

      <div style={sectionTitle}>Content pipeline</div>
      <div style={{ ...cardStyle, display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
        <input style={{ ...inputStyle, flex: 1 }} placeholder="New content idea" value={newPipelineTitle} onChange={(e) => setNewPipelineTitle(e.target.value)} />
        <div
          style={{ padding: '9px 18px', borderRadius: 'var(--radius-pill)', background: 'var(--text)', color: 'var(--bg)', fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: 'pointer' }}
          onClick={async () => { if (!newPipelineTitle.trim()) return; await m.addPipelineItem(newPipelineTitle.trim()); setNewPipelineTitle(''); }}
        >
          Add idea
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {STAGES.map((stage) => (
          <div key={stage}>
            <div style={{ fontSize: 'var(--text-tiny)', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>{STAGE_LABEL[stage]}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {m.pipeline.filter((p) => p.stage === stage).map((p) => (
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
    </div>
  );
}
