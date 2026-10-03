import { useEffect, useRef, useState } from 'react';
import { useScalingProjects, useDeliveryLog } from '../../../data/useScalingProjects';
import type { ScalingProject } from '../../../data/useScalingProjects';
import { useClientDocuments } from '../../../data/useClientDocuments';
import { supabase } from '../../../lib/supabase';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import type { ChipKind } from '../../mm/Chip';
import Row from '../../mm/Row';
import Stat from '../../mm/Stat';
import { Empty } from '../../mm/States';
import { Page, Sheet, Field, field, useModule } from '../../mm/Page';
import { shortDate, usd } from './util';

const STATUS: Record<ScalingProject['status'], { l: string; k: ChipKind }> = {
  in_progress: { l: 'In progress', k: 'neutral' }, ready_to_deliver: { l: 'Ready', k: 'accent' }, delivered: { l: 'Delivered', k: 'good' },
};
const invoiceTotal = (items: { qty?: string; rate?: string }[]) => items.reduce((s, li) => s + (Number(li.qty) || 0) * (Number(li.rate) || 0), 0);
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };

async function authedFetch(path: string, body: unknown): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not signed in.');
  return fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
}

/** Show Your Work (design handoff: MM 5 Scaling): delivery packages for
 *  projects still in flight, and the portfolio of delivered ones. A
 *  package's checklist is the project's real parts (preview link, video,
 *  client email, invoice); nothing goes out until you tap Send. */
