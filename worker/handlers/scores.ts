// /api/scores/score — score one AI output now (the app asks when a card has
// no score yet; the 5-minute timer backfills the rest). Owner only.
import { requireUser, isOwnerUser } from '../lib/auth';
import { Sb, json } from '../lib/sb';
import type { SbEnv } from '../lib/sb';
import { scoreOutput } from '../lib/scoring';
import type { OutputType } from '../lib/scoring';

export type ScoresEnv = SbEnv & { VITE_SUPABASE_ANON_KEY: string; ANTHROPIC_API_KEY?: string };
const TYPES: OutputType[] = ['approval', 'outreach', 'lead', 'gov_contract', 'complaint'];

export async function scoresRoute(request: Request, env: ScoresEnv, path: string): Promise<Response> {
  const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  if (!isOwnerUser(user)) return json({ error: 'Owner only.' }, 403);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set.' }, 500);
  if (path !== 'score' || request.method !== 'POST') return json({ error: 'POST /api/scores/score' }, 404);
  const b = (await request.json().catch(() => ({}))) as { type?: string; id?: string };
  const type = TYPES.find((t) => t === b.type);
  if (!type || typeof b.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(b.id)) return json({ error: 'type and id are required.' }, 400);
  const row = await scoreOutput(env.ANTHROPIC_API_KEY, new Sb(env), user.id, type, b.id);
  return row ? json({ ok: true, score: row }) : json({ error: 'Not found.' }, 404);
}
