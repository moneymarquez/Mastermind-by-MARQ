import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, DragEvent } from 'react';
import { useClientMedia } from '../../data/useClientMedia';
import type { ClientMediaCategory } from '../../data/types';
import { cardStyle, ghostBtn, selectStyle } from './ClientCRMScreen';
import Icon from '../../Icon';

interface Props {
  clientId: string;
  auditId: string | null;
}

const CATEGORIES: { key: ClientMediaCategory; label: string }[] = [
  { key: 'truck', label: 'Truck' },
  { key: 'food', label: 'Food' },
  { key: 'business_card', label: 'Business card' },
  { key: 'screenshot', label: 'Screenshot' },
  { key: 'other', label: 'Other' },
];

const dropZone = (active: boolean): CSSProperties => ({
  border: `1px dashed ${active ? 'var(--text)' : 'var(--border-2)'}`, borderRadius: 'var(--radius-lg)', padding: '20px 16px',
  textAlign: 'center', cursor: 'pointer', background: active ? 'var(--surface-4)' : 'transparent', transition: 'background 120ms ease',
});

function Thumb({ path, isImage, mediaUrl }: { path: string; isImage: boolean; mediaUrl: (p: string) => Promise<string | null> }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (isImage) mediaUrl(path).then((u) => { if (live) setUrl(u); });
    return () => { live = false; };
  }, [path, isImage, mediaUrl]);

  if (!isImage) {
    return <div style={{ width: '100%', height: 100, borderRadius: 'var(--radius-sm)', background: 'var(--surface-4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="file-text" size={26} color="var(--text-tertiary)" /></div>;
  }
  return url ? (
    <img src={url} alt="" style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 'var(--radius-sm)', display: 'block' }} />
  ) : (
    <div style={{ width: '100%', height: 100, borderRadius: 'var(--radius-sm)', background: 'var(--surface-4)' }} />
  );
}

/** Step 2 of the client-login/audit/invoice build — raw source photos and
 *  documents attached while standing in front of the client, distinct
 *  from ClientReportsTab's owner-authored client-facing deliverables.
 *  Multi-file, per-file progress, category-tagged, deletable. */
export default function ClientMediaGrid({ clientId, auditId }: Props) {
  const { media, loading, uploadMedia, removeMedia, mediaUrl } = useClientMedia(clientId);
  const [category, setCategory] = useState<ClientMediaCategory>('other');
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState<{ name: string; done: boolean; error?: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const list = Array.from(files);
    setUploading(list.map((f) => ({ name: f.name, done: false })));
    for (const file of list) {
      try {
        await uploadMedia(file, category, auditId);
        setUploading((prev) => prev.map((u) => (u.name === file.name ? { ...u, done: true } : u)));
      } catch (err) {
        setUploading((prev) => prev.map((u) => (u.name === file.name ? { ...u, done: true, error: err instanceof Error ? err.message : 'Upload failed.' } : u)));
      }
    }
    setTimeout(() => setUploading([]), 2500);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>Photos & files{media.length ? ` (${media.length})` : ''}</div>
        <select style={{ ...selectStyle, width: 'auto' }} value={category} onChange={(e) => setCategory(e.target.value as ClientMediaCategory)}>
          {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </div>

      <div
        style={dropZone(dragActive)}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
      >
        <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)' }}>Tap to add photos or a file, or drag & drop</div>
        <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 4 }}>Images or PDF, up to 10MB each — tagged as "{CATEGORIES.find((c) => c.key === category)?.label}"</div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {uploading.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {uploading.map((u) => (
            <div key={u.name} style={{ fontSize: 'var(--text-caption)', color: u.error ? 'var(--danger)' : u.done ? 'var(--success)' : 'var(--text-tertiary)' }}>
              {u.name} — {u.error ?? (u.done ? 'Uploaded' : 'Uploading…')}
            </div>
          ))}
        </div>
      )}

      {!loading && media.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
          {media.map((m) => (
            <div key={m.id} style={{ position: 'relative' }}>
              <Thumb path={m.storage_path} isImage={!!m.mime_type?.startsWith('image/')} mediaUrl={mediaUrl} />
              <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-tertiary)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {CATEGORIES.find((c) => c.key === m.category)?.label}
              </div>
              <div style={{ ...ghostBtn, position: 'absolute', top: 4, right: 4, padding: '2px 8px', fontSize: 11, background: 'var(--bg)' }} onClick={() => removeMedia(m.id, m.storage_path)}>
                ✕
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && media.length === 0 && uploading.length === 0 && (
        <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)' }}>Nothing uploaded yet.</div>
      )}
    </div>
  );
}
