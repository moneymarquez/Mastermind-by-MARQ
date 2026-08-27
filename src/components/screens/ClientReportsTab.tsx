import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useClientReports } from '../../data/useClientReports';
import type { ClientReport, ClientReportAsset, ReportAssetKind, ReportAssetStatus } from '../../data/types';
import { cardStyle, inputStyle, selectStyle, primaryBtn, ghostBtn } from './ClientCRMScreen';

interface Props {
  clientId: string;
  publicToken: string;
}

const textareaStyle: CSSProperties = {
  width: '100%', minHeight: 70, background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)',
  padding: '10px 13px', color: 'var(--text)', fontSize: 'var(--text-body)', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box',
};
const labelStyle: CSSProperties = { fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)', marginBottom: 4 };
const sectionTitle: CSSProperties = { fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginBottom: 12 };

/** Numeric fields are stored as null when blank rather than 0 — "we didn't
 *  track this" and "this was zero" are different claims to put in front of
 *  a paying client. */
function numOrNull(v: string): number | null {
  const t = v.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function MetricInput({ label, value, onCommit }: { label: string; value: number | null; onCommit: (v: number | null) => void }) {
  const [draft, setDraft] = useState(value === null ? '' : String(value));
  useEffect(() => { setDraft(value === null ? '' : String(value)); }, [value]);
  return (
    <div style={{ flex: '1 1 120px' }}>
      <div style={labelStyle}>{label}</div>
      <input
        style={inputStyle}
        value={draft}
        placeholder="—"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { const n = numOrNull(draft); if (n !== value) onCommit(n); }}
      />
    </div>
  );
}

function TextField({ label, value, onCommit, placeholder }: { label: string; value: string | null; onCommit: (v: string | null) => void; placeholder?: string }) {
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => { setDraft(value ?? ''); }, [value]);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={labelStyle}>{label}</div>
      <textarea
        style={textareaStyle}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { const v = draft.trim() || null; if (v !== value) onCommit(v); }}
      />
    </div>
  );
}

