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
  background: '#1a1c21', border: '1px solid #2b2f36', borderRadius: 8, padding: '9px 12px',
  color: '#F5F6F7', fontSize: 13.5, outline: 'none',
};
const cardStyle: CSSProperties = { background: '#14161A', border: '1px solid #22262B', borderRadius: 14, padding: 18 };
const sectionTitle: CSSProperties = { fontSize: 16, fontWeight: 700, color: '#F5F6F7', marginTop: 40, marginBottom: 14 };
const ASSET_TYPE_LABEL: Record<AssetType, string> = { copy: 'Copy', creative: 'Creative', brand: 'Brand', reference: 'Reference' };
const STATUS_LABEL: Record<CampaignStatus, string> = { planned: 'Planned', running: 'Running', done: 'Done' };
const STATUS_COLOR: Record<CampaignStatus, string> = { planned: '#8A8F98', running: '#C9A24B', done: '#8fae8f' };
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
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#F5F6F7' }}>{asset.name}</div>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#8A8F98', border: '1px solid #22262B', borderRadius: 999, padding: '2px 8px', marginTop: 6, display: 'inline-block' }}>
            {ASSET_TYPE_LABEL[asset.asset_type]}
          </span>
        </div>
        <span style={{ fontSize: 11, color: '#565b64', cursor: 'pointer' }} onClick={onDelete}>Delete</span>
      </div>
      <textarea
        style={{ ...inputStyle, width: '100%', minHeight: 90, resize: 'vertical', marginTop: 12, boxSizing: 'border-box' }}
        value={content}
        placeholder="Notes, copy, or a link to what this asset covers"
        onChange={(e) => setContent(e.target.value)}
        onBlur={() => onUpdate({ content })}
      />
      {error && <div style={{ fontSize: 11.5, color: '#c47a7a', marginTop: 6 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <div style={{ fontSize: 11.5, color: busy ? '#565b64' : '#8A8F98', cursor: busy ? 'default' : 'pointer' }} onClick={() => !busy && runAi('draft')}>
          {busy === 'draft' ? 'Drafting…' : 'AI: draft'}
        </div>
        <div style={{ fontSize: 11.5, color: busy ? '#565b64' : '#8A8F98', cursor: busy ? 'default' : 'pointer' }} onClick={() => !busy && runAi('polish')}>
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
        <div style={{ padding: '7px 14px', borderRadius: 999, fontSize: 12, cursor: 'pointer', border: `1px solid ${!assetFilter ? '#F5F6F7' : '#22262B'}`, color: !assetFilter ? '#F5F6F7' : '#8A8F98' }} onClick={() => setAssetFilter(null)}>All</div>
        {(['copy', 'creative', 'brand', 'reference'] as const).map((t) => (
          <div key={t} style={{ padding: '7px 14px', borderRadius: 999, fontSize: 12, cursor: 'pointer', border: `1px solid ${assetFilter === t ? '#F5F6F7' : '#22262B'}`, color: assetFilter === t ? '#F5F6F7' : '#8A8F98' }} onClick={() => setAssetFilter(t)}>
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
          style={{ padding: '9px 18px', borderRadius: 999, background: '#F5F6F7', color: '#0A0B0D', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
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
      {!m.loading && filteredAssets.length === 0 && <div style={{ fontSize: 12.5, color: '#565b64' }}>No assets yet.</div>}

      <div style={sectionTitle}>Campaigns</div>
      <div style={{ ...cardStyle, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <input style={{ ...inputStyle, flex: 1, minWidth: 160 }} placeholder="Campaign name" value={newCampaignName} onChange={(e) => setNewCampaignName(e.target.value)} />
        <div
          style={{ padding: '9px 18px', borderRadius: 999, background: '#F5F6F7', color: '#0A0B0D', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
          onClick={async () => { if (!newCampaignName.trim()) return; await m.addCampaign({ name: newCampaignName.trim(), status: 'planned' }); setNewCampaignName(''); }}
        >
          Add campaign
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {m.campaigns.map((c) => (
          <div key={c.id} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: '#F5F6F7' }}>{c.name}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['planned', 'running', 'done'] as const).map((s) => (
                  <div
                    key={s}
                    onClick={() => m.updateCampaign(c.id, { status: s })}
                    style={{
                      padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      border: `1px solid ${c.status === s ? STATUS_COLOR[s] : '#22262B'}`,
                      color: c.status === s ? STATUS_COLOR[s] : '#565b64',
                    }}
                  >
                    {STATUS_LABEL[s]}
                  </div>
                ))}
                <span style={{ fontSize: 11, color: '#565b64', cursor: 'pointer', marginLeft: 6 }} onClick={() => m.removeCampaign(c.id)}>Delete</span>
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
        {!m.loading && m.campaigns.length === 0 && <div style={{ fontSize: 12.5, color: '#565b64' }}>No campaigns yet.</div>}
      </div>

      <div style={sectionTitle}>Content pipeline</div>
      <div style={{ ...cardStyle, display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
        <input style={{ ...inputStyle, flex: 1 }} placeholder="New content idea" value={newPipelineTitle} onChange={(e) => setNewPipelineTitle(e.target.value)} />
        <div
          style={{ padding: '9px 18px', borderRadius: 999, background: '#F5F6F7', color: '#0A0B0D', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
          onClick={async () => { if (!newPipelineTitle.trim()) return; await m.addPipelineItem(newPipelineTitle.trim()); setNewPipelineTitle(''); }}
        >
          Add idea
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {STAGES.map((stage) => (
          <div key={stage}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#8A8F98', textTransform: 'uppercase', marginBottom: 8 }}>{STAGE_LABEL[stage]}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {m.pipeline.filter((p) => p.stage === stage).map((p) => (
                <div key={p.id} style={{ ...cardStyle, padding: 12 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: '#F5F6F7' }}>{p.title}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {STAGES.filter((s) => s !== stage).map((s) => (
                      <span key={s} style={{ fontSize: 10, color: '#565b64', cursor: 'pointer', border: '1px solid #22262B', borderRadius: 999, padding: '2px 8px' }} onClick={() => m.updatePipelineItem(p.id, { stage: s })}>
                        → {STAGE_LABEL[s]}
                      </span>
                    ))}
                    <span style={{ fontSize: 10, color: '#565b64', cursor: 'pointer' }} onClick={() => m.removePipelineItem(p.id)}>Delete</span>
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
