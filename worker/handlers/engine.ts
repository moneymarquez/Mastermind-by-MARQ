// /api/engine/* — the shared worker engine's HTTP surface. Runs are
// synchronous from the caller's point of view ("Run now" waits for the
// answer); the overnight plan runs from the */5 cron (lib/orchestrator.ts).
import { requireMember } from '../lib/member';
import { json, zonedNow } from '../lib/sb';
import type { SbEnv } from '../lib/sb';
import { spentToday, capFor } from '../lib/ai';
import { ensureRoster, RUNNERS, decide, ENGINE_DOMAINS, TZ } from '../lib/engine';
import { nextDailyStep, planFor } from '../lib/orchestrator';
import type { Venture, ScriptChannel } from '../../src/data/mktEngine';
import type { Channel } from '../../src/data/ecom';
import { PLAYBOOK_MAX_CHARS } from '../../src/data/ecom';

export interface EngineEnv extends SbEnv { ANTHROPIC_API_KEY?: string }
const CHANNELS: Channel[] = ['tiktok', 'amazon', 'meta', 'etsy', 'walmart', 'rising'];
const VENTURES: Venture[] = ['madebymarq', 'mastermind', 'client'];
const SCRIPT_CHANNELS: ScriptChannel[] = ['call', 'voicemail', 'email', 'dm', 'landing'];

async function body<T>(request: Request): Promise<T | null> { try { return (await request.json()) as T; } catch { return null; } }

export async function engineRoute(request: Request, env: EngineEnv, path: string): Promise<Response> {
  // Members only (bug inventory B-02): every route here can spend.
  const m = await requireMember(request, env);
  if (m instanceof Response) return m;
  const { user, sb } = m;
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
      const b = await body<{ worker?: string; channel?: string; count?: number; product_id?: string; venture?: string; script_channel?: string; all?: boolean; instructions?: string }>(request);
      const runner = b?.worker ? RUNNERS[b.worker] : undefined;
      if (!b || !runner) return json({ error: `${b?.worker ?? 'That worker'} doesn't run yet in this build.` }, 400);
      const r = await runner(env.ANTHROPIC_API_KEY, sb, user.id, {
        channel: CHANNELS.includes(b.channel as Channel) ? (b.channel as Channel) : 'tiktok', count: b.count, productId: b.product_id,
        venture: VENTURES.includes(b.venture as Venture) ? (b.venture as Venture) : undefined,
        scriptChannel: SCRIPT_CHANNELS.includes(b.script_channel as ScriptChannel) ? (b.script_channel as ScriptChannel) : undefined,
        all: !!b.all, instructions: b.instructions?.slice(0, PLAYBOOK_MAX_CHARS) || null,
      });
      return json(r, r.ok ? 200 : r.capReached ? 429 : 502);
    }
    // The overnight plan, one step per call — the Orchestrator room's
    // "Run tonight's plan now" calls this until it answers done.
    if (path === 'daily') {
      const z = zonedNow(TZ);
      if (request.method === 'GET') {
        const [tasks, [summary]] = await Promise.all([
          sb.get(`ai_tasks?user_id=eq.${user.id}&body=like.daily:${z.date}:*&order=created_at.asc&select=id,body,status,note,created_at`),
          sb.get(`ai_daily_summaries?user_id=eq.${user.id}&domain=eq.orchestrator&order=date.desc&limit=1&select=date,summary_text,numbers`),
        ]);
        return json({ date: z.date, plan: planFor(z.dow), tasks, summary: summary ?? null });
      }
      const step = await nextDailyStep(env.ANTHROPIC_API_KEY, sb, user.id, z.date, z.dow);
      return json({ date: z.date, done: !step, step });
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