export default function ShowYourWorkV2({ onNavigate }: { onNavigate: (id: string) => void }) {
  const { device, novaOpen } = useModule();
  const phone = device === 'phone';
  const P = useScalingProjects();
  const { documents } = useClientDocuments();
  const [tab, setTab] = useState<'packages' | 'portfolio'>('packages');
  const [openId, setOpenId] = useState<string | null>(null);

  const packages = P.projects.filter((p) => p.status !== 'delivered');
  const portfolio = P.projects.filter((p) => p.status === 'delivered').sort((a, b) => (b.delivered_at ?? '').localeCompare(a.delivered_at ?? ''));
  const q0 = new Date(); q0.setMonth(Math.floor(q0.getMonth() / 3) * 3, 1); q0.setHours(0, 0, 0, 0);
  const sentQuarter = portfolio.filter((p) => p.delivered_at && Date.parse(p.delivered_at) >= q0.getTime()).length;
  const invoiceOf = (p: ScalingProject) => documents.find((d) => d.id === p.invoice_document_id) ?? null;
  const checklist = (p: ScalingProject) => [
    { n: 'Live preview link', ok: !!p.website_url },
    { n: 'Walkthrough video', ok: !!p.video_path },
    { n: 'Client email', ok: !!p.client_email },
    { n: 'Invoice', ok: !!invoiceOf(p) },
  ];
  const opened = P.projects.find((p) => p.id === openId) ?? null;
  const sheet = opened && <ProjectSheet key={opened.id} p={opened} invoice={invoiceOf(opened)} api={P} onNavigate={onNavigate} onClose={() => setOpenId(null)} />;

  if (!P.loading && P.projects.length === 0) {
    return (
      <Page title="Show Your Work" sub="Delivery packages and portfolio">
        <Empty text="Nothing to show yet. Finished client work collects here as packages and portfolio pieces. Projects start in Scaling → Start." cta="Go to Start" onCta={() => onNavigate('scaling-start')} />
      </Page>
    );
  }

  const packageCard = (p: ScalingProject) => {
    const items = checklist(p);
    return (
      <Card key={p.id} title={`${p.client_name ? `${p.client_name} · ` : ''}${p.name}`} meta={STATUS[p.status].l} wide={!phone}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((i) => (
            <div key={i.n} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, padding: '2px 0' }}>
              <span style={{ color: 'var(--text)' }}>{i.n}</span><Chip k={i.ok ? 'good' : 'neutral'}>{i.ok ? 'Ready' : 'Missing'}</Chip>
            </div>
          ))}
        </div>
        <button className={`mm-btn${p.status === 'ready_to_deliver' ? ' mm-btn--primary' : ''}`} style={{ height: 44, marginTop: 4 }} onClick={() => setOpenId(p.id)}>
          {p.status === 'ready_to_deliver' ? 'Review and send' : `Open package · ${items.filter((i) => i.ok).length} of ${items.length}`}
        </button>
      </Card>
    );
  };
  const packageList = packages.length ? packages.map(packageCard)
    : <Card wide={!phone}><span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>No packages in flight. Everything's delivered.</span></Card>;

  const tile = (p: ScalingProject) => (
    <button key={p.id} onClick={() => setOpenId(p.id)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{ aspectRatio: '4/3', width: '100%', background: 'repeating-linear-gradient(135deg, var(--surface-3) 0 8px, var(--surface-2) 8px 16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', padding: 8, boxSizing: 'border-box', overflow: 'hidden' }}>
        {p.website_url ? host(p.website_url) : 'No preview link'}
      </div>
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ color: 'var(--text)', fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.client_name ?? p.name}</span>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.client_name ? p.name : ''}{p.delivered_at ? `${p.client_name ? ' · ' : ''}${shortDate(p.delivered_at.slice(0, 10))}` : ''}</span>
      </div>
    </button>
  );
  const cols = phone ? 2 : device === 'desktop' && !novaOpen ? 4 : 3;
  const portfolioGrid = portfolio.length
    ? <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},minmax(0,1fr))`, gap: phone ? 10 : 16 }}>{portfolio.map(tile)}</div>
    : <Card wide={!phone}><span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Nothing delivered yet. Sent packages land here as portfolio pieces.</span></Card>;

  const seg = (
    <div role="tablist" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, padding: 3, borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      {(['packages', 'portfolio'] as const).map((t) => (
        <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} style={{ height: 38, border: 0, borderRadius: 999, background: tab === t ? 'var(--text)' : 'transparent', color: tab === t ? 'var(--bg)' : 'var(--text)', fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}>
          {t === 'packages' ? `Packages (${packages.length})` : `Portfolio (${portfolio.length})`}
        </button>
      ))}
    </div>
  );

  return (
    <Page title="Show Your Work" sub="Delivery packages and portfolio">
      {phone ? <>{seg}{tab === 'packages' ? packageList : portfolioGrid}</> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>
            <Stat label="Packages sent" value={String(sentQuarter)} pill="This quarter" />
            <Stat label="Portfolio pieces" value={String(portfolio.length)} pill="Delivered" k={portfolio.length ? 'good' : 'neutral'} />
            <Stat label="Ready to send" value={String(packages.filter((p) => p.status === 'ready_to_deliver').length)} pill="Waiting on you" k={packages.some((p) => p.status === 'ready_to_deliver') ? 'warn' : 'neutral'} />
            <Stat label="In progress" value={String(packages.filter((p) => p.status === 'in_progress').length)} pill="Being assembled" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: device === 'desktop' && !novaOpen ? 'repeat(3,minmax(0,1fr))' : 'repeat(2,minmax(0,1fr))', gap: 16, alignItems: 'start' }}>{packageList}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em' }}>Portfolio</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>{portfolio.length} delivered</span>
          </div>
          {portfolioGrid}
        </>
      )}
      {sheet}
    </Page>
  );
}

type Api = ReturnType<typeof useScalingProjects>;
type Doc = ReturnType<typeof useClientDocuments>['documents'][number];

function ProjectSheet({ p, invoice, api, onNavigate, onClose }: { p: ScalingProject; invoice: Doc | null; api: Api; onNavigate: (id: string) => void; onClose: () => void }) {
  const { entries, addEntry } = useDeliveryLog(p.id);
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(p.client_name ?? '');
  const [email, setEmail] = useState(p.client_email ?? '');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const delivered = p.status === 'delivered';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (p.video_path) void api.videoSignedUrl(p.video_path).then(setVideoUrl); }, [p.video_path]);
  const total = invoice ? invoiceTotal((invoice.data.line_items as { qty?: string; rate?: string }[]) ?? []) : 0;
  const dirty = name.trim() !== (p.client_name ?? '') || email.trim() !== (p.client_email ?? '');

  const saveClient = () => api.patch(p.id, { client_name: name.trim() || null, client_email: email.trim() || null });
  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ok = await api.uploadVideo(p.id, file);
    setUploading(false);
    if (ok) {
      const { data } = await supabase.from('scaling_projects').select('video_path').eq('id', p.id).single();
      if (data?.video_path) void api.videoSignedUrl(data.video_path).then(setVideoUrl);
    }
  };
  const markReady = async () => {
    setBusy(true);
    await api.patch(p.id, { client_name: name.trim() || null, client_email: email.trim() || null, status: 'ready_to_deliver' });
    await addEntry('marked_ready', `${name.trim() || 'Client'} · package assembled`);
    setBusy(false);
  };
  const send = async () => {
    const to = email.trim();
    if (!to) return;
    setBusy(true); setErr('');
    try {
      if (dirty) await saveClient();
      const res = await authedFetch('/api/deliver-email', {
        to, clientName: name.trim() || undefined, projectName: p.name, previewUrl: p.website_url ?? undefined, videoUrl: videoUrl ?? undefined,
        invoiceSummary: invoice ? `Invoice total: $${total.toFixed(2)}. A full invoice will follow separately from Invoicing.` : undefined,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Send failed (${res.status})`);
      await api.patch(p.id, { status: 'delivered', delivered_at: new Date().toISOString() });
      await addEntry('sent_to_client', `Sent to ${to}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send. Try again.');
    } finally { setBusy(false); }
  };

  const sec = (t: string, children: React.ReactNode) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t}</span>{children}
    </div>
  );

  return (
    <Sheet title={p.name} onClose={onClose} full width={560}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip k={STATUS[p.status].k}>{STATUS[p.status].l}</Chip>
        {p.website_url ? <a href={p.website_url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{host(p.website_url)}</a>
          : <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No live preview link yet. Set one from Start.</span>}
      </div>
      {sec('Client', <>
        <Field l="Name"><input value={name} onChange={(e) => setName(e.target.value)} style={field} disabled={delivered} placeholder="Harbor Dental" /></Field>
        <Field l="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={field} disabled={delivered} placeholder="dana@harbordental.com" /></Field>
        {!delivered && dirty && <button className="mm-btn" style={{ alignSelf: 'flex-start' }} onClick={() => void saveClient()}>Save client</button>}
      </>)}
      {sec('Walkthrough video', <>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>You record and upload it. Nothing is generated here.</span>
        {videoUrl && <video src={videoUrl} controls style={{ width: '100%', borderRadius: 10, background: 'var(--video-bg)' }} />}
        <input ref={fileInput} type="file" accept="video/*" style={{ display: 'none' }} onChange={onUpload} />
        {!delivered && <div style={{ display: 'flex', gap: 8 }}>
          <button className="mm-btn" disabled={uploading} onClick={() => fileInput.current?.click()}>{uploading ? 'Uploading…' : p.video_path ? 'Replace video' : 'Upload video'}</button>
          {p.video_path && <button className="mm-btn" onClick={() => { void api.removeVideo(p.id, p.video_path!); setVideoUrl(null); }}>Remove</button>}
        </div>}
      </>)}
      {sec('Invoice', invoice
        ? <Row first name={invoice.label} amt={usd(total)} onClick={() => onNavigate('invoicing')} />
        : <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>No invoice linked yet. Generate one from the project's Start page, or create one in Invoicing.</span>)}
      {p.status === 'in_progress' && <button className="mm-btn mm-btn--primary" style={{ height: 48, fontSize: 15 }} disabled={busy} onClick={() => void markReady()}>{busy ? 'Saving…' : 'Mark ready to deliver'}</button>}
      {p.status === 'ready_to_deliver' && <>
        <button className="mm-btn mm-btn--primary" style={{ height: 48, fontSize: 15 }} disabled={busy || !email.trim()} onClick={() => void send()}>{busy ? 'Sending…' : 'Send to client'}</button>
        {!email.trim() && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Add a client email first.</span>}
      </>}
      {err && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{err}</span>}
      {sec('Delivery log', entries.length
        ? <div>{entries.map((e, i) => <Row key={e.id} first={i === 0} name={e.event.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())} meta={e.note ?? undefined} amt={new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />)}</div>
        : <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Nothing logged yet.</span>)}
    </Sheet>
  );
}
