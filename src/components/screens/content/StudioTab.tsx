import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { supabase } from '../../../lib/supabase';
import type { useSocialAccounts, useContentItems, useClips } from '../../../data/useContentEngine';
import { PLATFORM, editSequence, nextInSequence } from '../../../data/contentEngine';
import type { Clip, ClipPlan } from '../../../data/contentEngine';
import { runWorkerNow, decideApproval } from '../../../data/useEngine';
import { api as callApi } from '../../../lib/api';
import { extractWav, MAX_TRANSCRIBE_S } from '../../../lib/clipAudio';
import { money } from '../../../data/ecom';
import { E, Badge, TeachingEmpty, btn, field, label, tint, useIsMobile } from '../ecom/ecomShared';
import { askConfirm } from '../../../lib/confirm';

const BUCKET = 'content-clips';
const MAX_BYTES = 500 * 1024 * 1024;
const STATUS_COLOR: Record<string, string> = { raw: E.faint, editing: E.accent, proposed: E.amber, approved: E.green, sent_back: E.amber, failed: E.red };
const STATUS_LABEL: Record<string, string> = { raw: 'Raw', editing: 'Cutting…', proposed: 'Edit waiting', approved: 'Edit approved', sent_back: 'Sent back', failed: 'Failed' };
const secs = (n: number | null | undefined) => (n == null ? '—' : `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`);