function AssetThumb({
  asset, getUrl, onStatus, onRemove,
}: {
  asset: ClientReportAsset;
  getUrl: (p: string) => Promise<string | null>;
  onStatus: (s: ReportAssetStatus) => void;
  onRemove: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { getUrl(asset.storage_path).then(setUrl); }, [asset.storage_path, getUrl]);
  const isImage = (asset.mime_type ?? '').startsWith('image/');

  return (
    <div style={{ width: 132, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ width: 132, height: 96, borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--surface-4)', border: '1px solid var(--border-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isImage && url
          ? <img src={url} alt={asset.file_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-tertiary)', padding: 8, textAlign: 'center', wordBreak: 'break-word' }}>{asset.file_name}</span>}
      </div>
      {asset.kind === 'proof' && (
        <select style={{ ...selectStyle, padding: '5px 8px', fontSize: 'var(--text-tiny)' }} value={asset.status} onChange={(e) => onStatus(e.target.value as ReportAssetStatus)}>
          <option value="draft">Draft</option>
          <option value="approved">Approved</option>
          <option value="live">Live</option>
        </select>
      )}
      <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={onRemove}>Remove</span>
    </div>
  );
}

export default function ClientReportsTab({ clientId, publicToken }: Props) {
  const r = useClientReports(clientId);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newPeriod, setNewPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [campaignName, setCampaignName] = useState('');
  const [campaignDesc, setCampaignDesc] = useState('');
  const [campaignDate, setCampaignDate] = useState('');
  const [campaignResult, setCampaignResult] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [copied, setCopied] = useState(false);

  const dashboardUrl = `${window.location.origin}/client/${publicToken}`;

  useEffect(() => {
    if (!activeId && r.reports.length) setActiveId(r.reports[0].id);
  }, [r.reports, activeId]);

  const active = r.reports.find((x) => x.id === activeId) ?? null;

  const addPeriod = async () => {
    const label = new Date(`${newPeriod}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const created = await r.createReport(`${newPeriod}-01`, label);
    if (created) setActiveId(created.id);
  };

  const patch = (p: Partial<ClientReport>) => { if (active) r.patchReport(active.id, p); };

  const upload = async (files: FileList | null, kind: ReportAssetKind) => {
    if (!files?.length || !active) return;
    setUploading(true);
    setUploadError('');
    try {
      for (const file of Array.from(files)) await r.uploadAsset(active.id, file, kind);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const followerDelta = active && active.followers_start !== null && active.followers_end !== null
    ? active.followers_end - active.followers_start
    : null;

  if (r.loading) return <div style={{ marginTop: 18, fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>Loading…</div>;

  return (
    <div style={{ marginTop: 18, maxWidth: 680 }}>
      <div style={{ ...cardStyle, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 'var(--text-body-sm)', fontWeight: 600, color: 'var(--text)' }}>Client dashboard link</div>
          <div style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)', marginTop: 3, wordBreak: 'break-all' }}>{dashboardUrl}</div>
          <div style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)', marginTop: 4 }}>
            Auto-attached to every invoice footer. Only published periods appear.
          </div>
        </div>
        <div
          style={ghostBtn}
          onClick={() => { navigator.clipboard?.writeText(dashboardUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        >
          {copied ? 'Copied' : 'Copy link'}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <select style={{ ...selectStyle, width: 'auto', flex: '1 1 160px' }} value={activeId ?? ''} onChange={(e) => setActiveId(e.target.value || null)}>
          {r.reports.length === 0 && <option value="">No periods yet</option>}
          {r.reports.map((rep) => (
            <option key={rep.id} value={rep.id}>{rep.period_label}{rep.published ? '' : ' (draft)'}</option>
          ))}
        </select>
        <input style={{ ...inputStyle, width: 150 }} type="month" value={newPeriod} onChange={(e) => setNewPeriod(e.target.value)} />
        <div style={primaryBtn} onClick={addPeriod}>+ Period</div>
      </div>

      {!active ? (
        <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>Add a reporting period to start filling in this client's report.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)' }}>
              {active.published ? 'Published — visible on the client dashboard.' : 'Draft — not visible to the client yet.'}
            </div>
            <div style={active.published ? ghostBtn : primaryBtn} onClick={() => patch({ published: !active.published })}>
              {active.published ? 'Unpublish' : 'Publish to client'}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={sectionTitle}>Performance &amp; Proof</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <MetricInput label="Reach / impressions" value={active.reach} onCommit={(v) => patch({ reach: v })} />
              <MetricInput label="Engagements" value={active.engagement_count} onCommit={(v) => patch({ engagement_count: v })} />
            </div>
            <div style={{ marginTop: 12 }}>
              <TextField label="Engagement summary" value={active.engagement_summary} onCommit={(v) => patch({ engagement_summary: v })} placeholder="Likes, comments, shares — or a short summary" />
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <MetricInput label="Followers — start" value={active.followers_start} onCommit={(v) => patch({ followers_start: v })} />
              <MetricInput label="Followers — end" value={active.followers_end} onCommit={(v) => patch({ followers_end: v })} />
              <div style={{ flex: '1 1 120px', paddingBottom: 10 }}>
                <div style={labelStyle}>Growth</div>
                <div style={{ fontSize: 'var(--text-subhead)', fontWeight: 600, color: followerDelta === null ? 'var(--text-tertiary)' : followerDelta >= 0 ? '#4a9a5a' : '#c47a7a' }}>
                  {followerDelta === null ? '—' : `${followerDelta >= 0 ? '+' : ''}${followerDelta.toLocaleString()}`}
                </div>
              </div>
            </div>
            <div style={{ ...labelStyle, marginTop: 16, marginBottom: 8, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase' }}>Google Business Profile</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <MetricInput label="Views" value={active.gbp_views} onCommit={(v) => patch({ gbp_views: v })} />
              <MetricInput label="Calls" value={active.gbp_calls} onCommit={(v) => patch({ gbp_calls: v })} />
              <MetricInput label="Direction requests" value={active.gbp_directions} onCommit={(v) => patch({ gbp_directions: v })} />
            </div>
          </div>

          <div style={cardStyle}>
            <div style={sectionTitle}>Content gallery</div>
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginBottom: 10 }}>Delivered work this period — shown to the client as-is.</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              {active.assets.filter((a) => a.kind === 'content').map((a) => (
                <AssetThumb key={a.id} asset={a} getUrl={r.assetPreviewUrl} onStatus={(s) => r.setAssetStatus(a.id, s)} onRemove={() => r.removeAsset(a.id, a.storage_path)} />
              ))}
            </div>
            <input type="file" multiple accept="image/*,video/*" onChange={(e) => { upload(e.target.files, 'content'); e.target.value = ''; }} style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)' }} />
          </div>

          <div style={cardStyle}>
            <div style={sectionTitle}>Design proofs &amp; drafts</div>
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginBottom: 10 }}>
              Only Approved and Live proofs reach the client dashboard — Drafts stay internal.
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              {active.assets.filter((a) => a.kind === 'proof').map((a) => (
                <AssetThumb key={a.id} asset={a} getUrl={r.assetPreviewUrl} onStatus={(s) => r.setAssetStatus(a.id, s)} onRemove={() => r.removeAsset(a.id, a.storage_path)} />
              ))}
            </div>
            <input type="file" multiple onChange={(e) => { upload(e.target.files, 'proof'); e.target.value = ''; }} style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)' }} />
            {uploading && <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)', marginTop: 8 }}>Uploading…</div>}
            {uploadError && <div style={{ fontSize: 'var(--text-small)', color: '#c47a7a', marginTop: 8 }}>{uploadError}</div>}
          </div>

          <div style={cardStyle}>
            <div style={sectionTitle}>Campaign log</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {active.campaigns.map((c) => (
                <div key={c.id} style={{ padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--surface-4)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ fontSize: 'var(--text-body-sm)', fontWeight: 600, color: 'var(--text)' }}>{c.name}</div>
                    <span style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)', cursor: 'pointer', flexShrink: 0 }} onClick={() => r.removeCampaign(c.id)}>Remove</span>
                  </div>
                  {c.launched_on && <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-tertiary)', marginTop: 2 }}>Launched {c.launched_on}</div>}
                  {c.description && <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: 5 }}>{c.description}</div>}
                  {c.result_notes && <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: 5 }}><strong>Result:</strong> {c.result_notes}</div>}
                </div>
              ))}
              {active.campaigns.length === 0 && <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)' }}>No campaigns logged this period.</div>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input style={{ ...inputStyle, flex: '2 1 160px' }} placeholder="Campaign name" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
                <input style={{ ...inputStyle, flex: '1 1 130px' }} type="date" value={campaignDate} onChange={(e) => setCampaignDate(e.target.value)} />
              </div>
              <input style={inputStyle} placeholder="Description" value={campaignDesc} onChange={(e) => setCampaignDesc(e.target.value)} />
              <input style={inputStyle} placeholder="Result notes" value={campaignResult} onChange={(e) => setCampaignResult(e.target.value)} />
              <div
                style={primaryBtn}
                onClick={() => {
                  if (!campaignName.trim()) return;
                  r.addCampaign(active.id, {
                    name: campaignName.trim(),
                    description: campaignDesc.trim() || null,
                    launched_on: campaignDate || null,
                    result_notes: campaignResult.trim() || null,
                  });
                  setCampaignName(''); setCampaignDesc(''); setCampaignDate(''); setCampaignResult('');
                }}
              >
                Add campaign
              </div>
            </div>
          </div>

          <div style={cardStyle}>
            <div style={sectionTitle}>Financials &amp; transparency</div>
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginBottom: 12 }}>
              Payment history and upcoming invoices are pulled straight from the Invoices tab — nothing to re-enter here.
            </div>
            <TextField label="What's included this month" value={active.whats_included} onCommit={(v) => patch({ whats_included: v })} placeholder="Plain-language list of what their package covers this period" />
            <TextField label="ROI snapshot" value={active.roi_snapshot} onCommit={(v) => patch({ roi_snapshot: v })} placeholder='e.g. "$1,000 spent → est. 40 new customers reached"' />
          </div>

          <div style={cardStyle}>
            <div style={sectionTitle}>Notes &amp; next steps</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {active.notes.map((n) => (
                <div key={n.id} style={{ padding: 10, borderRadius: 'var(--radius-sm)', background: 'var(--surface-4)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-tertiary)' }}>{new Date(n.created_at).toLocaleString()}</div>
                    <span style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={() => r.removeNote(n.id)}>Remove</span>
                  </div>
                  <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text)', marginTop: 4, whiteSpace: 'pre-wrap' }}>{n.body}</div>
                </div>
              ))}
              {active.notes.length === 0 && <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)' }}>No notes yet.</div>}
            </div>
            <textarea style={textareaStyle} placeholder="Add an update the client will see…" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} />
            <div style={{ ...primaryBtn, marginTop: 8, display: 'inline-block' }} onClick={() => { r.addNote(active.id, noteDraft); setNoteDraft(''); }}>Add note</div>
            <div style={{ marginTop: 16 }}>
              <TextField label="Upcoming plan" value={active.upcoming_plan} onCommit={(v) => patch({ upcoming_plan: v })} placeholder="What's launching next period" />
            </div>
          </div>

          <div>
            <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={() => { r.removeReport(active.id); setActiveId(null); }}>
              Delete this reporting period
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
