// Content Engine routes that need a secret or a binding.
//
//   POST /api/content/transcribe?clip_id=…   16 kHz mono WAV (the browser
//        pulls the audio out of the raw clip, so a 200 MB video becomes a
//        few MB) → Workers AI Whisper → transcript + timed segments saved
//        on the clip, ready for the Clip Editor.
//
// The video itself never passes through the Worker: the browser uploads it
// straight to the private content-clips bucket under the user's folder.
import { syncInstagram } from '../lib/socialSync';
import { runPublisher } from '../lib/publisher';
import type { PublishEnv } from '../lib/publisher';
import { isDryRun } from '../lib/dryRun';
import type { DryRunEnv } from '../lib/dryRun';
import { TZ } from '../lib/engine';
import { requireMember } from '../lib/member';
import { json, zonedNow } from '../lib/sb';
import type { SbEnv } from '../lib/sb';
import { cleanSegments } from '../lib/contentWorkers';
import { requireUser, isOwnerUser } from '../lib/auth';
import { Sb } from '../lib/sb';
import { runIdeas, ideaToPlan, seedOwnAccounts, buildContentKit } from '../lib/contentOctober';
import { renderClip, renderCallback } from '../lib/render';
import type { RenderEnv } from '../lib/render';

export interface ContentEnv extends SbEnv { AI?: { run(model: string, input: Record<string, unknown>): Promise<unknown> } }

const MAX_AUDIO_BYTES = 9 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function contentTranscribe(request: Request, env: ContentEnv): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  const m = await requireMember(request, env);
  if (m instanceof Response) return m;
  const { user, sb } = m;
  const clipId = new URL(request.url).searchParams.get('clip_id') ?? '';
  if (!UUID.test(clipId)) return json({ error: 'clip_id is required.' }, 400);
  const [clip] = await sb.get<{ id: string }>(`content_clips?id=eq.${clipId}&user_id=eq.${user.id}&select=id`);
  if (!clip) return json({ error: 'Clip not found.' }, 404);
  if (!env.AI) return json({ error: "Server transcription isn't switched on (Workers AI binding missing).", code: 'no_ai' }, 501);
  const buf = new Uint8Array(await request.arrayBuffer());
  if (!buf.length) return json({ error: 'No audio in the request.' }, 400);
  if (buf.length > MAX_AUDIO_BYTES) return json({ error: 'That clip is too long to transcribe in one go — keep raw clips under about 4 minutes.' }, 413);
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  let out: { text?: string; segments?: unknown; transcription_info?: { duration?: number } };
  try {
    out = (await env.AI.run('@cf/openai/whisper-large-v3-turbo', { audio: btoa(bin), language: 'en' })) as typeof out;
  } catch (e) {
    console.error('content transcribe', e);
    return json({ error: 'Transcription failed — try again.' }, 502);
  }
  const segments = cleanSegments(out.segments);
  const text = (out.text ?? '').trim();
  const duration = Number(request.headers.get('x-duration')) || out.transcription_info?.duration || segments[segments.length - 1]?.end || null;
  await sb.patch('content_clips', `id=eq.${clipId}&user_id=eq.${user.id}`, { transcript: text || null, segments, duration_s: duration, updated_at: new Date().toISOString() });
  return json({ text, segments, duration_s: duration });
}

// ── October build, Phase 3 ────────────────────────────────────────────
//   POST /api/content/ideas-run       { account_id?, count? } fill the Ideas tab
//   POST /api/content/idea-plan       { idea_id, day? }       idea → Plan card
//   POST /api/content/sync-accounts   owner: pull real followers/avg views from each connected Instagram
//   POST /api/content/own-accounts    owner: add Masterminds / Made by Marq / personal accounts
//   POST /api/content/kit-run         { handoff_id? }         build a brand's content kit now
//   POST /api/content/render          { clip_id }             render an approved edit
//   POST /api/content/render-callback the render service (signed, no login)

export type ContentOctEnv = ContentEnv & Partial<Omit<RenderEnv, 'VITE_SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'>> & { ANTHROPIC_API_KEY?: string; VITE_SUPABASE_ANON_KEY: string };

