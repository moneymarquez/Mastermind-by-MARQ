import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { MarketingBrief } from '../../data/useMarketingBriefs';
import type { MarketingPlay } from '../../data/useMarketingPlays';
import type { MarketingAsset } from '../../data/useMarketing';
import type { ClientMedia } from '../../data/types';
import { generateBuildOut } from '../../lib/marketingBuildOut';
import type { BuildOutResult, BuildOutVariant } from '../../lib/marketingBuildOut';
import { buildMetaExportBlock, buildGoogleExportBlock } from '../../lib/marketingExportBlocks';
import { AiError } from '../../lib/ai';

interface Props {
  brief: MarketingBrief;
  clientName: string;
  /** The one active paid/offline play, if any — build-out only ever
   *  applies to the play the operator actually picked. */
  activePlay: MarketingPlay | null;
  /** marketing_assets rows already filtered to this play_id. */
  assets: MarketingAsset[];
  /** client_media rows already filtered to this play_id. */
  media: ClientMedia[];
  mediaLoading: boolean;
  onSave: (play: MarketingPlay, result: BuildOutResult) => Promise<void>;
  onUploadMedia: (file: File) => Promise<void>;
  onRemoveMedia: (id: string, storagePath: string) => void;
  mediaUrl: (path: string) => Promise<string | null>;
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 20 };
const subCard: CSSProperties = { background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-lg)', padding: 16 };
const ghostBtn: CSSProperties = {
  padding: '7px 14px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
  fontSize: 'var(--text-small)', cursor: 'pointer',
};
const primaryBtn: CSSProperties = {
  padding: '7px 14px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--text)', color: 'var(--bg)',
  fontSize: 'var(--text-small)', fontWeight: 600, cursor: 'pointer',
};
const label: CSSProperties = { fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.4 };
const pre: CSSProperties = { whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 'var(--text-body-sm)', color: 'var(--text)', margin: 0, lineHeight: 1.6 };

function safeParseVariants(content: string | null): BuildOutVariant[] | null {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function latestByTag(assets: MarketingAsset[], tag: string): MarketingAsset | null {
  const matches = assets.filter((a) => a.tags?.includes(tag));
  if (matches.length === 0) return null;
  return [...matches].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span
      style={ghostBtn}
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </span>
  );
}

/** Screen 5 of the Marketing Plays rebuild (build order item 4) —
 *  generates the build-out for whichever play is active in the channel
 *  slate, then saves it as marketing_assets rows tagged to that play.
 *  Deliberately not an image editor (explicit build-prompt rule) — photo
 *  upload here is plain attach/tag/list, nothing else. */
