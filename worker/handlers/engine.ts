// /api/engine/* — the shared worker engine's HTTP surface. Runs are
// synchronous from the caller's point of view ("Run now" waits for the
// answer); the daily orchestrator cron arrives in E-comm Phase 4.
import { requireUser } from '../lib/auth';
import { Sb, json, zonedNow } from '../lib/sb';
import type { SbEnv } from '../lib/sb';
import { spentToday, capFor } from '../lib/ai';
import { ensureRoster, runScout, decide, ENGINE_DOMAINS, TZ } from '../lib/engine';
import type { Channel } from '../../src/data/ecom';
import { PLAYBOOK_MAX_CHARS } from '../../src/data/ecom';

export interface EngineEnv extends SbEnv { ANTHROPIC_API_KEY?: string }
const CHANNELS: Channel[] = ['tiktok', 'amazon', 'meta', 'etsy', 'walmart', 'rising'];

async function body<T>(request: Request): Promise<T | null> { try { return (await request.json()) as T; } catch { return null; } }

export async function engineRoute(request: Request, env: EngineEnv, path: string): Promise<Response> {
  const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set as a Worker secret.' }, 500);
  const sb = new Sb(env);
  try {
    if (path === 'start') {
      const workers = await ensureRoster(sb, user.id);
      return json({ workers, anthropic: !!env.ANTHROPIC_API_KEY });
    }
    if (path === 'status') {
      const date = zonedNow(TZ).date;
      const workers = await sb.get(`ai_workers?user_id=eq.${user.id}&order=domain.asc&select=*`);
      const spend = await Promise.all(ENGINE_DOMAINS.map(async (d) => ({ domain: d, spent: await spentToday(sb, user.id, d, date), cap: await capFor(sb, user.id, d) })));
      return json({ workers, spend, anthropic: !!env.ANTHROPIC_API_KEY, date });
    }
    if (path === 'run') {
      const b = await body<{ worker?: string; channel?: string; count?: number; instructions?: string }>(request);
      if (!b || b.worker !== 'scout') return json({ error: 'Only Product Scout runs in this phase.' }, 400);
      const channel = CHANNELS.includes(b.channel as Channel) ? (b.channel as Channel) : 'tiktok';
      const r = await runScout(env.ANTHROPIC_API_KEY, sb, user.id, { channel, count: b.count, instructions: b.instructions?.slice(0, PLAYBOOK_MAX_CHARS) || null });
      return json(r, r.ok ? 200 : r.capReached ? 429 : 502);
    }
    if (path === 'decide') {
      const b = await body<{ approval_id?: string; status?: 'approved' | 'sent_back' | 'killed'; note?: string; rerun?: boolean }>(request);
      if (!b?.approval_id || !b.status || !['approved', 'sent_back', 'killed'].includes(b.status)) return json({ error: 'approval_id and status are required.' }, 400);
      const r = await decide(env.ANTHROPIC_API_KEY, sb, user.id, { approvalId: b.approval_id, status: b.status, note: b.note, rerun: b.rerun });
      return json(r, r.ok ? 200 : 400);
    }
    return json({ error: `Unknown engine route: ${path}` }, 404);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
}