export async function contentRoute(request: Request, env: ContentOctEnv, path: string): Promise<Response> {
  const sb = new Sb(env);
  if (path === 'render-callback') {
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
    const raw = await request.text();
    const r = await renderCallback(env as RenderEnv, sb, raw, request.headers.get('x-render-signature'));
    return json({ ok: r.ok }, r.status);
  }
  const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  const b = request.method === 'POST' ? ((await request.json().catch(() => ({}))) as Record<string, unknown>) : {};
  const id = (k: string) => (typeof b[k] === 'string' && UUID.test(b[k] as string) ? (b[k] as string) : undefined);
  try {
    if (path === 'ideas-run') return json(await runIdeas(env.ANTHROPIC_API_KEY, sb, user.id, { accountId: id('account_id'), count: typeof b.count === 'number' ? b.count : undefined, instructions: typeof b.instructions === 'string' ? b.instructions : null, trigger: 'manual' }));
    if (path === 'idea-plan') {
      const ideaId = id('idea_id');
      if (!ideaId) return json({ error: 'idea_id is required.' }, 400);
      const day = typeof b.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.day) ? b.day : null;
      return json(await ideaToPlan(sb, user.id, ideaId, day));
    }
    if (path === 'own-accounts') {
      if (!isOwnerUser(user)) return json({ error: 'Owner only.' }, 403);
      return json(await seedOwnAccounts(sb, user.id));
    }
    // "Post now": a photo or video that's already in storage goes straight to one account. Pressing it is the approval.
    if (path === 'post-now') {
      if (!isOwnerUser(user)) return json({ error: 'Owner only.' }, 403);
      const accountId = id('account_id'), storagePath = typeof b.path === 'string' ? b.path : '', fileName = typeof b.file_name === 'string' ? b.file_name.slice(0, 200) : 'post';
      if (!accountId || !storagePath.startsWith(`${user.id}/`) || storagePath.includes('..')) return json({ error: 'account_id and an uploaded file are required.' }, 400);
      const [acct] = await sb.get<{ id: string; handle: string; platform: string; live_posting: boolean; connected: boolean }>(`social_accounts?id=eq.${accountId}&user_id=eq.${user.id}&select=id,handle,platform,live_posting,connected`);
      if (!acct) return json({ error: 'That account is gone.' }, 404);
      const caption = typeof b.caption === 'string' ? b.caption.slice(0, 2200) : '';
      const isImage = /\.(jpe?g|png|webp)$/i.test(fileName);
      if (acct.platform === 'tiktok' && isImage) return json({ error: 'TikTok posts need a video.' }, 400);
      const { date } = zonedNow(TZ);
      const [item] = await sb.insert<{ id: string }>('content_items', { user_id: user.id, account_id: acct.id, status: 'approved', concept: (caption.split('\n')[0] || 'Post now').slice(0, 80), caption, format: isImage ? 'image' : 'reel', scheduled_for: date, publish_status: 'queued' });
      await sb.insert('content_clips', { user_id: user.id, storage_path: storagePath, file_name: fileName, status: 'approved', account_id: acct.id, content_item_id: item.id });
      const out = await runPublisher(env as unknown as PublishEnv, sb, user.id, { trigger: 'manual', itemIds: [item.id] });
      const [after] = await sb.get<{ publish_status: string | null; publish_error: string | null; publish_url: string | null }>(`content_items?id=eq.${item.id}&select=publish_status,publish_error,publish_url`);
      const test = !acct.live_posting && isDryRun(env as unknown as DryRunEnv);
      return json({ ok: after?.publish_status !== 'failed', item_id: item.id, status: after?.publish_status ?? null, error: after?.publish_error ?? null, url: after?.publish_url ?? null, test, summary: out?.summary ?? null });
    }
    if (path === 'sync-accounts') {
      if (!isOwnerUser(user)) return json({ error: 'Owner only.' }, 403);
      return json(await syncInstagram(env as never, sb, user.id));
    }
    if (path === 'kit-run') return json(await buildContentKit(env.ANTHROPIC_API_KEY, sb, user.id, { handoffId: id('handoff_id'), trigger: 'manual' }));
    if (path === 'render') {
      const clipId = id('clip_id');
      if (!clipId) return json({ error: 'clip_id is required.' }, 400);
      return json(await renderClip(env as RenderEnv, sb, user.id, clipId, new URL(request.url).origin));
    }
    return json({ error: `Unknown content route ${path}` }, 404);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
}
