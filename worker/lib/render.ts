// Real clipping (brief Phase 3.3): execute Clip Editor's approved edit plan
// into a 9:16 file with burned-in captions.
//
// Higgsfield's public API has reframe/upscale but no "cut these ranges and
// burn these captions" endpoint we could verify, so the cut runs on our own
// ffmpeg service (render/ — a Cloudflare Container). The Worker only builds
// the ffmpeg arguments (pure, tested), hands the job over with a signed
// download URL, a signed upload URL and a callback, and records the result.
//
// Behind a flag: CLIP_RENDER=on and RENDER_URL set. Without them the
// plan-only path keeps working exactly as before (the Publisher posts the
// uploaded file and says the cuts aren't rendered).
import type { Sb } from './sb';
import type { EditPlan } from './contentWorkers';
import { isDryRun } from './dryRun';
import type { DryRunEnv } from './dryRun';

export interface RenderEnv extends DryRunEnv { CLIP_RENDER?: string; RENDER_URL?: string; RENDER_SECRET?: string; VITE_SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string; APP_ORIGIN?: string }
export const BUCKET = 'content-clips';
export const renderOn = (env: Partial<RenderEnv>) => env.CLIP_RENDER === 'on' && !!env.RENDER_URL;

export interface Range { start: number; end: number; at: number }
/** Hook first, then the kept cuts, each with where it lands in the output. Pure. */
export function timeline(plan: Pick<EditPlan, 'hook' | 'cuts'>): Range[] {
  const src = [plan.hook, ...plan.cuts].filter((r) => r.end > r.start);
  let at = 0;
  return src.map((r) => { const x = { start: r.start, end: r.end, at: Number(at.toFixed(3)) }; at += r.end - r.start; return x; });
}
/** Captions are timed to the source; move each onto the output timeline,
 *  once per range it falls in, clipped to that range. Pure. */
export function mapCaptions(plan: Pick<EditPlan, 'hook' | 'cuts' | 'captions'>): { start: number; end: number; text: string }[] {
  const out: { start: number; end: number; text: string }[] = [];
  for (const r of timeline(plan)) for (const c of plan.captions) {
    const s = Math.max(c.start, r.start), e = Math.min(c.end, r.end);
    if (e - s < 0.15) continue;
    out.push({ start: Number((r.at + s - r.start).toFixed(2)), end: Number((r.at + e - r.start).toFixed(2)), text: c.text });
  }
  return out.sort((a, b) => a.start - b.start);
}
/** drawtext needs : ' \ % , escaped. */
export const escDrawtext = (t: string) => t.replace(/\\/g, '').replace(/'/g, '\u2019').replace(/%/g, '\\%').replace(/:/g, '\\:');

/** The full ffmpeg argument list for one plan. Pure. */
export function ffmpegArgs(plan: Pick<EditPlan, 'hook' | 'cuts' | 'captions' | 'on_screen_text'>, input: string, output: string, opts: { width?: number; height?: number; font?: string } = {}): string[] {
  const W = opts.width ?? 1080, H = opts.height ?? 1920;
  const font = opts.font ?? '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
  const t = timeline(plan);
  if (!t.length) throw new Error('The edit plan has no ranges to keep.');
  const parts: string[] = [];
  t.forEach((r, i) => {
    parts.push(`[0:v]trim=start=${r.start}:end=${r.end},setpts=PTS-STARTPTS[v${i}]`);
    parts.push(`[0:a]atrim=start=${r.start}:end=${r.end},asetpts=PTS-STARTPTS[a${i}]`);
  });
  parts.push(`${t.map((_, i) => `[v${i}][a${i}]`).join('')}concat=n=${t.length}:v=1:a=1[cv][ca]`);
  // Centre-crop to 9:16 whatever the source shape, then scale.
  const vf = [`crop='min(iw,ih*9/16)':'min(ih,iw*16/9)'`, `scale=${W}:${H}`, 'setsar=1'];
  for (const c of mapCaptions(plan)) vf.push(`drawtext=fontfile=${font}:text='${escDrawtext(c.text)}':fontcolor=white:fontsize=${Math.round(H / 26)}:borderw=6:bordercolor=black@0.85:x=(w-text_w)/2:y=h*0.72:enable='between(t,${c.start},${c.end})'`);
  if (plan.on_screen_text) vf.push(`drawtext=fontfile=${font}:text='${escDrawtext(plan.on_screen_text.slice(0, 60))}':fontcolor=white:fontsize=${Math.round(H / 22)}:borderw=6:bordercolor=black@0.85:x=(w-text_w)/2:y=h*0.12:enable='lt(t,${Math.min(3, t[0].end - t[0].start).toFixed(2)})'`);
  parts.push(`[cv]${vf.join(',')}[ov]`);
  return ['-y', '-i', input, '-filter_complex', parts.join(';'), '-map', '[ov]', '-map', '[ca]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', output];
}

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)));
  return [...mac].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export const renderSignature = hmacHex;