export default function MarketingBuildOut({ brief, clientName, activePlay, assets, media, mediaLoading, onSave, onUploadMedia, onRemoveMedia, mediaUrl }: Props) {
  const [draft, setDraft] = useState<BuildOutResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!activePlay) {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>Nothing picked yet</div>
        <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)', marginTop: 6, lineHeight: 1.5 }}>
          Pick a play from the channel slate above once it's unlocked — build-out generates the copy, creative direction, and shot list for whichever one you choose.
        </div>
      </div>
    );
  }

  const variantsAsset = latestByTag(assets, 'variants');
  const captionAsset = latestByTag(assets, 'caption');
  const gbpAsset = latestByTag(assets, 'gbp');
  const creativeAsset = latestByTag(assets, 'creative');
  const savedVariants = safeParseVariants(variantsAsset?.content ?? null);
  const hasSaved = !!variantsAsset && !!savedVariants;

  const generate = async () => {
    setGenerating(true);
    setError('');
    try {
      const result = await generateBuildOut(activePlay, brief, clientName);
      setDraft(result);
    } catch (e) {
      setError(e instanceof AiError ? e.message : 'Could not generate the build-out — try again.');
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await onSave(activePlay, draft);
      setDraft(null);
    } finally {
      setSaving(false);
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const list = Array.from(files);
    setUploading(list.map((f) => f.name));
    for (const file of list) {
      try {
        await onUploadMedia(file);
      } catch {
        // Errors surface per-file failure implicitly (the file just never
        // appears in the media list below) — consistent with this app's
        // other upload flows (ClientMediaGrid) where a bad file doesn't
        // block the rest of the batch.
      }
    }
    setUploading([]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)' }}>Building out: <strong style={{ color: 'var(--text)' }}>{activePlay.title}</strong></div>

      {!draft && !hasSaved && (
        <div style={cardStyle}>
          <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>No build-out yet</div>
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)', marginTop: 6, lineHeight: 1.5 }}>
            Generates ad copy (three variants), a caption or GBP description where relevant, creative direction, and a concrete shot list for {clientName || 'this client'}.
          </div>
          {error && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--danger)', marginTop: 10 }}>{error}</div>}
          <div style={{ ...primaryBtn, marginTop: 14, display: 'inline-block', opacity: generating ? 0.6 : 1, cursor: generating ? 'default' : 'pointer' }} onClick={() => !generating && generate()}>
            {generating ? 'Generating…' : 'Build it out'}
          </div>
        </div>
      )}

      {draft && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>Preview — not saved yet</div>
            <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700 }}>{draft.primary_asset_label}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            {draft.variants.map((v, i) => (
              <div key={i} style={subCard}>
                <div style={label}>Variant {i + 1}</div>
                <div style={{ fontSize: 'var(--text-body-sm)', fontWeight: 600, color: 'var(--text)', marginTop: 6 }}>{v.headline}</div>
                <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>{v.body}</div>
              </div>
            ))}
            {draft.caption && (
              <div style={subCard}><div style={label}>Caption</div><p style={{ ...pre, marginTop: 6 }}>{draft.caption}</p></div>
            )}
            {draft.gbp_description && (
              <div style={subCard}><div style={label}>GBP description</div><p style={{ ...pre, marginTop: 6 }}>{draft.gbp_description}</p></div>
            )}
            <div style={subCard}>
              <div style={label}>Creative direction</div>
              <p style={{ ...pre, marginTop: 6 }}>{draft.creative_direction}</p>
              <div style={{ ...label, marginTop: 12 }}>Shot list</div>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {draft.shot_list.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <span style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }} onClick={() => !saving && save()}>{saving ? 'Saving…' : 'Save these assets'}</span>
            <span style={ghostBtn} onClick={() => !saving && generate()}>Regenerate</span>
            <span style={ghostBtn} onClick={() => setDraft(null)}>Discard</span>
          </div>
        </div>
      )}

      {hasSaved && !draft && (
        <>
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>Saved build-out</div>
              <span style={ghostBtn} onClick={() => !generating && generate()}>{generating ? 'Generating…' : 'Regenerate'}</span>
            </div>
            {error && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--danger)', marginTop: 10 }}>{error}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
              {savedVariants?.map((v, i) => (
                <div key={i} style={subCard}>
                  <div style={label}>Variant {i + 1}</div>
                  <div style={{ fontSize: 'var(--text-body-sm)', fontWeight: 600, color: 'var(--text)', marginTop: 6 }}>{v.headline}</div>
                  <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>{v.body}</div>
                </div>
              ))}
              {captionAsset?.content && <div style={subCard}><div style={label}>Caption</div><p style={{ ...pre, marginTop: 6 }}>{captionAsset.content}</p></div>}
              {gbpAsset?.content && <div style={subCard}><div style={label}>GBP description</div><p style={{ ...pre, marginTop: 6 }}>{gbpAsset.content}</p></div>}
              {creativeAsset?.content && <div style={subCard}><div style={label}>Creative direction & shot list</div><p style={{ ...pre, marginTop: 6 }}>{creativeAsset.content}</p></div>}
            </div>
          </div>

          {savedVariants && savedVariants.length > 0 && (
            <div style={cardStyle}>
              <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Export blocks</div>
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginBottom: 12 }}>Copy-paste into Meta Ads Manager or Google Ads by hand — nothing here posts automatically.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={subCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={label}>Meta</div>
                    <CopyButton text={buildMetaExportBlock(savedVariants, captionAsset?.content ?? null)} />
                  </div>
                  <p style={{ ...pre, marginTop: 8 }}>{buildMetaExportBlock(savedVariants, captionAsset?.content ?? null)}</p>
                </div>
                <div style={subCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={label}>Google</div>
                    <CopyButton text={buildGoogleExportBlock(savedVariants)} />
                  </div>
                  <p style={{ ...pre, marginTop: 8 }}>{buildGoogleExportBlock(savedVariants)}</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <div style={cardStyle}>
        <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Shot photos</div>
        <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginBottom: 12 }}>Real photos of the real business beat generated images — upload what you shoot from the list above.</div>
        <div style={{ border: '1px dashed var(--border-2)', borderRadius: 'var(--radius-lg)', padding: '16px', textAlign: 'center', cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)' }}>Tap to add photos</div>
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple style={{ display: 'none' }} onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />
        </div>
        {uploading.length > 0 && <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 8 }}>Uploading {uploading.join(', ')}…</div>}
        {!mediaLoading && media.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10, marginTop: 12 }}>
            {media.map((m) => <MediaThumb key={m.id} m={m} mediaUrl={mediaUrl} onRemove={() => onRemoveMedia(m.id, m.storage_path)} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function MediaThumb({ m, mediaUrl, onRemove }: { m: ClientMedia; mediaUrl: (p: string) => Promise<string | null>; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const isImage = !!m.mime_type?.startsWith('image/');
  useEffect(() => {
    let live = true;
    if (isImage) mediaUrl(m.storage_path).then((u) => { if (live) setUrl(u); });
    return () => { live = false; };
  }, [m.storage_path, isImage, mediaUrl]);
  return (
    <div style={{ position: 'relative' }}>
      {isImage && url ? (
        <img src={url} alt="" style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 'var(--radius-sm)', display: 'block' }} />
      ) : (
        <div style={{ width: '100%', height: 90, borderRadius: 'var(--radius-sm)', background: 'var(--surface-4)' }} />
      )}
      <div style={{ ...ghostBtn, position: 'absolute', top: 4, right: 4, padding: '2px 8px', fontSize: 11, background: 'var(--bg)' }} onClick={onRemove}>✕</div>
    </div>
  );
}
