import { useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { api } from '../../../lib/api';
import { askConfirm } from '../../../lib/confirm';
import { PLATFORM } from '../../../data/contentEngine';
import type { SocialAccount } from '../../../data/contentEngine';
import { E, Badge, btn, field, label } from '../ecom/ecomShared';

const BUCKET = 'content-clips';
const MAX_BYTES = 500 * 1024 * 1024;

/** Any photo (turned into a JPEG, which Instagram requires) goes as is. */
async function toJpeg(file: File): Promise<File> {
  if (/^image\/jpeg$/.test(file.type)) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d')!.drawImage(img, 0, 0);
    const blob: Blob | null = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
    if (!blob) throw new Error('could not convert');
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } finally { URL.revokeObjectURL(url); }
}

/** Post now: pick an account, add a photo or video and a caption, press the button. Pressing it is the approval. */
export default function PostNow({ accounts }: { accounts: SocialAccount[] }) {
  const postable = accounts.filter((a) => a.connected);
  const [acctId, setAcctId] = useState('');
  const acct = postable.find((a) => a.id === acctId) ?? postable.find((a) => a.live_posting) ?? postable[0];
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setMsg(null);
    if (f.size > MAX_BYTES) { setMsg({ ok: false, text: 'Files over 500 MB won’t upload. Trim it first.' }); return; }
    if (f.type.startsWith('image/') && acct?.platform === 'tiktok') { setMsg({ ok: false, text: 'TikTok posts need a video.' }); return; }
    try { setFile(f.type.startsWith('image/') ? await toJpeg(f) : f); }
    catch { setMsg({ ok: false, text: 'That photo couldn’t be read. Try a JPEG or a screenshot of it.' }); }
  };

  const post = async () => {
    if (!acct || !file) return;
    const live = !!acct.live_posting;
    const ok = await askConfirm(live ? `Post this to @${acct.handle} now? It goes out publicly.` : `@${acct.handle} is in test mode, so this is a dry run: nothing really posts. Continue?`);
    if (!ok) return;
    setMsg(null);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setMsg({ ok: false, text: 'Not signed in.' }); return; }
    const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'mp4';
    const path = `${u.user.id}/${crypto.randomUUID()}.${ext}`;
    setBusy(`Uploading ${(file.size / 1048576).toFixed(1)} MB…`);
    const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (up.error) { setBusy(''); setMsg({ ok: false, text: `Upload failed: ${up.error.message}` }); return; }
    setBusy(live ? 'Posting…' : 'Running the dry run…');
    const r = await api<{ ok?: boolean; status?: string | null; error?: string | null; url?: string | null; test?: boolean; summary?: string | null }>('/api/content/post-now', { body: { account_id: acct.id, path, file_name: file.name, caption } });
    setBusy('');
    if (r.error && !r.status) { setMsg({ ok: false, text: r.error }); return; }
    if (r.status === 'failed') { setMsg({ ok: false, text: r.error ?? 'The post failed.' }); return; }
    if (r.test) setMsg({ ok: true, text: 'Dry run finished: nothing was posted. Turn on live posting for this account (Accounts → Open) to post for real.' });
    else if (r.status === 'published') { setMsg({ ok: true, text: `Posted to @${acct.handle}.${r.url ? ` ${r.url}` : ''}` }); setFile(null); setCaption(''); }
    else setMsg({ ok: true, text: `${PLATFORM[acct.platform].label} is still processing it. It finishes on its own within a few minutes; the Plan shows the result.` });
  };

  return (
    <div style={{ ...E.card, padding: 14, marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <div style={label}>Post now</div>
        {acct && <Badge color={acct.live_posting ? E.red : E.faint}>{acct.live_posting ? 'LIVE: posts for real' : 'Test mode: nothing posts'}</Badge>}
      </div>
      {postable.length === 0 ? <div style={{ fontSize: 'var(--text-body)', color: E.muted }}>Connect an account first (Setup → My connections).</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <select aria-label="Post to" style={field} value={acct?.id ?? ''} onChange={(e) => setAcctId(e.target.value)}>
            {postable.map((a) => <option key={a.id} value={a.id}>{PLATFORM[a.platform].short} @{a.handle}{a.live_posting ? ' · LIVE' : ''}</option>)}
          </select>
          <input ref={ref} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void pick(f); }} />
          <button style={{ ...btn('ghost'), minHeight: 44 }} disabled={!!busy} onClick={() => ref.current?.click()}>{file ? `✓ ${file.name} (${(file.size / 1048576).toFixed(1)} MB)` : '📷 Choose a photo or video'}</button>
          <textarea aria-label="Caption" style={{ ...field, minHeight: 84, fontFamily: 'inherit' }} placeholder="Caption and hashtags" value={caption} maxLength={2200} onChange={(e) => setCaption(e.target.value)} />
          <button style={{ ...btn('primary'), minHeight: 46 }} disabled={!!busy || !file} onClick={() => void post()}>{busy || (acct?.live_posting ? 'Post now' : 'Run a test post')}</button>
          <div style={{ fontSize: 'var(--text-caption)', color: E.faint, lineHeight: 1.45 }}>Photos are converted to JPEG for you. Videos go out as Reels. This skips the Plan: pressing the button is your approval.</div>
        </div>
      )}
      {msg && <div role="status" style={{ marginTop: 8, fontSize: 'var(--text-body)', color: msg.ok ? E.green : E.red, overflowWrap: 'anywhere' }}>{msg.text}</div>}
    </div>
  );
}