export async function renderSignatureValid(secret: string | undefined, body: string, sig: string | null): Promise<boolean> {
  if (!secret || !sig) return false;
  const want = await hmacHex(secret, body);
  if (want.length !== sig.length) return false;
  let d = 0; for (let i = 0; i < want.length; i++) d |= want.charCodeAt(i) ^ sig.charCodeAt(i);
  return d === 0;
}

async function storageSign(env: RenderEnv, path: string, kind: 'download' | 'upload'): Promise<string> {
  const enc = path.split('/').map(encodeURIComponent).join('/');
  const url = kind === 'download' ? `${env.VITE_SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${enc}` : `${env.VITE_SUPABASE_URL}/storage/v1/object/upload/sign/${BUCKET}/${enc}`;
  const res = await fetch(url, { method: 'POST', headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify(kind === 'download' ? { expiresIn: 3600 } : {}) });
  const j = (await res.json().catch(() => ({}))) as { signedURL?: string; url?: string; message?: string };
  const p = j.signedURL ?? j.url;
  if (!p) throw new Error(`Storage: ${j.message ?? res.status}`);
  return `${env.VITE_SUPABASE_URL}/storage/v1${p}`;
}

/** Start rendering one clip whose edit plan is approved. */
export async function renderClip(env: RenderEnv, sb: Sb, u: string, clipId: string, origin: string): Promise<{ ok: boolean; status: string; message: string; args?: string[] }> {
  const [c] = await sb.get<{ id: string; storage_path: string | null; edit_plan: EditPlan | null; status: string }>(`content_clips?id=eq.${clipId}&user_id=eq.${u}&select=id,storage_path,edit_plan,status`);
  if (!c) return { ok: false, status: 'missing', message: 'That clip is gone.' };
  if (!c.edit_plan || c.status !== 'approved') return { ok: false, status: 'no_plan', message: 'Approve the Clip Editor\'s edit first.' };
  if (!c.storage_path) return { ok: false, status: 'no_file', message: 'The raw file isn\'t uploaded.' };
  const out = c.storage_path.replace(/(\.[a-z0-9]+)?$/i, '.edit.mp4');
  const args = ffmpegArgs(c.edit_plan, 'in', 'out.mp4');
  if (!renderOn(env)) return { ok: false, status: 'off', message: 'Rendering is off (CLIP_RENDER isn\'t "on" or RENDER_URL isn\'t set). The edit plan is saved and the Publisher posts the uploaded file.', args };
  if (isDryRun(env)) {
    await sb.patch('content_clips', `id=eq.${c.id}&user_id=eq.${u}`, { render_status: 'dry_run', render_error: null, updated_at: new Date().toISOString() });
    return { ok: true, status: 'dry_run', message: 'DRY_RUN: the render job was built but not sent.', args };
  }
  const job = JSON.stringify({ clip_id: c.id, user_id: u, input_url: await storageSign(env, c.storage_path, 'download'), upload_url: await storageSign(env, out, 'upload'), output_path: out, args, callback: `${env.APP_ORIGIN ?? origin}/api/content/render-callback` });
  const res = await fetch(`${env.RENDER_URL!.replace(/\/$/, '')}/render`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-render-signature': await hmacHex(env.RENDER_SECRET ?? '', job) }, body: job });
  if (!res.ok) {
    const msg = `Render service: HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`;
    await sb.patch('content_clips', `id=eq.${c.id}&user_id=eq.${u}`, { render_status: 'failed', render_error: msg, updated_at: new Date().toISOString() });
    return { ok: false, status: 'failed', message: msg };
  }
  const j = (await res.json().catch(() => ({}))) as { job_id?: string };
  await sb.patch('content_clips', `id=eq.${c.id}&user_id=eq.${u}`, { render_status: 'rendering', render_job: j.job_id ?? null, render_error: null, updated_at: new Date().toISOString() });
  return { ok: true, status: 'rendering', message: 'Rendering. It shows up on the clip when it\'s done (usually under a minute).' };
}

/** The render service calls back when the file is uploaded (or failed). */
export async function renderCallback(env: RenderEnv, sb: Sb, raw: string, sig: string | null): Promise<{ ok: boolean; status: number }> {
  if (!(await renderSignatureValid(env.RENDER_SECRET, raw, sig))) return { ok: false, status: 401 };
  const b = JSON.parse(raw) as { clip_id: string; user_id: string; ok: boolean; output_path?: string; error?: string };
  const patch = b.ok && b.output_path ? { render_status: 'done', rendered_path: b.output_path, rendered_at: new Date().toISOString(), render_error: null } : { render_status: 'failed', render_error: (b.error ?? 'Render failed').slice(0, 500) };
  await sb.patch('content_clips', `id=eq.${b.clip_id}&user_id=eq.${b.user_id}`, { ...patch, updated_at: new Date().toISOString() });
  return { ok: true, status: 200 };
}
