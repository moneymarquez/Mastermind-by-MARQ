import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useScalingProjects, useDeliveryLog } from '../../data/useScalingProjects';
import type { ScalingProject } from '../../data/useScalingProjects';
import { useClientDocuments } from '../../data/useClientDocuments';
import { supabase } from '../../lib/supabase';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
  onNavigate: (id: string) => void;
}

const cardStyle: CSSProperties = { background: '#14161A', border: '1px solid #22262B', borderRadius: 14, padding: 20 };
const inputStyle: CSSProperties = {
  width: '100%', background: '#1a1c21', border: '1px solid #2b2f36', borderRadius: 8,
  padding: '9px 12px', color: '#F5F6F7', fontSize: 13, outline: 'none', boxSizing: 'border-box',
};
const primaryBtn: CSSProperties = {
  padding: '9px 16px', borderRadius: 999, border: 'none', background: '#F5F6F7', color: '#0A0B0D',
  fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
};
const ghostBtn: CSSProperties = {
  padding: '7px 13px', borderRadius: 999, border: '1px solid #2b2f36', background: 'transparent',
  color: '#C7CAD1', fontSize: 12, fontWeight: 600, cursor: 'pointer',
};

const TABS: { key: ScalingProject['status']; label: string }[] = [
  { key: 'in_progress', label: 'In progress' },
  { key: 'ready_to_deliver', label: 'Ready to deliver' },
  { key: 'delivered', label: 'Delivered (portfolio)' },
];

