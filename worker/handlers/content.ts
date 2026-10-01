// Content Engine routes that need a secret or a binding.
//
//   POST /api/content/transcribe?clip_id=…   16 kHz mono WAV (the browser
//        pulls the audio out of the raw clip, so a 200 MB video becomes a
//        few MB) → Workers AI Whisper → transcript + timed segments saved
//        on the clip, ready for the Clip Editor.
//
// The video itself never passes through the Worker: the browser uploads it
// straight to the private content-clips bucket under the user's folder.
import { requireMember } from '../lib/member';
import { json } from '../lib/sb';
import type { SbEnv } from '../lib/sb';
import { cleanSegments } from '../lib/contentWorkers';

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