async function authed(path: string, init: RequestInit): Promise<Record<string, unknown>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { error: 'Not signed in.' };
  const res = await fetch(path, { ...init, headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}` } });
  return (await res.json().catch(() => ({ error: `HTTP ${res.status}` }))) as Record<string, unknown>;
}

/** Audio out of the clip in the browser → Whisper on the Worker → the
 *  timed transcript is saved on the clip. */
async function transcribe(clip: Pick<Clip, 'id'>, file: Blob): Promise<{ error?: string; truncated?: boolean }> {
  try {
    const { wav, duration, truncated } = await extractWav(file);
    const r = await authed(`/api/content/transcribe?clip_id=${clip.id}`, { method: 'POST', headers: { 'content-type': 'audio/wav', 'x-duration': String(duration) }, body: wav });
    return r.error ? { error: String(r.error) } : { truncated };
  } catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
}

/** C4 — the raw clip inbox. Drop a clip from your phone; it uploads to
 *  your private folder, the audio is transcribed, and the Clip Editor
 *  proposes the hook, cuts, captions, b-roll and Higgsfield prompts. You
 *  watch raw and edited side by side, then Approve or Send back. */
export default function StudioTab({ api, accounts, items }: { api: ReturnType<typeof useClips>; accounts: ReturnType<typeof useSocialAccounts>; items: ReturnType<typeof useContentItems> }) {
  const [acct, setAcct] = useState('');
  const [itemId, setItemId] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const filmable = items.items.filter((i) => i.status !== 'posted' && (!acct || i.account_id === acct));

  const upload = async (file: File) => {
    setErr('');
    if (!file.type.startsWith('video/') && !file.type.startsWith('audio/')) { setErr('That isn’t a video file.'); return; }
    if (file.size > MAX_BYTES) { setErr('Clips over 500 MB won’t upload — trim it on your phone first.'); return; }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setErr('Not signed in.'); return; }
    const id = crypto.randomUUID();
    const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'mp4';
    const path = `${u.user.id}/${id}.${ext}`;
    setBusy(`Uploading ${file.name} (${(file.size / 1048576).toFixed(0)} MB)…`);
    const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) { setBusy(''); setErr(`Upload failed: ${up.error.message}`); return; }
    const linked = items.items.find((i) => i.id === itemId);
    const { error: ie } = await supabase.from('content_clips').insert({ id, storage_path: path, file_name: file.name.slice(0, 200), status: 'raw', account_id: acct || linked?.account_id || null, content_item_id: itemId || null });
    if (ie) { setBusy(''); setErr(ie.message); return; }
    await api.reload();
    setOpen(id);
    setBusy('Transcribing the audio…');
    const t = await transcribe({ id }, file);
    if (!t.error && linked && ['idea', 'script'].includes(linked.status)) await items.update(linked.id, { status: 'filmed' });
    setBusy('');
    if (t.error) setErr(`Uploaded, but transcription failed: ${t.error} You can retry from the clip.`);
    else if (t.truncated) setErr(`Transcribed the first ${MAX_TRANSCRIBE_S / 60} minutes — the Clip Editor only sees that part.`);
    await api.reload();
  };

  return (
    <div>
      <div style={{ ...E.card, padding: 14 }}>
        <div style={{ ...label, marginBottom: 8 }}>New raw clip</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select aria-label="Account" style={{ ...field, width: 'auto', flex: '1 1 150px' }} value={acct} onChange={(e) => setAcct(e.target.value)}>
            <option value="">Account (optional)</option>
            {accounts.accounts.map((a) => <option key={a.id} value={a.id}>{PLATFORM[a.platform].short} @{a.handle}</option>)}
          </select>
          <select aria-label="Post it's for" style={{ ...field, width: 'auto', flex: '2 1 200px', minWidth: 0 }} value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">Planned post (optional)</option>
            {filmable.map((i) => <option key={i.id} value={i.id}>{i.scheduled_for ? `${i.scheduled_for.slice(5)} · ` : ''}{i.concept.slice(0, 60)}</option>)}
          </select>
        </div>
        <input ref={fileRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f); }} />
        <button style={{ ...btn('primary'), marginTop: 10, minHeight: 44 }} disabled={!!busy} onClick={() => fileRef.current?.click()}>{busy || '🎬 Upload a clip'}</button>
        <div style={{ fontSize: 'var(--text-caption)', color: E.faint, marginTop: 6, lineHeight: 1.45 }}>Goes to your private folder (only you can open it). The audio is pulled out on this device and transcribed; the video never leaves storage. Up to 500 MB; the first {MAX_TRANSCRIBE_S / 60} minutes are transcribed.</div>
        {err && <div style={{ fontSize: 'var(--text-caption)', color: E.amber, marginTop: 6 }}>{err}</div>}
      </div>

      {!api.loading && api.clips.length === 0 && <div style={{ marginTop: 14 }}><TeachingEmpty what="No clips yet. Film on your phone, upload here, and the Clip Editor proposes the edit — hook first, dead air cut, captions, b-roll and Higgsfield ideas — for you to approve." worker="the Clip Editor" /></div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
        {api.clips.map((c) => <ClipCard key={c.id} clip={c} open={open === c.id} onToggle={() => setOpen(open === c.id ? null : c.id)} api={api} accounts={accounts} items={items} />)}
      </div>
    </div>
  );
}

interface PendingEdit { id: string; payload: { plan: ClipPlan } }

function ClipCard({ clip: c, open, onToggle, api, accounts, items }: { clip: Clip; open: boolean; onToggle: () => void; api: ReturnType<typeof useClips>; accounts: ReturnType<typeof useSocialAccounts>; items: ReturnType<typeof useContentItems> }) {
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState<PendingEdit | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const a = accounts.accounts.find((x) => x.id === c.account_id);
  const item = items.items.find((x) => x.id === c.content_item_id);

  useEffect(() => {
    if (!open) return;
    if (c.storage_path) supabase.storage.from(BUCKET).createSignedUrl(c.storage_path, 3600).then(({ data }) => setSrc(data?.signedUrl ?? null));
    supabase.from('ai_approvals').select('id,payload').eq('type', 'clip_edit').eq('status', 'pending').eq('entity_id', c.id).order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => setPending(((data ?? [])[0] as PendingEdit | undefined) ?? null));
  }, [open, c.storage_path, c.id, c.status]);

  const retranscribe = async () => {
    if (!c.storage_path) return;
    setBusy('Downloading…'); setMsg('');
    const { data, error } = await supabase.storage.from(BUCKET).download(c.storage_path);
    if (error || !data) { setBusy(''); setMsg(error?.message ?? 'Download failed.'); return; }
    setBusy('Transcribing…');
    const t = await transcribe(c, data);
    setBusy(''); setMsg(t.error ?? (t.truncated ? `Transcribed the first ${MAX_TRANSCRIBE_S / 60} minutes.` : 'Transcribed.'));
    await api.reload();
  };
  const cut = async () => {
    setBusy('Cutting… (20–40s)'); setMsg('');
    const r = await runWorkerNow('clip_editor', { clip_id: c.id });
    setBusy('');
    setMsg(r.ok ? `Edit ready below — ${r.summary ?? ''} (${money(r.costUsd ?? 0)})` : r.error ?? 'Run failed.');
    await api.reload();
  };
  const decide = async (status: 'approved' | 'sent_back') => {
    if (!pending) return;
    if (status === 'sent_back' && !note.trim()) { setMsg('Write what to change first — that note is what the Clip Editor learns from.'); return; }
    setBusy(status === 'approved' ? 'Saving…' : 'Re-cutting with your note…');
    const r = await decideApproval(pending.id, status, note.trim() || null, status === 'sent_back');
    setBusy('');
    if (!r.ok) { setMsg(r.error ?? 'Could not save.'); return; }
    setNote(''); setMsg(status === 'approved' ? 'Approved — the edit is saved on this clip.' : r.rerun?.ok ? 'Sent back — the new cut is below.' : `Sent back.${r.rerun?.error ? ` Re-run failed: ${r.rerun.error}` : ''}`);
    await api.reload(); await items.reload();
    const { data } = await supabase.from('ai_approvals').select('id,payload').eq('type', 'clip_edit').eq('status', 'pending').eq('entity_id', c.id).order('created_at', { ascending: false }).limit(1);
    setPending(((data ?? [])[0] as PendingEdit | undefined) ?? null);
  };
  const render = async () => {
    setBusy('Starting the render…'); setMsg('');
    const r = await callApi<{ ok?: boolean; status?: string; message?: string; error?: string }>('/api/content/render', { body: { clip_id: c.id } });
    setBusy(''); setMsg(r.error ?? r.message ?? '');
    await api.reload();
  };
  const plan = pending?.payload.plan ?? c.edit_plan;
  const hasTranscript = !!(c.segments && c.segments.length);

  return (
    <div style={{ ...E.card, padding: 12 }}>
      <button onClick={onToggle} style={{ all: 'unset', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', width: '100%', minHeight: 32 }} aria-expanded={open}>
        <Badge color={STATUS_COLOR[pending ? 'proposed' : c.status] ?? E.faint}>{STATUS_LABEL[pending ? 'proposed' : c.status] ?? c.status}</Badge>
        <span style={{ fontWeight: 700, color: E.text, minWidth: 0, overflowWrap: 'anywhere', flex: '1 1 160px' }}>{c.edit_plan?.title || c.file_name || 'Clip'}</span>
        <span style={{ fontSize: 'var(--text-caption)', color: E.faint, fontFamily: 'var(--font-mono)' }}>{secs(c.duration_s)}{plan ? ` → ${secs(plan.edited_length_s)}` : ''}</span>
        {a && <Badge color={E.blue}>@{a.handle}</Badge>}
        <span style={{ color: E.faint }}>{open ? '▴' : '▾'}</span>
      </button>
      {item && <div style={{ fontSize: 'var(--text-caption)', color: E.muted, marginTop: 4 }}><span style={label}>For</span> {item.concept}</div>}
      {open && (
        <div style={{ marginTop: 10 }}>
          {!c.storage_path ? <div style={{ fontSize: 'var(--text-caption)', color: E.faint }}>No video file on this clip — the edit below is all that's saved.</div> : plan ? <SideBySide src={src} plan={plan} /> : src && <video src={src} controls playsInline preload="metadata" style={{ width: '100%', maxHeight: 420, borderRadius: 'var(--radius-sm)', background: '#000' }} />}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {!hasTranscript && <button style={btn('primary')} disabled={!!busy} onClick={retranscribe}>{busy || 'Transcribe'}</button>}
            {hasTranscript && !pending && <button style={btn(plan ? 'ghost' : 'primary')} disabled={!!busy || c.status === 'editing'} onClick={cut}>{busy || (plan ? 'Re-cut' : '✂️ Cut it')}</button>}
            {c.status === 'approved' && c.edit_plan && c.storage_path && <button style={btn(c.rendered_path ? 'ghost' : 'primary')} disabled={!!busy || c.render_status === 'rendering'} onClick={render}>{c.render_status === 'rendering' ? 'Rendering…' : c.rendered_path ? 'Render again' : '🎬 Render the edit'}</button>}
            {c.rendered_path && <Badge color={E.green}>Rendered: the Publisher posts this cut</Badge>}
            {c.render_status === 'failed' && c.render_error && <span style={{ fontSize: 'var(--text-caption)', color: E.red }}>{c.render_error}</span>}
            <button style={{ ...btn('ghost'), marginLeft: 'auto' }} onClick={async () => { if (await askConfirm('Delete this clip and its video?')) await api.remove(c); }}>Delete</button>
          </div>
          {pending && (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 'var(--radius-sm)', background: tint(E.amber, 8), border: `1px solid ${tint(E.amber, 30)}` }}>
              <div style={{ fontSize: 'var(--text-body)', color: E.text, fontWeight: 600 }}>The Clip Editor's cut is waiting on you.</div>
              <input style={{ ...field, marginTop: 8 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder='Note to the Clip Editor — e.g. "open on the price reveal, keep it under 30s"' />
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <button style={btn('primary')} disabled={!!busy} onClick={() => decide('approved')}>Approve · save the edit</button>
                <button style={btn('ghost')} disabled={!!busy} onClick={() => decide('sent_back')}>Send back + re-cut</button>
              </div>
            </div>
          )}
          {msg && <div style={{ fontSize: 'var(--text-caption)', color: E.muted, marginTop: 6 }}>{msg}</div>}
          {plan && <PlanDetail plan={plan} />}
          {hasTranscript && (
            <details style={{ marginTop: 10 }}>
              <summary style={{ fontSize: 'var(--text-caption)', color: E.blue, cursor: 'pointer' }}>Transcript</summary>
              <div style={{ fontSize: 'var(--text-caption)', color: E.muted, marginTop: 4, lineHeight: 1.5, maxHeight: 220, overflow: 'auto' }}>
                {c.segments!.map((s, i) => <div key={i}><span style={{ fontFamily: 'var(--font-mono)', color: E.faint }}>{secs(s.start)}</span> {s.text}</div>)}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function PlanDetail({ plan }: { plan: ClipPlan }) {
  return (
    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--text-caption)', color: E.muted }}>
      <div><span style={label}>Hook</span> {secs(plan.hook.start)}–{secs(plan.hook.end)}{plan.hook.text ? ` “${plan.hook.text}”` : ''}{plan.hook.why ? ` — ${plan.hook.why}` : ''}</div>
      {plan.cuts.map((x, i) => <div key={i}><span style={{ fontFamily: 'var(--font-mono)', color: E.text }}>{secs(x.start)}–{secs(x.end)}</span> {x.why}</div>)}
      {plan.on_screen_text && <div><span style={label}>On screen</span> {plan.on_screen_text}</div>}
      {plan.broll.map((b, i) => <div key={`b${i}`}><span style={label}>B-roll @{secs(b.at)}</span> {b.prompt}</div>)}
      {plan.higgsfield.map((h, i) => (
        <div key={`h${i}`} style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
          <span style={label}>Higgsfield</span><span style={{ flex: 1, minWidth: 0 }}>{h}</span>
          <button style={{ ...btn('ghost'), padding: '2px 8px', fontSize: 11 }} onClick={() => void navigator.clipboard?.writeText(h)}>Copy</button>
        </div>
      ))}
      {plan.principle && <div><span style={label}>Why</span> {plan.principle}</div>}
    </div>
  );
}

const frame: CSSProperties = { position: 'relative', aspectRatio: '9 / 16', width: '100%', borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: '#000' };

/** Raw on the left, the proposed edit on the right (stacked behind a
 *  toggle on phones). The edit is played from the raw file: the hook
 *  first, then each kept range, with the captions burned on top. */
function SideBySide({ src, plan }: { src: string | null; plan: ClipPlan }) {
  const mobile = useIsMobile(640);
  const [view, setView] = useState<'edited' | 'raw'>('edited');
  if (!src) return <div style={{ fontSize: 'var(--text-caption)', color: E.faint }}>Loading the clip…</div>;
  const raw = <div><div style={{ ...label, marginBottom: 4 }}>Raw</div><div style={frame}><video src={src} controls playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></div></div>;
  const edited = <div><div style={{ ...label, marginBottom: 4 }}>Edited · {secs(plan.edited_length_s)}</div><EditedPlayer src={src} plan={plan} /></div>;
  if (mobile) return (
    <div style={{ maxWidth: 360, margin: '0 auto' }}>
      <div role="tablist" style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {(['edited', 'raw'] as const).map((v) => <button key={v} role="tab" aria-selected={view === v} style={{ ...btn(view === v ? 'primary' : 'ghost'), flex: 1, minHeight: 40 }} onClick={() => setView(v)}>{v === 'edited' ? 'Edited' : 'Raw'}</button>)}
      </div>
      {view === 'edited' ? edited : raw}
    </div>
  );
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 640 }}>{raw}{edited}</div>;
}

function EditedPlayer({ src, plan }: { src: string; plan: ClipPlan }) {
  const ref = useRef<HTMLVideoElement>(null);
  const idx = useRef(0);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const seq = editSequence(plan);
  const caption = plan.captions.find((c) => t >= c.start && t < c.end)?.text ?? '';
  const play = () => {
    const v = ref.current; if (!v || !seq.length) return;
    idx.current = 0; v.currentTime = seq[0].start; void v.play(); setPlaying(true);
  };
  const onTime = () => {
    const v = ref.current; if (!v) return;
    setT(v.currentTime);
    const n = nextInSequence(seq, idx.current, v.currentTime);
    idx.current = n.idx;
    if (n.stop) { v.pause(); setPlaying(false); }
    else if (n.seek != null) v.currentTime = n.seek;
  };
  return (
    <div style={frame}>
      <video ref={ref} src={src} playsInline preload="metadata" onTimeUpdate={onTime} onPause={() => setPlaying(false)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      {plan.on_screen_text && playing && idx.current === 0 && <div style={{ position: 'absolute', top: '9%', left: '6%', right: '6%', textAlign: 'center', color: '#fff', fontWeight: 800, fontSize: 'clamp(14px, 4.5vw, 20px)', textShadow: '0 2px 6px rgba(0,0,0,.8)' }}>{plan.on_screen_text}</div>}
      {caption && playing && <div style={{ position: 'absolute', bottom: '18%', left: '8%', right: '8%', textAlign: 'center' }}><span style={{ background: 'rgba(0,0,0,.72)', color: '#fff', fontWeight: 700, padding: '4px 8px', borderRadius: 6, fontSize: 'clamp(13px, 4vw, 18px)', lineHeight: 1.6, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' }}>{caption}</span></div>}
      {!playing && <button onClick={play} aria-label="Play the edit" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.35)', border: 0, color: '#fff', fontSize: 40, cursor: 'pointer' }}>▶</button>}
    </div>
  );
}