function statusBadge(status: ScalingProject['status']): CSSProperties {
  const colors: Record<ScalingProject['status'], string> = { in_progress: '#8A8F98', ready_to_deliver: '#C9A24B', delivered: '#8fae8f' };
  const c = colors[status];
  return { padding: '3px 9px', borderRadius: 999, background: `${c}22`, border: `1px solid ${c}55`, color: c, fontSize: 10, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase' };
}

function invoiceTotal(lineItems: { qty?: string; rate?: string }[]): number {
  return lineItems.reduce((sum, li) => sum + (Number(li.qty) || 0) * (Number(li.rate) || 0), 0);
}

async function authedFetch(path: string, body: unknown): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not signed in.');
  return fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

export default function ClientDeliveryScreen({ homeHeadStyle, homeSubStyle, onNavigate }: Props) {
  const { projects, loading, patch, uploadVideo, videoSignedUrl, removeVideo } = useScalingProjects();
  const { documents } = useClientDocuments();
  const [tab, setTab] = useState<ScalingProject['status']>('in_progress');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [clientNameDraft, setClientNameDraft] = useState('');
  const [clientEmailDraft, setClientEmailDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const { entries: logEntries, addEntry } = useDeliveryLog(selectedId);

  const selected = projects.find((p) => p.id === selectedId) ?? null;
  const invoice = selected ? documents.find((d) => d.id === selected.invoice_document_id) : null;
  const filtered = projects.filter((p) => p.status === tab);

  const open = (p: ScalingProject) => {
    setSelectedId(p.id);
    setClientNameDraft(p.client_name ?? '');
    setClientEmailDraft(p.client_email ?? '');
    setVideoUrl(null);
    setSendError('');
    if (p.video_path) videoSignedUrl(p.video_path).then(setVideoUrl);
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    setUploading(true);
    const ok = await uploadVideo(selected.id, file);
    setUploading(false);
    if (ok) {
      const { data } = await supabase.from('scaling_projects').select('video_path').eq('id', selected.id).single();
      if (data?.video_path) videoSignedUrl(data.video_path).then(setVideoUrl);
    }
  };

  const markReady = async () => {
    if (!selected) return;
    await patch(selected.id, { client_name: clientNameDraft.trim() || null, client_email: clientEmailDraft.trim() || null, status: 'ready_to_deliver' });
    await addEntry('marked_ready', `${clientNameDraft.trim() || 'Client'} — package assembled`);
  };

  const sendToClient = async () => {
    if (!selected || !selected.client_email) return;
    setSending(true);
    setSendError('');
    try {
      const invoiceSummary = invoice
        ? `Invoice total: $${invoiceTotal((invoice.data.line_items as { qty?: string; rate?: string }[]) ?? []).toFixed(2)} — a full invoice will follow separately from Invoicing.`
        : undefined;
      const res = await authedFetch('/api/deliver-email', {
        to: selected.client_email,
        clientName: selected.client_name ?? undefined,
        projectName: selected.name,
        previewUrl: selected.website_url ?? undefined,
        videoUrl: videoUrl ?? undefined,
        invoiceSummary,
      });
      const resBody = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(resBody.error || `Send failed (${res.status})`);
      await patch(selected.id, { status: 'delivered', delivered_at: new Date().toISOString() });
      await addEntry('sent_to_client', `Sent to ${selected.client_email}`);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Could not send — try again.');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div style={homeSubStyle}>Loading…</div>;

  if (selected) {
    return (
      <div>
        <span style={ghostBtn} onClick={() => setSelectedId(null)}>← All projects</span>
        <div style={{ ...homeHeadStyle, marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          {selected.name}
          <span style={statusBadge(selected.status)}>{selected.status.replace(/_/g, ' ')}</span>
        </div>
        <div style={homeSubStyle}>
          {selected.website_url ? <a href={selected.website_url} target="_blank" rel="noreferrer" style={{ color: '#8A8F98' }}>{selected.website_url}</a> : 'No live preview link yet — set one from Start.'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 22, maxWidth: 560 }}>
          <div style={cardStyle}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F6F7', marginBottom: 12 }}>Client</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input style={{ ...inputStyle, flex: 1, minWidth: 160 }} placeholder="Client name" value={clientNameDraft} onChange={(e) => setClientNameDraft(e.target.value)} disabled={selected.status === 'delivered'} />
              <input style={{ ...inputStyle, flex: 1, minWidth: 200 }} placeholder="Client email" value={clientEmailDraft} onChange={(e) => setClientEmailDraft(e.target.value)} disabled={selected.status === 'delivered'} />
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F6F7', marginBottom: 12 }}>Walkthrough video</div>
            <div style={{ fontSize: 11.5, color: '#565b64', marginBottom: 10 }}>
              Manually uploaded — no automated video generation here.
            </div>
            {videoUrl && <video src={videoUrl} controls style={{ width: '100%', borderRadius: 8, marginBottom: 10, background: '#000' }} />}
            <div style={{ display: 'flex', gap: 8 }}>
              <input ref={fileInput} type="file" accept="video/*" style={{ display: 'none' }} onChange={onUpload} />
              <div style={ghostBtn} onClick={() => fileInput.current?.click()}>{uploading ? 'Uploading…' : selected.video_path ? 'Replace video' : 'Upload video'}</div>
              {selected.video_path && <div style={ghostBtn} onClick={() => { removeVideo(selected.id, selected.video_path!); setVideoUrl(null); }}>Remove</div>}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F6F7', marginBottom: 12 }}>Invoice</div>
            {invoice ? (
              <div style={{ fontSize: 12.5, color: '#8A8F98' }}>
                {invoice.label} — ${invoiceTotal((invoice.data.line_items as { qty?: string; rate?: string }[]) ?? []).toFixed(2)}
                <span style={{ marginLeft: 10, cursor: 'pointer', color: '#C7CAD1' }} onClick={() => onNavigate('invoicing')}>Open →</span>
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: '#565b64' }}>No invoice linked yet — generate one from the project's Start page, or create one in Invoicing.</div>
            )}
          </div>

          {selected.status === 'in_progress' && (
            <div style={primaryBtn} onClick={markReady}>Mark ready to deliver</div>
          )}

          {selected.status === 'ready_to_deliver' && (
            <div>
              <div style={primaryBtn} onClick={sendToClient}>
                {sending ? 'Sending…' : 'Send to client'}
              </div>
              {!selected.client_email && <div style={{ fontSize: 11.5, color: '#565b64', marginTop: 8 }}>Add a client email above first.</div>}
              {sendError && <div style={{ fontSize: 12, color: '#c47a7a', marginTop: 8 }}>{sendError}</div>}
            </div>
          )}

          <div style={cardStyle}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F6F7', marginBottom: 12 }}>Delivery log</div>
            {logEntries.length === 0 && <div style={{ fontSize: 12, color: '#565b64' }}>Nothing logged yet.</div>}
            {logEntries.map((e) => (
              <div key={e.id} style={{ fontSize: 12, color: '#8A8F98', padding: '6px 0', borderTop: '1px solid #1c1e23' }}>
                <span style={{ color: '#C7CAD1', fontWeight: 600 }}>{e.event.replace(/_/g, ' ')}</span> — {e.note} · {new Date(e.created_at).toLocaleString()}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={homeHeadStyle}>Show Your Work</div>
      <div style={homeSubStyle}>The client delivery pipeline — assemble a package, send it, and keep a running portfolio.</div>

      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        {TABS.map((t) => (
          <div key={t.key} style={{ ...ghostBtn, ...(tab === t.key ? { background: '#F5F6F7', color: '#0A0B0D', border: 'none' } : {}) }} onClick={() => setTab(t.key)}>
            {t.label} ({projects.filter((p) => p.status === t.key).length})
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14, marginTop: 20, maxWidth: 900 }}>
        {filtered.map((p) => (
          <div key={p.id} style={{ ...cardStyle, cursor: 'pointer' }} onClick={() => open(p)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: '#F5F6F7' }}>{p.name}</div>
              <span style={statusBadge(p.status)}>{p.status.replace(/_/g, ' ')}</span>
            </div>
            {p.client_name && <div style={{ fontSize: 11.5, color: '#8A8F98', marginTop: 6 }}>{p.client_name}</div>}
            {p.status === 'delivered' && p.delivered_at && (
              <div style={{ fontSize: 10.5, color: '#565b64', marginTop: 6 }}>Delivered {new Date(p.delivered_at).toLocaleDateString()}</div>
            )}
            {p.website_url && <div style={{ fontSize: 10.5, color: '#565b64', marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.website_url}</div>}
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ fontSize: 12.5, color: '#565b64' }}>Nothing here yet — projects start in Scaling → Start.</div>
        )}
      </div>
    </div>
  );
}
