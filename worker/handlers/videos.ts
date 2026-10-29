// Client videos (spec Part 4): the public share page's two calls.
//   GET  /api/video/view?t=<token>   title, sender, a 6-hour signed URL, the booking link
//   POST /api/video/reply            { t, name, email, message } → kept on the video, lands in Comms, pings Marq
// No login: the unguessable share token is the key. Archived videos stop playing.
import { Sb, json } from '../lib/sb';
import type { SbEnv } from '../lib/sb';
import { recordInbound } from '../lib/madeby';
import { notifyStored } from '../lib/notify';
import { DEFAULT_SENDER } from '../../src/data/madeby';

const TOKEN = /^[0-9a-f]{24}$/;
const EMAIL = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
const MAX_REPLIES = 20;
interface Video { id: string; user_id: string; title: string; storage_path: string; mime: string | null; views: number; replies: { name: string; email: string; message: string; at: string }[] }

async function byToken(sb: Sb, t: string): Promise<Video | null> {
  if (!TOKEN.test(t)) return null;
  const [v] = await sb.get<Video>(`client_videos?share_token=eq.${t}&archived_at=is.null&select=id,user_id,title,storage_path,mime,views,replies`);
  return v ?? null;
}

export async function videoRoute(request: Request, env: SbEnv, path: string): Promise<Response> {
  const sb = new Sb(env);
  if (path === 'view' && request.method === 'GET') {
    const v = await byToken(sb, new URL(request.url).searchParams.get('t') ?? '');
    if (!v) return json({ error: 'This video link isn\'t valid anymore.' }, 404);
    const r = await fetch(`${env.VITE_SUPABASE_URL}/storage/v1/object/sign/client-videos/${v.storage_path.split('/').map(encodeURIComponent).join('/')}`, { method: 'POST', headers: sb.headers, body: JSON.stringify({ expiresIn: 6 * 3600 }) });
    const signed = r.ok ? ((await r.json()) as { signedURL?: string }).signedURL : null;
    if (!signed) return json({ error: 'The video isn\'t ready yet. Try again in a minute.' }, 503);
    await sb.patch('client_videos', `id=eq.${v.id}`, { views: v.views + 1, last_viewed_at: new Date().toISOString() }).catch(() => {});
    const [bp] = await sb.get<{ sender_entity: string | null; business_name: string | null }>(`business_profile?user_id=eq.${v.user_id}&select=sender_entity,business_name`).catch(() => []);
    return json({ title: v.title, sender: bp?.sender_entity || bp?.business_name || DEFAULT_SENDER, url: `${env.VITE_SUPABASE_URL}/storage/v1${signed}`, mime: v.mime, book: '/book/marq' });
  }
  if (path === 'reply' && request.method === 'POST') {
    const b = (await request.json().catch(() => ({}))) as { t?: string; name?: string; email?: string; message?: string };
    const v = await byToken(sb, String(b.t ?? ''));
    if (!v) return json({ error: 'This video link isn\'t valid anymore.' }, 404);
    const name = String(b.name ?? '').trim().slice(0, 80), email = String(b.email ?? '').trim().slice(0, 160), message = String(b.message ?? '').trim().slice(0, 4000);
    if (!name || !EMAIL.test(email) || message.length < 2) return json({ error: 'Add your name, email and a message.' }, 400);
    if ((v.replies ?? []).length >= MAX_REPLIES) return json({ error: 'Please reply by email instead.' }, 429);
    const at = new Date().toISOString();
    await sb.patch('client_videos', `id=eq.${v.id}`, { replies: [...(v.replies ?? []), { name, email, message, at }] });
    await recordInbound(sb, v.user_id, { channel: 'email', from: email, subject: `Reply to your video: ${v.title}`, body: message }).catch(() => {});
    await notifyStored(sb, v.user_id, 'lead_reply', { title: `${name} replied to your video`, body: message.slice(0, 140), deepLink: 'client-crm' }).catch(() => {});
    return json({ ok: true });
  }
  return json({ error: 'Not found.' }, 404);
}

/** The share link for a token. Pure. */
export const videoShareUrl = (origin: string, token: string) => `${origin.replace(/\/+$/, '')}/v/${token}`;
